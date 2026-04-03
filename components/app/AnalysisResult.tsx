"use client";

import type { Analysis } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskScoreGauge } from "@/components/app/RiskScoreGauge";
import { useLanguage } from "@/lib/language-context";

type RiskFactors = {
  flightRisk: "LOW" | "MEDIUM" | "HIGH";
  offenseSeverity: "LOW" | "MODERATE" | "HIGH" | "SEVERE";
  evidenceTampering: "LOW" | "MEDIUM" | "HIGH";
  communityTies: "WEAK" | "MODERATE" | "STRONG";
};

type LegalBasis = {
  classification: "BAILABLE" | "NON_BAILABLE";
  applicableSections: string[];
  primarySection: string;
};

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="8" />
    <line x1="12" y1="12" x2="12" y2="16" />
  </svg>
);

const confidenceMap = {
  HIGH: "High confidence - strong precedent match, consistent risk indicators",
  MEDIUM: "Moderate confidence - limited precedent match, some conflicting indicators",
  LOW: "Low confidence - insufficient data, conflicting risk signals",
} as const;

const outcomeMap = {
  LIKELY_ELIGIBLE: {
    title: "Bail Recommended",
    subtitle: "Strong grounds for grant",
    color: "#0E9F6E",
  },
  BORDERLINE: {
    title: "Conditional Bail (Discretionary)",
    subtitle: "Judicial discretion advised",
    color: "#D97706",
  },
  LIKELY_INELIGIBLE: {
    title: "Bail Not Recommended",
    subtitle: "Significant risk factors present",
    color: "#DC2626",
  },
} as const;

const tooltipMap = {
  flightRisk: "Likelihood of absconding before trial",
  evidenceTampering: "Risk of interfering with witnesses or evidence",
  communityTies: "Strength of roots in local community",
  offenseSeverity: "Gravity of alleged offense under applicable law",
} as const;

function riskWeight(value: string): number {
  if (["LOW", "STRONG"].includes(value)) return 33;
  if (["MEDIUM", "MODERATE"].includes(value)) return 66;
  return 100;
}

function riskColor(value: string): string {
  if (["LOW", "STRONG"].includes(value)) return "#0E9F6E";
  if (["MEDIUM", "MODERATE"].includes(value)) return "#D97706";
  return "#DC2626";
}

function lawChips(sections: string[]): string[] {
  const chips = new Set<string>();
  sections.forEach((s) => {
    const x = s.toLowerCase();
    if (x.includes("crpc")) chips.add("CrPC");
    if (x.includes("bnss") || x.includes("bss")) chips.add("BSS 2023");
    if (x.includes("ipc")) chips.add("IPC");
    if (x.includes("bns")) chips.add("BNS 2023");
    if (x.includes("act")) chips.add("Special Acts");
  });
  if (chips.size === 0) chips.add("CrPC");
  return Array.from(chips);
}

export function AnalysisResult({ analysis }: { analysis: Analysis }) {
  const { t } = useLanguage();
  const riskFactors = analysis.riskFactors as unknown as RiskFactors;
  const legalBasis = analysis.legalBasis as unknown as LegalBasis;
  const outcome = outcomeMap[analysis.eligibilityStatus];
  const confidenceExplanation = analysis.confidenceExplanation || confidenceMap[analysis.confidenceLevel];

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col justify-between gap-6 p-6 md:flex-row">
          <div>
            <p className="text-2xl font-bold" style={{ color: outcome.color }}>{outcome.title}</p>
            <p className="mt-1 text-sm text-[#8898AA]">{outcome.subtitle}</p>
          </div>
          <div className="flex items-center gap-6">
            <RiskScoreGauge score={analysis.riskScore} />
            <p className="max-w-[260px] text-[13px] italic text-[#8898AA]">{confidenceExplanation}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-[3px] border-l-[#7C3AED]">
        <CardHeader><CardTitle className="font-mono text-[11px] uppercase text-[#8898AA]">LEGAL BASIS</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between"><span>Applicable Section</span><span className="font-medium">{legalBasis.primarySection || analysis.applicableSections[0] || "CrPC S.437"}</span></div>
          <div className="flex items-center justify-between"><span>Classification</span><Badge variant={legalBasis.classification === "NON_BAILABLE" ? "error" : "success"}>{legalBasis.classification === "NON_BAILABLE" ? "Non-Bailable Offense" : "Bailable Offense"}</Badge></div>
          <div className="flex flex-wrap gap-2">{lawChips(legalBasis.applicableSections || analysis.applicableSections).map((law) => <Badge key={law} variant="outline">{law}</Badge>)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("riskAssessment")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {([
              ["Flight Risk", "flightRisk", riskFactors.flightRisk],
              ["Evidence Tampering", "evidenceTampering", riskFactors.evidenceTampering],
              ["Community Ties", "communityTies", riskFactors.communityTies],
              ["Offense Severity", "offenseSeverity", riskFactors.offenseSeverity],
            ] as const).map(([label, key, value]) => (
              <div key={label} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-[#8898AA]">{label}</span>
                  <span title={tooltipMap[key]} className="cursor-help text-xs text-[#8898AA]"><InfoIcon /></span>
                </div>
                <div className="mb-2 inline-flex rounded px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${riskColor(value)}20`, color: riskColor(value) }}>{value}</div>
                <div className="h-1 w-full rounded bg-[#E3E8EF]">
                  <div className="h-1 rounded" style={{ width: `${riskWeight(value)}%`, backgroundColor: riskColor(value) }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("keyFactors")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border-l-4 border-l-[#0E9F6E] bg-[#F0FDF4] p-4">
            <p className="mb-2 text-[13px] font-medium text-[#0E9F6E]">Supporting Bail</p>
            <ul className="space-y-2">
              {analysis.positiveFactors.map((f, i) => (
                <li key={`${f}-${i}`} className="flex items-start gap-2 text-sm text-[#425466]"><span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "currentColor", display: "inline-block", flexShrink: 0, marginTop: 6 }} />{f}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border-l-4 border-l-[#DC2626] bg-[#FEF2F2] p-4">
            <p className="mb-2 text-[13px] font-medium text-[#DC2626]">Against Bail</p>
            <ul className="space-y-2">
              {analysis.negativeFactors.map((f, i) => (
                <li key={`${f}-${i}`} className="flex items-start gap-2 text-sm text-[#425466]"><span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "currentColor", display: "inline-block", flexShrink: 0, marginTop: 6 }} />{f}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("legalReasoning")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[15px] leading-7 text-[#425466]">{analysis.reasoning}</p>
          <div className="rounded-lg bg-[#EDE9FE] p-4">
            <p className="mb-2 font-mono text-[10px] uppercase text-[#7C3AED]">DECISION LOGIC</p>
            <p className="text-sm leading-7 text-[#5C5248]">{confidenceExplanation}. The strongest drivers were {riskFactors.offenseSeverity.toLowerCase()} offense severity and {riskFactors.flightRisk.toLowerCase()} flight risk.</p>
          </div>
        </CardContent>
      </Card>

      {analysis.eligibilityStatus !== "LIKELY_INELIGIBLE" && analysis.suggestedConditions.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>{t("suggestedConditions")}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {analysis.suggestedConditions.map((c, i) => (
              <span key={`${c}-${i}`} className="rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-3 py-1.5 text-[13px] font-medium text-[#166534]">{c}</span>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
