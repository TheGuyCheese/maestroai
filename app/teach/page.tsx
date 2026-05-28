"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import TeachingPanel from "@/components/TeachingPanel";
import ChatPanel from "@/components/ChatPanel";
import { useApp } from "@/lib/context";
import type { SessionRow } from "@/types";

// useSearchParams() requires a Suspense boundary in Next.js 14 App Router
export default function TeachPage() {
  return (
    <Suspense>
      <TeachPageInner />
    </Suspense>
  );
}

function TeachPageInner() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get("session");

  const [loading, setLoading] = useState(!!sessionParam);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Resume from history: fetch session + hydrate state ───────────────────
  useEffect(() => {
    if (!sessionParam) return;

    async function loadSession() {
      try {
        const res = await fetch(`/api/sessions/${sessionParam}`);
        if (!res.ok) throw new Error("Session not found");
        const session: SessionRow = await res.json();
        dispatch({ type: "HYDRATE_SESSION", session });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionParam]);

  // ── Guard for fresh sessions (no session param, no pipeline data) ─────────
  useEffect(() => {
    if (!sessionParam && !loading && !state.masterContext) {
      router.replace("/");
    }
  }, [sessionParam, loading, state.masterContext, router]);

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen w-full bg-[#0a0a0a] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
          <p className="font-inter text-body-md text-on-surface-variant">Loading your lesson…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen w-full bg-[#0a0a0a] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant">error</span>
          <p className="font-inter text-body-md text-on-surface-variant">{loadError}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-2 px-4 py-2 bg-primary-container text-[#0a0a0a] rounded-lg font-inter text-label-md hover:brightness-110 transition-all"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  const ctx = state.masterContext;
  const hasImage = state.sheetImageBase64 && state.mimeType?.startsWith("image/");

  return (
    <div className="flex h-screen w-full bg-[#0a0a0a] text-on-surface overflow-hidden">
      {/* ── LEFT — Teaching panel (60%) ─────────────────────────────── */}
      <main className="w-full lg:w-[60%] flex flex-col h-full overflow-y-auto">

        {/* Header */}
        <header className="flex flex-col gap-5 p-5 md:p-10 pb-6 border-b border-surface-container-low shrink-0">
          <div className="flex items-center justify-between">
            <Logo />
            <Link
              href="/history"
              className="font-inter text-label-md text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>
                history
              </span>
              My lessons
            </Link>
          </div>

          {/* Sheet metadata card */}
          <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-xl border border-surface-container-highest">
            {/* Thumbnail */}
            <div className="w-14 h-20 rounded-md overflow-hidden bg-[#fdfdfd]/90 flex items-center justify-center border border-outline/10 shrink-0 relative">
              {hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:${state.mimeType};base64,${state.sheetImageBase64}`}
                  alt="Sheet music"
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <span className="material-symbols-outlined text-black/30 text-2xl">music_note</span>
                  <div className="absolute inset-0 flex flex-col justify-evenly px-1 opacity-20">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-px bg-black w-full" />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Meta */}
            <div className="flex flex-col min-w-0">
              <h2 className="font-inter font-semibold text-title-md text-on-surface mb-1 truncate">
                {ctx?.fileName || "Your Sheet Music"}
              </h2>
              <p className="font-inter text-label-sm text-on-surface-variant flex flex-wrap items-center gap-2">
                {ctx?.key && <span>{ctx.key}</span>}
                {ctx?.key && ctx?.tempo ? <span className="w-1 h-1 rounded-full bg-outline-variant" /> : null}
                {ctx?.tempo ? <span>{ctx.tempo} BPM</span> : null}
                {ctx?.tempo && ctx?.bars ? <span className="w-1 h-1 rounded-full bg-outline-variant" /> : null}
                {ctx?.bars ? <span>{ctx.bars} bars</span> : null}
                {ctx?.difficulty ? (
                  <>
                    <span className="w-1 h-1 rounded-full bg-outline-variant" />
                    <span className="capitalize">{ctx.difficulty}</span>
                  </>
                ) : null}
              </p>
              {(ctx?.instruments ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {ctx!.instruments.map((inst) => (
                    <span
                      key={inst}
                      className="px-2.5 py-0.5 rounded-full border border-outline-variant/30 text-on-surface-variant font-inter text-label-sm capitalize"
                    >
                      {inst}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Teaching content */}
        <TeachingPanel
          activeTab={state.activeTab}
          onTabChange={(tab) => dispatch({ type: "SET_ACTIVE_TAB", tab })}
        />
      </main>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div className="hidden lg:block w-px bg-primary-container/15 h-full shrink-0 relative">
        <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-0.5 h-10 bg-primary rounded-full opacity-40" />
      </div>

      {/* ── RIGHT — Chat panel (40%) ─────────────────────────────────── */}
      <ChatPanel />

      {/* ── Mobile bottom nav ─────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center py-3 lg:hidden bg-surface-container-high border-t border-outline-variant/20 rounded-t-xl shadow-lg">
        <NavItem icon="home"      label="Home"     href="/" />
        <NavItem icon="history"   label="History"  href="/history" />
        <NavItem icon="smart_toy" label="AI Tutor" href="#" active />
        <NavItem icon="person"    label="Profile"  href="#" />
      </nav>
    </div>
  );
}

function NavItem({
  icon, label, href, active = false,
}: {
  icon: string; label: string; href: string; active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 transition-all ${
        active ? "text-primary scale-90" : "text-on-surface-variant hover:text-primary-fixed-dim"
      }`}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
      >
        {icon}
      </span>
      <span className="font-inter text-label-sm">{label}</span>
    </Link>
  );
}
