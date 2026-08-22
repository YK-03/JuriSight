"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CaseAnalysis } from "@/lib/analysis-types";
import { VerdictGauge } from "@/components/analysis/VerdictGauge";
import { RiskFactors } from "@/components/analysis/RiskFactors";
import { LegalReasoning } from "@/components/analysis/LegalReasoning";
import { ApplicableSections } from "@/components/analysis/ApplicableSections";
import { Precedents } from "@/components/analysis/Precedents";
import { Recommendations } from "@/components/analysis/Recommendations";

export default function SharePage() {
  const params = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null);
  const [caseTitle, setCaseTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;

    const fetchSharedCase = async () => {
      try {
        const res = await fetch(`/api/share/${params.id}`, { cache: "no-store" });
        if (!res.ok) {
          setError("This analysis is not available or has been removed.");
          return;
        }

        const data = await res.json();
        setCaseTitle(data.title || "");

        if (data.analysis?.rawAnalysis) {
          setAnalysis(data.analysis.rawAnalysis as CaseAnalysis);
        } else {
          setError("No analysis data found.");
        }
      } catch {
        setError("Failed to load shared analysis.");
      } finally {
        setLoading(false);
      }
    };

    void fetchSharedCase();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary text-text-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent-gold" />
          <p className="text-sm text-text-secondary">Loading shared analysis…</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-primary text-text-primary">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-secondary text-text-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
            </svg>
          </div>
          <p className="text-sm text-text-secondary">{error || "Analysis not found."}</p>
          <Link
            href="/"
            className="text-sm text-accent-gold hover:underline"
          >
            Go to JuriSight →
          </Link>
        </div>
      </div>
    );
  }

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "Favorable":
        return "bg-state-success/10 text-state-success border border-state-success/30";
      case "Unfavorable":
        return "bg-state-error/10 text-state-error border border-state-error/30";
      case "Mixed":
      default:
        return "bg-state-warning/10 text-state-warning border border-state-warning/30";
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-bg-primary text-text-primary min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>
          </svg>
          <span>Shared Analysis{caseTitle ? ` — ${caseTitle}` : ""}</span>
        </div>
        <Badge
          variant="outline"
          className={`text-xs font-semibold tracking-widest px-3 py-1 rounded-full ${getVerdictColor(analysis.verdict)}`}
        >
          {`${analysis.verdict || "Unknown"} VERDICT`}
        </Badge>
      </div>

      <VerdictGauge
        verdict={analysis.verdict}
        riskScore={analysis.riskScore}
        summary={analysis.summary}
        biasWarning={analysis.biasWarning}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RiskFactors riskFactors={analysis.riskFactors} />
        <LegalReasoning legalReasoning={analysis.legalReasoning} />
        <ApplicableSections sections={analysis.applicableSections} />
        <Precedents precedents={analysis.precedents} />
      </div>

      <Recommendations recommendations={analysis.recommendations} />

      <footer className="pt-8 pb-4 text-center space-y-2">
        <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold">
          AI-generated. Verify with a licensed advocate.
        </p>
        <Link
          href="/"
          className="inline-block text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          Powered by JuriSight
        </Link>
      </footer>
    </div>
  );
}
