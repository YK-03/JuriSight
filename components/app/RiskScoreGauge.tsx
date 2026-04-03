"use client";

import { useMemo } from "react";
import { cn } from "../../lib/utils";;;

export function RiskScoreGauge({ score, className }: { score: number; className?: string }) {
  const clamped = Math.min(10, Math.max(1, score));
  const color = clamped <= 3 ? "#0E9F6E" : clamped <= 6 ? "#D97706" : "#DC2626";

  const { circumference, dashOffset } = useMemo(() => {
    const r = 36;
    const c = 2 * Math.PI * r;
    const ratio = (clamped / 10) * 0.75; // 270deg arc
    return {
      circumference: c,
      dashOffset: c * (1 - ratio),
    };
  }, [clamped]);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <g transform="rotate(135 50 50)">
          <circle cx="50" cy="50" r="36" fill="none" stroke="#E3E8EF" strokeWidth="8" strokeDasharray={`${circumference * 0.75} ${circumference}`} />
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 800ms ease-out" }}
          />
        </g>
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 20, fontWeight: 700, fill: "#0A2540" }}>
          {clamped}/10
        </text>
        <text x="50" y="72" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10, fill: "#8898AA", fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>
          RISK SCORE
        </text>
      </svg>
    </div>
  );
}
