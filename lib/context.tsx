"use client";

import React, { createContext, useContext, useReducer } from "react";
import type { AppState, AppAction, AgentStatus, SessionRow } from "@/types";

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState: AppState = {
  step: "upload",
  uploadedFile: null,
  sheetImageBase64: "",
  mimeType: "",
  fileName: "",
  sessionId: null,
  masterContext: null,
  instrumentAnalyses: {},
  teachingSummary: null,
  conversationHistory: [],
  agents: [],
  pipelineProgress: 0,
  activeTab: "overview",
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_FILE":
      return {
        ...state,
        uploadedFile: action.file,
        sheetImageBase64: action.base64,
        mimeType: action.mimeType,
        fileName: action.file.name,
      };

    case "START_PIPELINE":
      return { ...state, step: "pipeline" };

    case "SET_MASTER_CONTEXT":
      return {
        ...state,
        masterContext: action.context,
        agents: action.agents,
        pipelineProgress: 20,
      };

    case "SET_AGENT_STATUS": {
      const agents = state.agents.map((a) =>
        a.id === action.id
          ? { ...a, status: action.status, summary: action.summary ?? a.summary }
          : a
      );
      const done = agents.filter((a) => a.status === "done").length;
      const progress = Math.round((done / agents.length) * 100);
      return { ...state, agents, pipelineProgress: progress };
    }

    case "SET_INSTRUMENT_ANALYSIS":
      return {
        ...state,
        instrumentAnalyses: {
          ...state.instrumentAnalyses,
          [action.instrument]: action.analysis,
        },
      };

    case "SET_TEACHING_SUMMARY":
      return { ...state, teachingSummary: action.summary };

    case "SET_SESSION_ID":
      return { ...state, sessionId: action.sessionId };

    case "PIPELINE_DONE":
      return { ...state, step: "teach", pipelineProgress: 100 };

    // ── Hydrate state from a persisted session (history resume) ──────────────
    case "HYDRATE_SESSION": {
      const s: SessionRow = action.session;
      return {
        ...initialState,
        step: "teach",
        sessionId: s.id,
        fileName: s.file_name,
        // Use thumbnail as the display image for resumed sessions
        sheetImageBase64: s.thumbnail_base64 ?? "",
        mimeType: "image/jpeg",
        masterContext: {
          ...s.master_context,
          sheetImage: s.thumbnail_base64 ?? "",
          mimeType: "image/jpeg",
          fileName: s.file_name,
        },
        instrumentAnalyses: s.instrument_analyses ?? {},
        teachingSummary: s.teaching_summary ?? null,
        conversationHistory: s.conversation_history ?? [],
        activeTab: "overview",
      };
    }

    case "ADD_USER_MESSAGE":
      return {
        ...state,
        conversationHistory: [
          ...state.conversationHistory,
          { role: "user", content: action.content },
        ],
      };

    case "ADD_ASSISTANT_MESSAGE":
      return {
        ...state,
        conversationHistory: [
          ...state.conversationHistory,
          { role: "assistant", content: action.content },
        ],
      };

    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.tab };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build the initial agent list from an instruments array */
export function buildAgentList(instruments: string[]): AgentStatus[] {
  const agents: AgentStatus[] = [
    {
      id: "orchestrator",
      name: "Orchestrator",
      icon: "memory",
      status: "done",
    },
    ...instruments.map((inst) => ({
      id: inst,
      name: `${inst.charAt(0).toUpperCase() + inst.slice(1)} Agent`,
      icon: instrumentIcon(inst),
      status: "waiting" as const,
    })),
    {
      id: "teacher",
      name: "Teacher Agent",
      icon: "school",
      status: "waiting" as const,
    },
  ];
  return agents;
}

function instrumentIcon(instrument: string): string {
  const map: Record<string, string> = {
    piano:      "piano",
    violin:     "music_note",
    cello:      "music_note",
    viola:      "music_note",
    guitar:     "music_note",
    flute:      "air",
    clarinet:   "air",
    trumpet:    "campaign",
    drums:      "drum",
    bass:       "music_note",
    saxophone:  "music_note",
    harp:       "music_note",
  };
  return map[instrument.toLowerCase()] ?? "music_note";
}
