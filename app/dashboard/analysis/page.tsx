"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CaseAnalysis } from "@/lib/analysis-types";
import { VerdictGauge } from "@/components/analysis/VerdictGauge";
import { RiskFactors } from "@/components/analysis/RiskFactors";
import { LegalReasoning } from "@/components/analysis/LegalReasoning";
import { ApplicableSections } from "@/components/analysis/ApplicableSections";
import { Precedents } from "@/components/analysis/Precedents";
import { Recommendations } from "@/components/analysis/Recommendations";
import { Button } from "@/components/ui/button";

export default function AnalysisPage() {
  const router = useRouter();
  const [data, setData] = useState<{ caseDescription: string; analysis: CaseAnalysis; caseId?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("jurisight_analysis");
    if (!stored) {
      router.push("/dashboard");
      return;
    }
    try {
      setData(JSON.parse(stored));
    } catch (e) {
      router.push("/dashboard");
    }
  }, [router]);

  if (!data) return null;

  const { analysis } = data;

  const handleShare = () => {
    if (!data.caseId) return;
    const url = `${window.location.origin}/share/${data.caseId}`;

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
  };

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
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {data.caseId && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleShare}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>
              </svg>
              {copied ? "Copied!" : "Share"}
            </Button>
          )}
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
