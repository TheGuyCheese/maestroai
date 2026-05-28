"use client";

import { useApp } from "@/lib/context";
import type { TeachingSummary, InstrumentAnalysis } from "@/types";

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TeachingPanel({ activeTab, onTabChange }: Props) {
  const { state } = useApp();
  const { masterContext, instrumentAnalyses, teachingSummary } = state;

  const instruments = masterContext?.instruments ?? [];
  const tabs = ["overview", ...instruments];

  return (
    <div className="flex-1 p-5 md:p-10 pt-8 overflow-y-auto">
      <h1 className="font-playfair font-bold text-headline-lg md:text-display-lg text-on-surface mb-8">
        About this piece
      </h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3 mb-10">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`px-5 py-2 rounded-full font-inter font-medium text-label-md transition-all capitalize
                ${isActive
                  ? "bg-primary-container text-[#0a0a0a] shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                  : "bg-surface-container-highest text-on-surface border border-outline-variant/30 hover:bg-surface-container-high hover:border-primary/40"
                }`}
            >
              {tab === "overview" ? "Overview" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && teachingSummary ? (
        <OverviewContent summary={teachingSummary} />
      ) : activeTab !== "overview" && instrumentAnalyses[activeTab] ? (
        <InstrumentContent analysis={instrumentAnalyses[activeTab]} />
      ) : (
        <SkeletonContent />
      )}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewContent({ summary }: { summary: TeachingSummary }) {
  return (
    <div className="space-y-10 animate-fadeIn">
      <p className="font-inter text-body-lg text-on-surface-variant leading-relaxed">
        {summary.pieceOverview}
      </p>

      <Section icon="hub" title="How Instruments Interact">
        <p className="font-inter text-body-md text-on-surface-variant leading-relaxed">
          {summary.howInstrumentsInteract}
        </p>
      </Section>

      <Section icon="list_alt" title="Practice Order">
        <ol className="space-y-3">
          {summary.practiceOrder.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-container/20 border border-primary-container/40 flex items-center justify-center shrink-0 font-inter font-bold text-label-sm text-primary-container">
                {i + 1}
              </span>
              <span className="font-inter text-body-md text-on-surface-variant">{step}</span>
            </li>
          ))}
        </ol>
      </Section>

      {summary.ensembleTips.length > 0 && (
        <Section icon="groups" title="Ensemble Tips">
          <ul className="space-y-3">
            {summary.ensembleTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container mt-2 shrink-0" />
                <span className="font-inter text-body-md text-on-surface-variant">{tip}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section icon="schedule" title="Recommended Pace">
        <p className="font-inter text-body-md text-on-surface-variant leading-relaxed">
          {summary.recommendedPace}
        </p>
      </Section>
    </div>
  );
}

// ─── Instrument ───────────────────────────────────────────────────────────────

function InstrumentContent({ analysis }: { analysis: InstrumentAnalysis }) {
  return (
    <div className="space-y-10 animate-fadeIn">
      <p className="font-inter text-body-lg text-on-surface-variant leading-relaxed">
        {analysis.contextNote}
      </p>

      <Section icon="psychology" title="Key Techniques">
        <ul className="space-y-3">
          {analysis.keyTechniques.map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container mt-2 shrink-0" />
              <span className="font-inter text-body-md text-on-surface-variant">{t}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="edit_note" title="Practice Breakdown">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.practiceBreakdown.map((pb, i) => (
            <div
              key={i}
              className="bg-surface-container p-5 rounded-xl border border-surface-container-highest"
            >
              <h4 className="font-inter font-medium text-label-md text-on-surface mb-2">
                {pb.bars}
              </h4>
              <p className="font-inter text-body-md text-on-surface-variant text-sm">
                {pb.focus}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon="warning" title="Common Mistakes">
        <ul className="space-y-3">
          {analysis.commonMistakes.map((m, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="material-symbols-outlined text-error text-sm mt-1 shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                close
              </span>
              <span className="font-inter text-body-md text-on-surface-variant">{m}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon="tips_and_updates" title="Beginner Tips">
        <ul className="space-y-3">
          {analysis.beginnerTips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="material-symbols-outlined text-primary-container text-sm mt-1 shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <span className="font-inter text-body-md text-on-surface-variant">{tip}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

// ─── Reusable Section ──────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="font-inter font-semibold text-title-md text-primary mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-primary-container">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonContent() {
  return (
    <div className="space-y-6 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-surface-container border border-surface-variant" />
      ))}
    </div>
  );
}
