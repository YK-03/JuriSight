"use client";

import { cn } from "@/lib/utils";

type RiskLevel = "Low" | "Moderate" | "High";

const riskStyles: Record<RiskLevel, string> = {
  Low: "border-state-success/35 bg-state-success/10 text-state-success",
  Moderate: "border-state-warning/35 bg-state-warning/10 text-state-warning",
  High: "border-state-error/35 bg-state-error/10 text-state-error",
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em]",
        riskStyles[level],
      )}
    >
      {level}
    </span>
  );
}
