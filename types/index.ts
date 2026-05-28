// ─── Core domain types ───────────────────────────────────────────────────────

export interface MasterContext {
  sheetImage: string; // base64 — only kept in memory, never persisted to DB
  mimeType: string;
  fileName: string;
  uploadedAt: string;
  instruments: string[];
  key: string;
  tempo: number;
  timeSignature: string;
  bars: number;
  dynamics: string[];
  structure: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  notes: Record<string, unknown>;
  rawText: string;
}

export interface InstrumentAnalysis {
  instrument: string;
  technicalDifficulty: string;
  keyTechniques: string[];
  practiceBreakdown: { bars: string; focus: string }[];
  commonMistakes: string[];
  beginnerTips: string[];
  contextNote: string;
}

export interface TeachingSummary {
  pieceOverview: string;
  whatMakesItInteresting: string;
  howInstrumentsInteract: string;
  practiceOrder: string[];
  ensembleTips: string[];
  recommendedPace: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface FullContext extends MasterContext {
  instrumentAnalyses: Record<string, InstrumentAnalysis>;
  teachingSummary: TeachingSummary;
  conversationHistory: ChatMessage[];
}

// ─── Session (as returned from Supabase) ─────────────────────────────────────

export interface SessionRow {
  id: string;
  user_id: string;
  file_name: string;
  thumbnail_base64: string | null;
  master_context: Omit<MasterContext, "sheetImage">;
  instrument_analyses: Record<string, InstrumentAnalysis>;
  teaching_summary: TeachingSummary | null;
  conversation_history: ChatMessage[];
  created_at: string;
  updated_at: string;
}

// ─── Agent / pipeline types ───────────────────────────────────────────────────

export type AgentStatusValue = "waiting" | "running" | "done" | "error";

export interface AgentStatus {
  id: string;
  name: string;
  icon: string; // Material Symbols icon name
  status: AgentStatusValue;
  summary?: string;
}

// ─── App state ────────────────────────────────────────────────────────────────

export type AppStep = "upload" | "pipeline" | "teach";

export interface AppState {
  step: AppStep;
  uploadedFile: File | null;
  sheetImageBase64: string;
  mimeType: string;
  fileName: string;
  sessionId: string | null;           // set after session is saved to DB
  masterContext: MasterContext | null;
  instrumentAnalyses: Record<string, InstrumentAnalysis>;
  teachingSummary: TeachingSummary | null;
  conversationHistory: ChatMessage[];
  agents: AgentStatus[];
  pipelineProgress: number;           // 0–100
  activeTab: string;                  // "overview" | instrument name
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type AppAction =
  | { type: "SET_FILE"; file: File; base64: string; mimeType: string }
  | { type: "START_PIPELINE" }
  | { type: "SET_MASTER_CONTEXT"; context: MasterContext; agents: AgentStatus[] }
  | { type: "SET_AGENT_STATUS"; id: string; status: AgentStatusValue; summary?: string }
  | { type: "SET_INSTRUMENT_ANALYSIS"; instrument: string; analysis: InstrumentAnalysis }
  | { type: "SET_TEACHING_SUMMARY"; summary: TeachingSummary }
  | { type: "SET_SESSION_ID"; sessionId: string }
  | { type: "PIPELINE_DONE" }
  | { type: "HYDRATE_SESSION"; session: SessionRow }  // used when resuming from history
  | { type: "ADD_USER_MESSAGE"; content: string }
  | { type: "ADD_ASSISTANT_MESSAGE"; content: string }
  | { type: "SET_ACTIVE_TAB"; tab: string }
  | { type: "RESET" };
