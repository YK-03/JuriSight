"use client";

import { useMemo } from "react";
import type { AnalysisView } from "@/lib/analysis-types";

const statusConfig = {
  ELIGIBLE: {
    label: "Bail Recommended",
    subtitle: "Strong grounds for grant",
    color: "#0E9F6E",
    bg: "rgba(14,159,110,0.08)",
    border: "rgba(14,159,110,0.25)",
    darkBg: "rgba(14,159,110,0.12)",
  },
  NOT_ELIGIBLE: {
    label: "Bail Not Recommended",
    subtitle: "Significant risk factors present",
    color: "#DC2626",
    bg: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.25)",
    darkBg: "rgba(220,38,38,0.12)",
  },
  UNCERTAIN: {
    label: "Conditional Bail (Discretionary)",
    subtitle: "Judicial discretion advised",
    color: "#D97706",
    bg: "rgba(217,119,6,0.08)",
    border: "rgba(217,119,6,0.25)",
    darkBg: "rgba(217,119,6,0.12)",
  },
} as const;

function RiskGauge({ score, className }: { score: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, score));
  const color = clamped <= 30 ? "#0E9F6E" : clamped <= 60 ? "#D97706" : "#DC2626";

  const { circumference, dashOffset } = useMemo(() => {
    const r = 42;
    const c = 2 * Math.PI * r;
    const ratio = (clamped / 100) * 0.75;
    return { circumference: c, dashOffset: c * (1 - ratio) };
  }, [clamped]);

  return (
    <div className={className}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <g transform="rotate(135 60 60)">
          <circle
            cx="60" cy="60" r="42"
            fill="none"
            className="stroke-bg-secondary"
            strokeWidth="10"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
          />
          <circle
            cx="60" cy="60" r="42"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </g>
        <text
          x="60" y="56"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-primary"
          style={{ fontSize: 26, fontWeight: 700 }}
        >
          {clamped}
        </text>
        <text
          x="60" y="78"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-text-secondary"
          style={{
            fontSize: 9,
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Risk Score
        </text>
      </svg>
    </div>
  );
}

export function VerdictCard({ analysis }: { analysis: AnalysisView }) {
  const cfg = statusConfig[analysis.eligibility];
  const summary =
    analysis.reasoning.split(/[.!?]/)[0]?.trim() ||
    analysis.reasoning.slice(0, 120);

  return (
    <div
      className="glass-card animate-fade-in rounded-xl border p-6 md:p-8"
      style={{ borderColor: cfg.border }}
    >
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        {/* Left: status + summary */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide"
              style={{ backgroundColor: cfg.bg, color: cfg.color }}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
              {cfg.label}
            </span>
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-text-secondary">
            {cfg.subtitle}
          </p>
          <p className="max-w-xl text-[15px] leading-relaxed text-text-primary/80">
            {summary}.
          </p>
          <p className="font-mono text-[11px] text-text-secondary">
            Analyzed {new Date(analysis.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Right: gauge */}
        <div className="flex-shrink-0">
          <RiskGauge score={analysis.riskScore} />
        </div>
      </div>
    </div>
  );
}
