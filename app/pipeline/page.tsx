"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import AgentCard from "@/components/AgentCard";
import { useApp, buildAgentList } from "@/lib/context";
import { createThumbnail } from "@/lib/thumbnail";
import type { AgentStatus, InstrumentAnalysis, TeachingSummary } from "@/types";

// ─── Utilities ───────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Thrown when any pipeline API call returns a GEMINI_BUSY 503. */
class GeminiBusyError extends Error {
  constructor() {
    super("Gemini is temporarily unavailable due to high demand.");
    this.name = "GeminiBusyError";
  }
}

// ─── Real API helpers ─────────────────────────────────────────────────────────

async function checkResponse(res: Response, fallback: string) {
  if (res.status === 503) {
    const data = await res.json().catch(() => ({}));
    if (data.code === "GEMINI_BUSY") throw new GeminiBusyError();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? fallback);
  }
  return res.json();
}

async function runOrchestrate(image: string, mimeType: string, fileName: string) {
  const res = await fetch("/api/orchestrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, mimeType, fileName }),
  });
  return checkResponse(res, "Orchestrate failed");
}

async function runAnalyseInstrument(
  instrument: string,
  masterContext: object,
  image: string,
  mimeType: string
): Promise<InstrumentAnalysis> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instrument, masterContext, image, mimeType }),
  });
  return checkResponse(res, `Analyze failed for ${instrument}`);
}

