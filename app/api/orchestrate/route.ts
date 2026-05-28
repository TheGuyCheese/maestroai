import { NextRequest, NextResponse } from "next/server";
import { callGeminiJSON, imagePart, isGeminiBusy } from "@/lib/gemini";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "@/lib/prompts";
import type { MasterContext } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 180; // allow up to 2 auto-retries with delay

interface OrchestrateRequest {
  image: string;    // base64-encoded image data
  mimeType: string; // e.g. "image/jpeg" | "image/png" | "application/pdf"
  fileName: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OrchestrateRequest;

    if (!body.image || !body.mimeType) {
      return NextResponse.json(
        { error: "Missing required fields: image, mimeType" },
        { status: 400 }
      );
    }

    const parts = [
      imagePart(body.image, body.mimeType),
      {
        text: "Analyse this music sheet and return the JSON object as instructed. Extract every detail you can see.",
      },
    ];

    const result = await callGeminiJSON<Omit<MasterContext, "sheetImage" | "mimeType" | "fileName" | "uploadedAt">>(
      ORCHESTRATOR_SYSTEM_PROMPT,
      parts
    );

    // Merge the fields that only the server/client knows
    const masterContext: MasterContext = {
      ...result,
      sheetImage: body.image,
      mimeType:   body.mimeType,
      fileName:   body.fileName ?? "sheet",
      uploadedAt: new Date().toISOString(),
      // Ensure required fields have fallbacks
      instruments: result.instruments?.length ? result.instruments : ["piano"],
      key:           result.key           ?? "Unknown",
      tempo:         result.tempo         ?? 120,
      timeSignature: result.timeSignature ?? "4/4",
      bars:          result.bars          ?? 0,
      dynamics:      result.dynamics      ?? [],
      structure:     result.structure     ?? [],
      difficulty:    result.difficulty    ?? "intermediate",
      notes:         result.notes         ?? {},
      rawText:       result.rawText       ?? "",
    };

    // Strip sheetImage from the response — the client already has it.
    // No need to round-trip the full base64 back over the network.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sheetImage: _dropped, ...contextToReturn } = masterContext;
    return NextResponse.json(contextToReturn);
  } catch (err) {
    console.error("[/api/orchestrate]", err);
    if (isGeminiBusy(err)) {
      return NextResponse.json(
        { error: "Gemini is experiencing high demand. Please try again in a moment.", code: "GEMINI_BUSY" },
        { status: 503 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
