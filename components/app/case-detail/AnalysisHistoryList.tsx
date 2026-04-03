"use client";

import type { Analysis } from "@prisma/client";
import Link from "next/link";

export function AnalysisHistoryList({
  analysis,
}: {
  analysis: Analysis | null;
}) {
  if (!analysis) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-bg-card/50 p-8 text-center">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mx-auto text-text-secondary/40"
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="mt-3 text-sm font-medium text-text-secondary">
          No analysis history
        </p>
        <p className="mt-1 text-xs text-text-secondary/60">
          Run your first analysis to populate the history.
        </p>
      </div>
    );
  }

  const statusConfig = {
    LIKELY_ELIGIBLE: {
      label: "Bail Recommended",
      colors: "bg-state-success/10 text-state-success",
      dot: "bg-state-success",
    },
    LIKELY_INELIGIBLE: {
      label: "Bail Not Recommended",
      colors: "bg-state-error/10 text-state-error",
      dot: "bg-state-error",
    },
    BORDERLINE: {
      label: "Discretionary",
      colors: "bg-state-warning/10 text-state-warning",
      dot: "bg-state-warning",
    },
  } as const;

  const cfg = statusConfig[analysis.eligibilityStatus];
  const riskColor =
    analysis.riskScore <= 3
      ? "#0E9F6E"
      : analysis.riskScore <= 6
        ? "#D97706"
        : "#DC2626";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
          Analysis History
        </h3>

        {/* Analysis card - latest (highlighted) */}
        <Link
          href={`/analysis/${analysis.id}`}
          className="group block rounded-lg border border-accent-gold/20 bg-accent-gold/5 p-5 transition-all hover:-translate-y-0.5 hover:border-accent-gold/40 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Latest badge */}
              <span className="rounded bg-accent-gold/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-accent-gold">
                Latest
              </span>

              {/* Date */}
              <span className="font-mono text-xs text-text-secondary">
                {new Date(analysis.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            {/* Arrow */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-text-secondary/40 transition-transform group-hover:translate-x-1 group-hover:text-accent-gold"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>

          <div className="mt-4 flex items-center gap-6">
            {/* Risk score */}
            <div className="flex items-center gap-2">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: riskColor }}
              >
                {analysis.riskScore}
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-text-secondary">
                  Risk
                </p>
                <p className="text-xs text-text-secondary">/10</p>
              </div>
            </div>

            <div className="h-8 w-px bg-border" />

            {/* Eligibility badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${cfg.colors}`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>

          {/* Recommendation preview */}
          {analysis.recommendation && (
            <p className="mt-3 text-[13px] leading-relaxed text-text-secondary line-clamp-2">
              {analysis.recommendation}
            </p>
          )}
        </Link>
      </div>
    </div>
  );
}