async function runTeacherSummary(
  masterContext: object,
  instrumentAnalyses: object
): Promise<TeachingSummary> {
  const res = await fetch("/api/teach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ masterContext, instrumentAnalyses }),
  });
  return checkResponse(res, "Teacher summary failed");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const hasRun = useRef(false);

  // Capture file info at mount time so the async effect doesn't read stale state
  const imageRef  = useRef(state.sheetImageBase64);
  const mimeRef   = useRef(state.mimeType);
  const nameRef   = useRef(state.fileName);

  // Guard — no file uploaded, redirect home
  useEffect(() => {
    if (!imageRef.current) router.replace("/");
  }, [router]);

  // Run the pipeline once
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const image    = imageRef.current;
    const mimeType = mimeRef.current;
    const fileName = nameRef.current;

    async function runPipeline() {
      // ── 1. Orchestrator (running) ──────────────────────────────────
      const orchAgent: AgentStatus = { id: "orchestrator", name: "Orchestrator", icon: "memory", status: "running" };
      dispatch({
        type: "SET_MASTER_CONTEXT",
        context: {
          sheetImage: image, mimeType, fileName,
          uploadedAt: new Date().toISOString(),
          instruments: [], key: "", tempo: 0,
          timeSignature: "", bars: 0, dynamics: [],
          structure: [], difficulty: "intermediate",
          notes: {}, rawText: "",
        },
        agents: [orchAgent],
      });

      const result = await runOrchestrate(image, mimeType, fileName);
      const fullAgents = buildAgentList(result.instruments);

      // ── 2. Orchestrator done — seed full agent list ────────────────
      dispatch({
        type: "SET_MASTER_CONTEXT",
        context: {
          sheetImage: image, mimeType, fileName,
          uploadedAt: new Date().toISOString(),
          instruments:   result.instruments,
          key:           result.key,
          tempo:         result.tempo,
          timeSignature: result.timeSignature,
          bars:          result.bars,
          dynamics:      result.dynamics      ?? [],
          structure:     result.structure     ?? [],
          difficulty:    result.difficulty    ?? "intermediate",
          notes:         result.notes        ?? {},
          rawText:       result.rawText      ?? "",
        },
        agents: fullAgents.map((a) =>
          a.id === "orchestrator"
            ? {
                ...a,
                status: "done" as const,
                summary: `Found ${result.instruments.length} instruments: ${result.instruments.join(", ")} — ${result.key}, ${result.tempo} BPM`,
              }
            : a
        ),
      });

      // ── 3. Instrument agents — sequential ─────────────────────────
      const collectedAnalyses: Record<string, InstrumentAnalysis> = {};
      for (const instrument of result.instruments) {
        dispatch({ type: "SET_AGENT_STATUS", id: instrument, status: "running" });
        const analysis = await runAnalyseInstrument(instrument, result, image, mimeType);
        collectedAnalyses[instrument] = analysis;
        dispatch({ type: "SET_INSTRUMENT_ANALYSIS", instrument, analysis });
        dispatch({
          type: "SET_AGENT_STATUS",
          id: instrument,
          status: "done",
          summary: `${analysis.technicalDifficulty} · ${analysis.keyTechniques.length} key techniques identified`,
        });
      }

      // ── 4. Teacher agent ──────────────────────────────────────────
      dispatch({ type: "SET_AGENT_STATUS", id: "teacher", status: "running" });
      const summary = await runTeacherSummary(result, collectedAnalyses);
      dispatch({ type: "SET_TEACHING_SUMMARY", summary });
      dispatch({
        type: "SET_AGENT_STATUS",
        id: "teacher",
        status: "done",
        summary: "Practice plan ready — your lesson is prepared!",
      });

      // ── 5. Save session to DB ─────────────────────────────────────
      // Thumbnail creation is separated from the session save so a
      // canvas failure (PDF mimeType can't render into <img>) doesn't
      // silently swallow the entire save.
      let thumbnail: string | null = null;
      try {
        thumbnail = await createThumbnail(image, mimeType);
      } catch (thumbErr) {
        console.warn("[pipeline] Thumbnail skipped:", thumbErr);
      }

      try {
        const saveRes = await fetch("/api/sessions", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName,
            thumbnailBase64:    thumbnail,          // null is fine — column is nullable
            masterContext:      result,             // sheetImage is stripped server-side
            instrumentAnalyses: collectedAnalyses,
            teachingSummary:    summary,
          }),
        });
        if (saveRes.ok) {
          const { sessionId } = await saveRes.json();
          dispatch({ type: "SET_SESSION_ID", sessionId });
        } else {
          const errBody = await saveRes.json().catch(() => ({}));
          console.error("[pipeline] Session save failed:", saveRes.status, errBody);
        }
      } catch (saveErr) {
        // Non-fatal — lesson still works, history just won't be saved
        console.error("[pipeline] Session save error:", saveErr);
      }

      // ── 6. Navigate ───────────────────────────────────────────────
      await sleep(700);
      dispatch({ type: "PIPELINE_DONE" });
      router.push("/teach");
    }

    runPipeline().catch((err) => {
      if (err instanceof GeminiBusyError) {
        router.replace("/?error=busy");
      } else {
        console.error("Pipeline failed:", err);
        router.replace("/?error=failed");
      }
    });
  }, [dispatch, router]);

  const agents   = state.agents;
  const progress = state.pipelineProgress;
  const hasImage = state.sheetImageBase64 && state.mimeType?.startsWith("image/");

  return (
    <div className="relative min-h-screen bg-surface-container-lowest staff-texture flex flex-col overflow-x-hidden">
      {/* Logo */}
      <header className="absolute top-6 left-6 md:top-8 md:left-10 z-10">
        <Logo />
      </header>

      <main className="flex-1 flex flex-col items-center px-4 md:px-10 pt-28 pb-24">
        {/* Hero */}
        <div className="text-center mb-10 max-w-xl">
          <h1 className="font-playfair font-bold text-headline-lg-mobile md:text-display-lg text-on-surface mb-3">
            Analysing your sheet
          </h1>
          <p className="font-inter text-body-lg text-on-surface-variant">
            Our AI agents are studying each instrument to build your practice plan.
          </p>
        </div>

        {/* Sheet thumbnail */}
        <div className="mb-14 relative">
          <div className="absolute inset-0 bg-primary-container/20 blur-2xl rounded-full scale-110 pointer-events-none" />
          <div className="relative z-10 w-36 h-48 md:w-44 md:h-60 rounded-xl border-2 border-primary-container/40 glow-amber overflow-hidden bg-surface-container-high flex items-center justify-center">
            {hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:${state.mimeType};base64,${state.sheetImageBase64}`}
                alt="Uploaded sheet music"
                className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 p-4 text-center">
                <span
                  className="material-symbols-outlined text-primary-container text-5xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  picture_as_pdf
                </span>
                <p className="font-inter text-label-md text-on-surface-variant">
                  {state.fileName || "Sheet music"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Agent pipeline */}
        <div className="relative w-full max-w-xl">
          {/* Connecting dotted amber line */}
          <div className="absolute left-9 top-10 bottom-14 pipeline-line z-0 hidden sm:block" />

          <div className="flex flex-col gap-5 relative z-10">
            {agents.length === 0 ? (
              // Skeleton while first dispatch lands
              <>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl bg-surface-container border border-surface-variant animate-pulse"
                  />
                ))}
              </>
            ) : (
              agents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} />
              ))
            )}
          </div>
        </div>
      </main>

      {/* Fixed progress bar */}
      <div className="fixed bottom-0 left-0 w-full h-1.5 bg-surface-container-highest z-50">
        <div
          className="h-full bg-primary-container relative transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        >
          {progress > 0 && progress < 100 && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary-container shadow-[0_0_12px_rgba(245,158,11,0.9)] blur-[1px]" />
          )}
        </div>
      </div>
    </div>
  );
}
