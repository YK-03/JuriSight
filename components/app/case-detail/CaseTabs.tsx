"use client";

import { useState } from "react";
import type { Analysis, Document as PrismaDocument, Case } from "@prisma/client";
import { DocumentsPanel } from "./DocumentsPanel";
import { AnalysisHistoryList } from "./AnalysisHistoryList";
import { TimeEligibilityBanner } from "../../../components/app/TimeEligibilityBanner";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "analysis", label: "Analysis History" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function CaseTabs({
  caseData,
  analysis,
  documents,
}: {
  caseData: Case;
  analysis: Analysis | null;
  documents: PrismaDocument[];
}) {
  const [active, setActive] = useState<TabId>("overview");

  return (
    <div className="animate-fade-in-2 space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-bg-secondary/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
              active === tab.id
                ? "bg-bg-card text-text-primary shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
            {tab.id === "documents" && documents.length > 0 && (
              <span className="ml-1.5 rounded-full bg-accent-gold/15 px-1.5 py-0.5 font-mono text-[10px] text-accent-gold">
                {documents.length}
              </span>
            )}
            {tab.id === "analysis" && analysis && (
              <span className="ml-1.5 rounded-full bg-accent-gold/15 px-1.5 py-0.5 font-mono text-[10px] text-accent-gold">
                1
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {active === "overview" && (
          <OverviewTab caseData={caseData} analysis={analysis} />
        )}
        {active === "documents" && (
          <DocumentsPanel caseId={caseData.id} documents={documents} />
        )}
        {active === "analysis" && (
          <AnalysisHistoryList analysis={analysis} />
        )}
      </div>
    </div>
  );
}

/* ── Overview Tab ─────────────────────────────────────────────────── */
function OverviewTab({
  caseData,
  analysis,
}: {
  caseData: Case;
  analysis: Analysis | null;
}) {
  return (
    <div className="space-y-4">
      {/* Time eligibility */}
      <TimeEligibilityBanner
        data={{
          dateOfArrest: caseData.dateOfArrest,
          maximumSentenceYears: caseData.maximumSentenceYears,
        }}
      />

      {/* Quick summary */}
      <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel">
        <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
          Case Summary
        </h3>

        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </span>
            <div>
              <p className="text-text-secondary">Accused</p>
              <p className="font-medium text-text-primary">{caseData.accusedName}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <div>
              <p className="text-text-secondary">Charge</p>
              <p className="font-medium text-text-primary">
                {caseData.section} — {caseData.offenseType}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <div>
              <p className="text-text-secondary">Status</p>
              <p className="font-medium text-text-primary">
                {analysis ? "Analyzed" : "Pending Analysis"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis snapshot (if exists) */}
      {analysis && (
        <div className="rounded-xl border border-border bg-bg-card p-6 shadow-panel">
          <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-secondary">
            Latest Analysis Snapshot
          </h3>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold text-text-primary">{analysis.riskScore}/10</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                Risk Score
              </p>
            </div>
            <div className="h-10 w-px bg-border" />
            <div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase ${
                  analysis.eligibilityStatus === "LIKELY_ELIGIBLE"
                    ? "bg-state-success/10 text-state-success"
                    : analysis.eligibilityStatus === "LIKELY_INELIGIBLE"
                      ? "bg-state-error/10 text-state-error"
                      : "bg-state-warning/10 text-state-warning"
                }`}
              >
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    analysis.eligibilityStatus === "LIKELY_ELIGIBLE"
                      ? "bg-state-success"
                      : analysis.eligibilityStatus === "LIKELY_INELIGIBLE"
                        ? "bg-state-error"
                        : "bg-state-warning"
                  }`}
                />
                {analysis.eligibilityStatus === "LIKELY_ELIGIBLE"
                  ? "Bail Recommended"
                  : analysis.eligibilityStatus === "LIKELY_INELIGIBLE"
                    ? "Bail Not Recommended"
                    : "Discretionary"}
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {analysis.recommendation}
          </p>
        </div>
      )}

      {/* No analysis empty state */}
      {!analysis && (
        <div className="rounded-xl border border-dashed border-border bg-bg-card/50 p-8 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-text-secondary/40">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="mt-3 text-sm font-medium text-text-secondary">
            No analysis yet
          </p>
          <p className="mt-1 text-xs text-text-secondary/60">
            Run an AI analysis to get bail eligibility assessment, risk breakdown, and legal reasoning.
          </p>
        </div>
      )}
    </div>
  );
}
