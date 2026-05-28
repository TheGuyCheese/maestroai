import { NextRequest, NextResponse } from "next/server";
import { callGeminiJSON, isGeminiBusy } from "@/lib/gemini";
import { TEACHER_SYSTEM_PROMPT } from "@/lib/prompts";
import type { MasterContext, InstrumentAnalysis, TeachingSummary } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 180; // allow up to 2 auto-retries with delay

interface TeachRequest {
  masterContext:      MasterContext;
  instrumentAnalyses: Record<string, InstrumentAnalysis>;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TeachRequest;

    if (!body.masterContext || !body.instrumentAnalyses) {
      return NextResponse.json(
        { error: "Missing required fields: masterContext, instrumentAnalyses" },
        { status: 400 }
      );
    }

    const analysesSummary = Object.entries(body.instrumentAnalyses)
      .map(([inst, a]) => `
${inst.toUpperCase()}:
- Difficulty: ${a.technicalDifficulty}
- Key techniques: ${a.keyTechniques.join("; ")}
- Common mistakes: ${a.commonMistakes.join("; ")}
- Tips: ${a.beginnerTips.join("; ")}
- Context: ${a.contextNote}
`.trim())
      .join("\n\n");

    const ctx = body.masterContext;
    const contextText = `
Piece: ${ctx.fileName}
Instruments: ${ctx.instruments.join(", ")}
Key: ${ctx.key} | Tempo: ${ctx.tempo} BPM | Time: ${ctx.timeSignature}
Bars: ${ctx.bars} | Difficulty: ${ctx.difficulty}
Structure: ${ctx.structure.join(" → ")}

Individual instrument analyses:
${analysesSummary}

Now synthesise a unified teaching summary for the whole piece.
`.trim();

    const result = await callGeminiJSON<TeachingSummary>(TEACHER_SYSTEM_PROMPT, [
      { text: contextText },
    ]);

    const summary: TeachingSummary = {
      pieceOverview:          result.pieceOverview          ?? "A wonderful piece to study.",
      whatMakesItInteresting: result.whatMakesItInteresting ?? "Rich musical content throughout.",
      howInstrumentsInteract: result.howInstrumentsInteract ?? "Each instrument plays a vital role.",
      practiceOrder:          result.practiceOrder?.length  ? result.practiceOrder  : ["Learn each part separately", "Combine slowly"],
      ensembleTips:           result.ensembleTips?.length   ? result.ensembleTips   : ["Listen carefully to other parts"],
      recommendedPace:        result.recommendedPace        ?? "Start slowly and build up gradually.",
    };

    return NextResponse.json(summary);
  } catch (err) {
    console.error("[/api/teach]", err);
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
