"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

interface SessionSummary {
  id: string;
  file_name: string;
  thumbnail_base64: string | null;
  master_context: {
    instruments: string[];
    key: string;
    tempo: number;
    difficulty: "beginner" | "intermediate" | "advanced";
  };
  created_at: string;
}

const DIFFICULTY_COLOUR: Record<string, string> = {
  beginner:     "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  intermediate: "text-amber-400  border-amber-400/30  bg-amber-400/10",
  advanced:     "text-rose-400   border-rose-400/30   bg-rose-400/10",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function HistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load history");
        return r.json();
      })
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-on-surface staff-texture">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-surface-container-low px-6 md:px-10 py-5 flex items-center justify-between">
        <Logo />
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 font-inter text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>
            add_circle
          </span>
          New lesson
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-12">
        {/* Title */}
        <div className="mb-10">
          <h1 className="font-playfair font-bold text-display-sm text-on-surface mb-2">
            My Lessons
          </h1>
          <p className="font-inter text-body-md text-on-surface-variant">
            Pick up where you left off with any of your past sheets.
          </p>
        </div>

        {/* States */}
        {loading && (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">error</span>
            <p className="font-inter text-body-md text-on-surface-variant">{error}</p>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div className="flex flex-col items-center gap-5 py-24 text-center">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/20">
              <span
                className="material-symbols-outlined text-4xl text-primary-container"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                music_note
              </span>
            </div>
            <div>
              <p className="font-playfair font-semibold text-title-lg text-on-surface mb-1">
                No lessons yet
              </p>
              <p className="font-inter text-body-md text-on-surface-variant max-w-xs">
                Upload your first music sheet and let MaestroAI build your practice plan.
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="mt-2 px-5 py-2.5 bg-primary-container text-[#0a0a0a] rounded-lg font-inter text-label-md hover:brightness-110 transition-all"
            >
              Upload a sheet
            </button>
          </div>
        )}

        {/* Session grid */}
        {!loading && sessions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({ session: s }: { session: SessionSummary }) {
  const router = useRouter();
  const mc = s.master_context ?? {};
  const diff = mc.difficulty ?? "intermediate";
  const diffColour = DIFFICULTY_COLOUR[diff] ?? DIFFICULTY_COLOUR.intermediate;

  return (
    <button
      onClick={() => router.push(`/teach?session=${s.id}`)}
      className="group text-left bg-surface-container rounded-xl border border-surface-container-highest hover:border-primary-container/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)] transition-all duration-300 overflow-hidden flex flex-col"
    >
      {/* Thumbnail */}
      <div className="w-full h-44 bg-[#fdfdfd]/90 overflow-hidden relative">
        {s.thumbnail_base64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/jpeg;base64,${s.thumbnail_base64}`}
            alt={s.file_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 relative">
            <span
              className="material-symbols-outlined text-5xl text-black/20"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              music_note
            </span>
            {/* Staff lines */}
            <div className="absolute inset-0 flex flex-col justify-evenly px-4 opacity-10">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-px bg-black w-full" />
              ))}
            </div>
          </div>
        )}

        {/* Difficulty badge */}
        <span className={`absolute top-3 right-3 px-2 py-0.5 rounded-full border font-inter text-label-sm capitalize ${diffColour}`}>
          {diff}
        </span>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-inter font-semibold text-title-sm text-on-surface truncate">
          {s.file_name}
        </h3>

        {/* Instruments */}
        {mc.instruments?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mc.instruments.slice(0, 3).map((inst: string) => (
              <span
                key={inst}
                className="px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant/20 font-inter text-label-sm text-on-surface-variant capitalize"
              >
                {inst}
              </span>
            ))}
            {mc.instruments.length > 3 && (
              <span className="px-2 py-0.5 font-inter text-label-sm text-on-surface-variant">
                +{mc.instruments.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="font-inter text-label-sm text-on-surface-variant">
            {mc.key && `${mc.key}`}{mc.key && mc.tempo ? " · " : ""}{mc.tempo ? `${mc.tempo} BPM` : ""}
          </span>
          <span className="font-inter text-label-sm text-on-surface-variant">
            {formatDate(s.created_at)}
          </span>
        </div>
      </div>

      {/* Resume CTA */}
      <div className="px-4 pb-4">
        <div className="w-full py-2.5 rounded-lg bg-primary-container/10 border border-primary-container/20 group-hover:bg-primary-container/20 transition-colors flex items-center justify-center gap-2">
          <span
            className="material-symbols-outlined text-primary-container text-base"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            play_circle
          </span>
          <span className="font-inter text-label-md text-primary-container">Resume lesson</span>
        </div>
      </div>
    </button>
  );
}
