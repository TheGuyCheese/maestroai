"use client";

import type { AgentStatus } from "@/types";

interface AgentCardProps {
  agent: AgentStatus;
  index: number;
}

const statusConfig = {
  waiting: {
    containerClass: "bg-surface-container-low border-surface-variant opacity-60",
    iconBg: "bg-surface border-outline-variant",
    iconColor: "text-on-surface-variant",
    badge: null,
    badgeIcon: "schedule",
    summaryOpacity: "opacity-50",
  },
  running: {
    containerClass:
      "bg-surface-container border-surface-variant border-l-2 border-l-primary-container shadow-[inset_30px_0_40px_rgba(245,158,11,0.05)]",
    iconBg: "bg-surface border-primary-container/50",
    iconColor: "text-primary-container",
    badge: "PROCESSING",
    badgeIcon: null,
    summaryOpacity: "opacity-70",
  },
  done: {
    containerClass:
      "bg-surface-container border-primary-container/60 glow-amber-strong",
    iconBg: "bg-primary-container/20 border-primary-container/50",
    iconColor: "text-primary-container",
    badge: null,
    badgeIcon: "check_circle",
    summaryOpacity: "opacity-100",
  },
  error: {
    containerClass: "bg-surface-container border-error/40",
    iconBg: "bg-error/10 border-error/30",
    iconColor: "text-error",
    badge: "ERROR",
    badgeIcon: null,
    summaryOpacity: "opacity-80",
  },
};

export default function AgentCard({ agent, index }: AgentCardProps) {
  const cfg = statusConfig[agent.status];

  return (
    <div
      className={`relative rounded-xl p-5 flex items-start gap-5 border overflow-hidden backdrop-blur-sm transition-all duration-500 ${cfg.containerClass}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Left accent bar (done state) */}
      {agent.status === "done" && (
        <div className="absolute top-0 left-0 w-1 h-full bg-primary-container rounded-l-xl" />
      )}

      {/* Icon */}
      <div
        className={`w-12 h-12 rounded-full border flex items-center justify-center shrink-0 relative z-10 ${cfg.iconBg}`}
      >
        <span
          className={`material-symbols-outlined ${cfg.iconColor} ${
            agent.status === "running" ? "animate-spin" : ""
          }`}
          style={{ fontVariationSettings: agent.status === "done" ? "'FILL' 1" : "'FILL' 0" }}
        >
          {agent.status === "running" ? "autorenew" : agent.icon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 pt-1 min-w-0">
        <div className="flex justify-between items-center mb-1 gap-2">
          <h3
            className={`font-inter font-semibold text-title-md truncate ${
              agent.status === "waiting"
                ? "text-on-surface-variant"
                : "text-on-surface"
            }`}
          >
            {agent.status === "done" ? (
              <span className="text-primary-fixed-dim">{agent.name}</span>
            ) : (
              agent.name
            )}
          </h3>

          {/* Status badge / icon */}
          {agent.status === "running" && (
            <span className="font-inter text-label-sm text-primary-container uppercase tracking-wider shrink-0">
              Processing
            </span>
          )}
          {agent.status === "done" && (
            <span
              className="material-symbols-outlined text-emerald-400 shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          )}
          {agent.status === "waiting" && (
            <span className="material-symbols-outlined text-outline-variant shrink-0 text-sm">
              schedule
            </span>
          )}
          {agent.status === "error" && (
            <span
              className="material-symbols-outlined text-error shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              error
            </span>
          )}
        </div>

        <p
          className={`font-inter text-body-md text-on-surface-variant ${cfg.summaryOpacity} truncate`}
        >
          {agent.summary || defaultSummary(agent)}
        </p>
      </div>
    </div>
  );
}

function defaultSummary(agent: AgentStatus): string {
  if (agent.status === "waiting") {
    if (agent.id === "teacher") return "Preparing practice strategy…";
    return "Waiting for orchestral context…";
  }
  if (agent.status === "running") {
    if (agent.id === "orchestrator") return "Reading sheet and extracting structure…";
    if (agent.id === "teacher") return "Synthesising all analyses into a lesson…";
    return `Analysing phrasing and articulation…`;
  }
  return "";
}
