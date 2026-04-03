"use client";

import type { AnalysisView } from "@/lib/analysis-types";

function barColor(value: number): string {
  if (value <= 33) return "#0E9F6E";
  if (value <= 66) return "#D97706";
  return "#DC2626";
}

export function RiskBreakdown({
  factors,
}: {
  factors: AnalysisView["riskFactors"];
}) {
  return (
    <div className="animate-fade-in-2 rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
      <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
        Risk Breakdown
      </h2>

      <div className="grid gap-5 md:grid-cols-2">
        {factors.map((factor) => {
          const color = barColor(factor.value);
          return (
            <div key={factor.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">
                  {factor.label}
                </span>
                <span
                  className="rounded-md px-2 py-0.5 font-mono text-xs font-semibold"
                  style={{
                    color,
                    backgroundColor: `${color}18`,
                  }}
                >
                  {factor.value}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-bg-secondary">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${factor.value}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
