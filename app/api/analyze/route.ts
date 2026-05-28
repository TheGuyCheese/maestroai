import { NextRequest, NextResponse } from "next/server";
import { callGeminiJSON, imagePart, isGeminiBusy } from "@/lib/gemini";
import { instrumentAgentSystemPrompt } from "@/lib/prompts";
import type { MasterContext, InstrumentAnalysis } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 180; // allow up to 2 auto-retries with delay

interface AnalyzeRequest {
  instrument:    string;
  masterContext: MasterContext;
  image:         string;    // base64
  mimeType:      string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeRequest;

    if (!body.instrument || !body.masterContext || !body.image) {
      return NextResponse.json(
        { error: "Missing required fields: instrument, masterContext, image" },
        { status: 400 }
      );
    }

    const contextText = `
Full piece analysis so far:
- Instruments: ${body.masterContext.instruments.join(", ")}
- Key: ${body.masterContext.key}
- Tempo: ${body.masterContext.tempo} BPM
- Time signature: ${body.masterContext.timeSignature}
- Bars: ${body.masterContext.bars}
- Difficulty: ${body.masterContext.difficulty}
- Dynamics: ${body.masterContext.dynamics.join(", ")}
- Structure: ${body.masterContext.structure.join(", ")}

Now analyse ONLY the ${body.instrument} part in depth.
`.trim();

    const parts = [
      imagePart(body.image, body.mimeType),
      { text: contextText },
    ];

    const result = await callGeminiJSON<InstrumentAnalysis>(
      instrumentAgentSystemPrompt(body.instrument),
      parts
    );

    // Ensure required fields with fallbacks
    const analysis: InstrumentAnalysis = {
      instrument:          body.instrument,
      technicalDifficulty: result.technicalDifficulty  ?? "See full analysis",
      keyTechniques:       result.keyTechniques?.length   ? result.keyTechniques   : ["Practice slowly with a metronome"],
      practiceBreakdown:   result.practiceBreakdown?.length ? result.practiceBreakdown : [{ bars: "Full piece", focus: "Play through at a comfortable tempo" }],
      commonMistakes:      result.commonMistakes?.length  ? result.commonMistakes  : [],
      beginnerTips:        result.beginnerTips?.length    ? result.beginnerTips    : [],
      contextNote:         result.contextNote             ?? "",
    };

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[/api/analyze]", err);
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
