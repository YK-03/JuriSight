"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CaseAnalysis } from "@/lib/analysis-types";

export default function AnalysisPage() {
  const router = useRouter();
  const [data, setData] = useState<{ caseDescription: string; analysis: CaseAnalysis } | null>(null);

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
  const score = analysis.riskScore;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "Favorable": return "bg-green-500/10 text-green-600 border-green-200";
      case "Unfavorable": return "bg-red-500/10 text-red-600 border-red-200";
      case "Mixed": return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "High": return "bg-red-100 text-red-800 hover:bg-red-200";
      case "Medium": return "bg-amber-100 text-amber-800 hover:bg-amber-200";
      case "Low": return "bg-green-100 text-green-800 hover:bg-green-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <Link 
          href="/dashboard" 
          className="text-sm text-gray-500 hover:text-[#B8952A] transition-colors flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to dashboard
        </Link>
        <Badge variant="outline" className={`px-3 py-1 text-sm font-semibold border ${getVerdictColor(analysis.verdict)}`}>
          {analysis.verdict} Verdict
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Analysis Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
            {analysis.biasWarning && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex gap-3 items-start text-red-800 text-sm">
                <svg className="w-5 h-5 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                <p>{analysis.biasWarning}</p>
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {analysis.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-700">
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#B8952A] shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100 flex flex-col items-center justify-center p-6 text-center">
          <h3 className="font-semibold text-gray-900 mb-6">Risk Score</h3>
          <div className="relative w-48 h-24 overflow-hidden mb-2">
            <svg viewBox="0 0 100 50" className="w-full h-full overflow-visible">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke={score > 70 ? "#ef4444" : score > 30 ? "#f59e0b" : "#22c55e"}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
              <span className="text-4xl font-black text-gray-900">{score}</span>
              <span className="text-xs text-gray-500 font-medium mt-1">out of 100</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="text-lg">Overview & Risk Factors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {analysis.riskFactors.map((factor, i) => (
                <li key={i} className="flex flex-col gap-1.5 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{factor.label}</span>
                    <Badge variant="outline" className={getSeverityColor(factor.severity)}>
                      {factor.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{factor.description}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="text-lg">Legal Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm text-gray-700 whitespace-pre-wrap">
              {analysis.legalReasoning}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="text-lg">Applicable Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {analysis.applicableSections.map((sec, i) => (
                <li key={i} className="flex flex-col gap-1.5 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-[#B8952A]">{sec.code}</span>
                    <span className="font-medium text-gray-900">{sec.title}</span>
                  </div>
                  <p className="text-sm text-gray-600">{sec.relevance}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-gray-100">
          <CardHeader>
            <CardTitle className="text-lg">Precedents</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {analysis.precedents.map((prec, i) => (
                <li key={i} className="flex flex-col gap-1.5 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-gray-900">{prec.case}</span>
                    <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{prec.citation}</span>
                  </div>
                  <p className="text-sm text-gray-600">{prec.relevance}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <footer className="pt-8 pb-4 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
          AI-generated. Verify with a licensed advocate.
        </p>
      </footer>
    </div>
  );
}
