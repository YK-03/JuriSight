import type { Analysis } from "@prisma/client";

/* ── public view model ─────────────────────────────────────────────── */
export type AnalysisView = {
  id: string;
  eligibility: "ELIGIBLE" | "NOT_ELIGIBLE" | "UNCERTAIN";
  riskScore: number; // 0–100
  legalBasis: string;
  reasoning: string;
  riskFactors: { label: string; value: number }[];
  conditions: string[];
  precedents: { title: string; summary: string; similarity?: number }[];
  biasWarning?: string;
  createdAt: string;
};

/* ── helpers ────────────────────────────────────────────────────────── */
type RiskFactors = {
  flightRisk: string;
  offenseSeverity: string;
  evidenceTampering: string;
  communityTies: string;
};

type LegalBasis = {
  classification: string;
  applicableSections: string[];
  primarySection: string;
};

function levelToPercent(value: string): number {
  const v = value.toUpperCase();
  if (["LOW", "WEAK"].includes(v)) return 25;
  if (["MEDIUM", "MODERATE"].includes(v)) return 55;
  if (["HIGH", "STRONG"].includes(v)) return 80;
  if (v === "SEVERE") return 95;
  return 50;
}

function mapEligibility(
  status: string,
): "ELIGIBLE" | "NOT_ELIGIBLE" | "UNCERTAIN" {
  if (status === "LIKELY_ELIGIBLE") return "ELIGIBLE";
  if (status === "LIKELY_INELIGIBLE") return "NOT_ELIGIBLE";
  return "UNCERTAIN";
}

/* ── adapter ────────────────────────────────────────────────────────── */
export function mapPrismaAnalysis(a: Analysis): AnalysisView {
  const rf = a.riskFactors as unknown as RiskFactors;
  const lb = a.legalBasis as unknown as LegalBasis;

  const legalBasisText = [
    `Classification: ${lb.classification === "NON_BAILABLE" ? "Non-Bailable Offense" : "Bailable Offense"}.`,
    `Primary Section: ${lb.primarySection || a.applicableSections[0] || "N/A"}.`,
    lb.applicableSections.length > 0
      ? `Applicable Laws: ${lb.applicableSections.join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const precedentsRaw = a.precedents as unknown as
    | { caseName?: string; title?: string; reason?: string; summary?: string; court?: string; year?: number; similarity?: number }[]
    | null;

  return {
    id: a.id,
    eligibility: mapEligibility(a.eligibilityStatus),
    riskScore: Math.min(100, Math.max(0, a.riskScore * 10)),
    legalBasis: legalBasisText,
    reasoning: a.reasoning,
    riskFactors: [
      { label: "Flight Risk", value: levelToPercent(rf.flightRisk) },
      { label: "Offense Severity", value: levelToPercent(rf.offenseSeverity) },
      { label: "Evidence Tampering", value: levelToPercent(rf.evidenceTampering) },
      { label: "Community Ties", value: levelToPercent(rf.communityTies) },
    ],
    conditions: a.suggestedConditions,
    precedents: (precedentsRaw ?? []).map((p) => ({
      title: p.caseName ?? p.title ?? "Untitled",
      summary: p.reason ?? p.summary ?? "",
      similarity: p.similarity,
    })),
    biasWarning: a.biasWarning ?? undefined,
    createdAt: a.createdAt.toISOString(),
  };
}

/* ── new analysis flow types ────────────────────────────────────────── */

export type Severity = "High" | "Medium" | "Low";
export type Verdict = "Favorable" | "Unfavorable" | "Mixed";

export interface CaseAnalysis {
  verdict: Verdict;
  riskScore: number;
  summary: string;
  riskFactors: Array<{
    label: string;
    severity: Severity;
    description: string;
  }>;
  legalReasoning: string;
  applicableSections: Array<{
    code: string;
    title: string;
    relevance: string;
  }>;
  precedents: Array<{
    case: string;
    citation: string;
    relevance: string;
  }>;
  recommendations: string[];
  biasWarning: string | null;
}

export interface AnalyzeRequest {
  caseDescription?: string;
  caseId?: string;
}

export interface AnalyzeResponse {
  analysis?: CaseAnalysis;
  error?: string;
}
