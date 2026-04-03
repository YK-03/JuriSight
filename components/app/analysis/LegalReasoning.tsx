"use client";

import type { AnalysisView } from "@/lib/analysis-types";

const LEGAL_KEYWORDS = [
  "CrPC",
  "BNSS",
  "IPC",
  "BNS",
  "Section",
  "S\\.",
  "Non-Bailable",
  "Bailable",
  "bail",
  "POCSO",
  "SC/ST",
];

const keywordRegex = new RegExp(`(${LEGAL_KEYWORDS.join("|")})`, "gi");

function HighlightedText({ text }: { text: string }) {
  const parts = text.split(keywordRegex);
  return (
    <p className="text-[15px] leading-7 text-text-primary/80">
      {parts.map((part, i) =>
        keywordRegex.test(part) ? (
          <span
            key={i}
            className="rounded bg-accent-gold/15 px-1 font-semibold text-accent-gold"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 flex-shrink-0 text-state-success"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function LegalReasoning({
  legalBasis,
  reasoning,
  riskFactors,
  conditions,
  eligibility,
}: {
  legalBasis: string;
  reasoning: string;
  riskFactors: AnalysisView["riskFactors"];
  conditions: string[];
  eligibility: AnalysisView["eligibility"];
}) {
  return (
    <div className="animate-fade-in-3 space-y-5">
      {/* Legal Basis */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
          Legal Basis
        </h2>
        <HighlightedText text={legalBasis} />
      </div>

      {/* Legal Reasoning */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
          Legal Reasoning
        </h2>
        <HighlightedText text={reasoning} />
      </div>

      {/* Key Risk Factors */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
          Key Factors
        </h2>
        <div className="flex flex-wrap gap-2">
          {riskFactors.map((f) => {
            const color =
              f.value <= 33
                ? "text-state-success bg-state-success/10 border-state-success/30"
                : f.value <= 66
                  ? "text-state-warning bg-state-warning/10 border-state-warning/30"
                  : "text-state-error bg-state-error/10 border-state-error/30";
            return (
              <span
                key={f.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${color}`}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      f.value <= 33
                        ? "#0E9F6E"
                        : f.value <= 66
                          ? "#D97706"
                          : "#DC2626",
                  }}
                />
                {f.label}: {f.value}%
              </span>
            );
          })}
        </div>
      </div>

      {/* Conditions */}
      {eligibility !== "NOT_ELIGIBLE" && conditions.length > 0 && (
        <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel md:p-8">
          <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
            Suggested Bail Conditions
          </h2>
          <ul className="space-y-3">
            {conditions.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-text-primary/80"
              >
                <CheckIcon />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
