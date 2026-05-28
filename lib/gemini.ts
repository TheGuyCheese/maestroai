import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerateContentRequest,
  type Part,
} from "@google/generative-ai";

// ─── Error helpers ───────────────────────────────────────────────────────────

/**
 * Returns true when the Gemini API is temporarily overloaded (503)
 * OR rate-limited (429). Both are transient and should show a friendly message.
 */
export function isGeminiBusy(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  const status = (err as { status?: number }).status;
  return (
    status === 503 ||
    status === 429 ||
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("service unavailable") ||
    msg.includes("high demand") ||
    msg.includes("quota") ||
    msg.includes("too many requests") ||
    msg.includes("rate limit")
  );
}

/** Parse Gemini's RetryInfo delay string (e.g. "15s", "1m30s") → milliseconds. */
function parseRetryDelay(err: unknown): number {
  const details = (err as { errorDetails?: { "@type"?: string; retryDelay?: string }[] })?.errorDetails;
  if (Array.isArray(details)) {
    for (const d of details) {
      if (d["@type"]?.includes("RetryInfo") && d.retryDelay) {
        // Supports formats like "15s", "90s" — add a 3 s buffer
        const match = d.retryDelay.match(/(\d+)s/);
        if (match) return parseInt(match[1], 10) * 1000 + 3000;
      }
    }
  }
  return 25_000; // sensible default when delay isn't provided
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

// ─── Client ───────────────────────────────────────────────────────────────────

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables.");
  return new GoogleGenerativeAI(apiKey);
}

const MODEL_NAME = "gemini-2.5-flash";

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build an inline image Part for Gemini vision. */
export function imagePart(base64: string, mimeType: string): Part {
  return {
    inlineData: { data: base64, mimeType },
  };
}

// ─── callGeminiJSON ───────────────────────────────────────────────────────────

const MAX_RETRIES = 2; // attempt once + 2 retries = 3 total

/**
 * Send a prompt (optionally with an image) to Gemini and expect a strict JSON
 * response. Strips markdown code fences if the model wraps the output in them.
 *
 * Automatically retries on 429 / 503 using the delay suggested by the API.
 */
export async function callGeminiJSON<T = unknown>(
  systemPrompt: string,
  parts: Part[]
): Promise<T> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      responseMimeType: "application/json",
    },
  });

  const request: GenerateContentRequest = { contents: [{ role: "user", parts }] };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(request);
      const raw = result.response.text().trim();

      // Strip markdown code fences in case the model wraps output
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      try {
        return JSON.parse(cleaned) as T;
      } catch {
        throw new Error(`Gemini returned invalid JSON:\n${cleaned.slice(0, 400)}`);
      }
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number }).status;
      const isTransient = status === 429 || status === 503;

      if (isTransient && attempt < MAX_RETRIES) {
        const delay = parseRetryDelay(err);
        console.warn(
          `[gemini] ${status} on attempt ${attempt + 1}/${MAX_RETRIES + 1} — ` +
          `retrying in ${Math.round(delay / 1000)}s…`
        );
        await sleep(delay);
        continue;
      }

      // Non-transient error or retries exhausted — re-throw for the route to handle
      throw err;
    }
  }

  throw lastErr;
}

// ─── getGeminiStreamResult ────────────────────────────────────────────────────

/**
 * Returns the raw Gemini stream result so the caller can:
 *   1. Stream chunks to the client
 *   2. Accumulate the full response for DB persistence
 *
 * Use this in API routes that need to do both simultaneously.
 */
export async function getGeminiStreamResult(
  systemPrompt: string,
  conversationHistory: { role: "user" | "model"; parts: Part[] }[],
  userMessage: string,
) {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
    },
  });

  const contents = [
    ...conversationHistory,
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  return model.generateContentStream({ contents });
}
