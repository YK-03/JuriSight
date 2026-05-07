"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CaseAnalysis } from "@/lib/analysis-types";
import { VerdictGauge } from "@/components/analysis/VerdictGauge";
import { RiskFactors } from "@/components/analysis/RiskFactors";
import { LegalReasoning } from "@/components/analysis/LegalReasoning";
import { ApplicableSections } from "@/components/analysis/ApplicableSections";
import { Precedents } from "@/components/analysis/Precedents";
import { Recommendations } from "@/components/analysis/Recommendations";

export default function CaseAnalysisPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<CaseAnalysis | null>(null);
  const [caseId, setCaseId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!params.id) return;

    const fetchCase = async () => {
      try {
        const res = await fetch(`/api/cases/${params.id}`, { cache: "no-store" });
        if (!res.ok) {
          setError("Case not found");
          return;
        }

        const data = await res.json();
        setCaseId(data.id);

        // rawAnalysis stores the CaseAnalysis object as-is
        if (data.analysis?.rawAnalysis) {
          setAnalysis(data.analysis.rawAnalysis as CaseAnalysis);
        } else {
          setError("No analysis data found for this case.");
        }
      } catch {
        setError("Failed to load case analysis.");
      } finally {
        setLoading(false);
      }
    };

    void fetchCase();
  }, [params.id]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/share/${caseId}`;

    if (typeof navigator.share === "function") {
      navigator.share({
        title: "JuriSight Case Analysis",
        text: "Check out this legal case analysis on JuriSight",
        url,
      }).catch(() => {
        navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading analysis…</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">{error || "Analysis not found."}</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "Favorable":
        return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800";
      case "Unfavorable":
        return "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800";
      case "Mixed":
      default:
        return "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800";
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-gray-50 dark:bg-gray-950 min-h-screen">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm flex items-center gap-1 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="relative flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>
            </svg>
            {copied ? "Copied!" : "Share"}
          </button>
          <Badge
            variant="outline"
            className={`text-xs font-semibold tracking-widest px-3 py-1 rounded-full ${getVerdictColor(analysis.verdict)}`}
          >
            {`${analysis.verdict || "Unknown"} VERDICT`}
          </Badge>
        </div>
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

      <footer className="pt-8 pb-4 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">
          AI-generated. Verify with a licensed advocate.
        </p>
      </footer>
    </div>
  );
}
