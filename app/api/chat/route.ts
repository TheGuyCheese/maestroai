import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase";
import { chatSystemPrompt } from "@/lib/prompts";
import { getGeminiStreamResult, isGeminiBusy } from "@/lib/gemini";
import type { ChatMessage, FullContext, MasterContext, InstrumentAnalysis, TeachingSummary } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// ─── What the client sends ────────────────────────────────────────────────────
// Primary:  { sessionId, message }          — context fetched from DB server-side
// Fallback: { fullContext, message }        — used when session wasn't persisted
interface ChatRequest {
  sessionId?:   string;
  message:      string;
  fullContext?: FullContext;
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { sessionId, message, fullContext } = (await req.json()) as ChatRequest;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Resolve context — from DB (preferred) or inline fullContext (fallback) ─

    let mc:       Partial<MasterContext> = {};
    let ts:       TeachingSummary | null = null;
    let ia:       Record<string, InstrumentAnalysis> = {};
    let history:  ChatMessage[] = [];
    let fileName  = "sheet";
    let saveToDb  = false;

    const supabase = createServerSupabaseClient();

    if (sessionId) {
      // ── Primary: fetch full context from DB ───────────────────────────────
      const { data: session, error: fetchError } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !session) {
        return new Response(JSON.stringify({ error: "Session not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      mc       = (session.master_context        ?? {}) as Partial<MasterContext>;
      ts       = (session.teaching_summary      ?? null) as TeachingSummary | null;
      ia       = (session.instrument_analyses   ?? {}) as Record<string, InstrumentAnalysis>;
      history  = session.conversation_history  ?? [];
      fileName = session.file_name;
      saveToDb = true;

    } else if (fullContext) {
      // ── Fallback: use inline context (session wasn't persisted yet) ────────
      mc       = fullContext                                ?? {};
      ts       = fullContext.teachingSummary               ?? null;
      ia       = fullContext.instrumentAnalyses            ?? {};
      history  = fullContext.conversationHistory           ?? [];
      fileName = fullContext.fileName                      ?? "sheet";
      saveToDb = false; // no session row to update

    } else {
      return new Response(JSON.stringify({ error: "Provide either sessionId or fullContext" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Build context summary (server-side only — never sent to client) ───────

    const analysesSummary = Object.entries(ia)
      .map(([inst, a]: [string, InstrumentAnalysis]) =>
        `${inst.toUpperCase()}:\n` +
        `- Technical difficulty: ${a.technicalDifficulty}\n` +
        `- Key techniques: ${a.keyTechniques?.join("; ")}\n` +
        `- Common mistakes: ${a.commonMistakes?.join("; ")}\n` +
        `- Tips: ${a.beginnerTips?.join("; ")}\n` +
        `- Context: ${a.contextNote}`
      )
      .join("\n\n");

    const teachingSummary = ts
      ? `TEACHER SYNTHESIS:\n` +
        `- Overview: ${ts.pieceOverview}\n` +
        `- What makes it interesting: ${ts.whatMakesItInteresting}\n` +
        `- How instruments interact: ${ts.howInstrumentsInteract}\n` +
        `- Practice order: ${ts.practiceOrder?.join(" → ")}\n` +
        `- Ensemble tips: ${ts.ensembleTips?.join("; ")}\n` +
        `- Recommended pace: ${ts.recommendedPace}`
      : "";

    const contextSummary = [
      `PIECE DETAILS:`,
      `- File: ${fileName}`,
      `- Instruments: ${mc.instruments?.join(", ") ?? "unknown"}`,
      `- Key: ${mc.key} | Tempo: ${mc.tempo} BPM | Time signature: ${mc.timeSignature}`,
      `- Bars: ${mc.bars} | Difficulty: ${mc.difficulty}`,
      `- Structure: ${mc.structure?.join(" → ") ?? ""}`,
      ``,
      analysesSummary,
      ``,
      teachingSummary,
    ].join("\n").trim();

    // ── Build system prompt (never leaves the server) ─────────────────────────
    const isResuming   = history.length > 0;
    const systemPrompt = chatSystemPrompt(contextSummary, isResuming);

    // ── Convert history to Gemini format ──────────────────────────────────────
    const geminiHistory = history.map((msg: ChatMessage) => ({
      role:  msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.content }],
    }));

    // ── Start Gemini stream ───────────────────────────────────────────────────
    const geminiResult = await getGeminiStreamResult(systemPrompt, geminiHistory, message);

    const encoder    = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of geminiResult.stream) {
            const text = chunk.text();
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          // ── Persist both turns to DB (only when we have a saved session) ───
          if (saveToDb && sessionId) {
            const updatedHistory: ChatMessage[] = [
              ...history,
              { role: "user",      content: message      },
              { role: "assistant", content: fullResponse  },
            ];
            const { error: updateErr } = await supabase
              .from("sessions")
              .update({ conversation_history: updatedHistory })
              .eq("id", sessionId)
              .eq("user_id", userId);

            if (updateErr) {
              console.error("[/api/chat] Failed to save conversation history:", updateErr);
            }
          }

        } catch (err) {
          console.error("[/api/chat] stream error", err);
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type":           "text/plain; charset=utf-8",
        "Cache-Control":          "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });

  } catch (err) {
    console.error("[/api/chat]", err);
    if (isGeminiBusy(err)) {
      return new Response(
        JSON.stringify({ error: "Gemini is experiencing high demand. Please try again in a moment.", code: "GEMINI_BUSY" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
