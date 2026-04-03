"use client";

import type { AnalysisView } from "@/lib/analysis-types";

export function PrecedentsPanel({
  precedents,
}: {
  precedents: AnalysisView["precedents"];
}) {
  if (precedents.length === 0) return null;

  return (
    <div className="animate-fade-in-4 rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
      <h2 className="mb-6 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
        Similar Precedents
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {precedents.map((p, i) => (
          <div
            key={i}
            className="group relative rounded-lg border border-border bg-bg-primary/50 p-5 transition-all duration-260 hover:-translate-y-0.5 hover:border-accent-gold/40 hover:shadow-lg"
          >
            {/* Similarity badge */}
            {p.similarity != null && (
              <span className="absolute right-4 top-4 rounded-md bg-accent-gold/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-gold">
                {Math.round(p.similarity)}% match
              </span>
            )}

            <h3 className="pr-20 text-sm font-semibold text-text-primary group-hover:text-accent-gold transition-colors duration-200">
              {p.title}
            </h3>

            {p.summary && (
              <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                {p.summary}
              </p>
            )}

            {/* Decorative bar */}
            <div className="mt-4 h-0.5 w-8 rounded-full bg-border opacity-60 transition-all duration-300 group-hover:w-12 group-hover:bg-accent-gold/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
