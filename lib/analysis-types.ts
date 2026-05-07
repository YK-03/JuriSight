import type { Analysis } from "@prisma/client";
import { buildSearchLink, normalizePrecedents, type Precedent } from "@/lib/precedents";

export type AnalysisView = {
  id: string;
  eligibility: "ELIGIBLE" | "NOT_ELIGIBLE" | "UNCERTAIN";
  riskScore: number;
  legalBasis: string;
  reasoning: string;
  riskFactors: { label: string; value: number }[];
  conditions: string[];
  precedents: Array<Precedent & { similarity?: number }>;
  biasWarning?: string;
  createdAt: string;
};

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
  const normalized = value.toUpperCase();
  if (["LOW", "WEAK"].includes(normalized)) return 25;
  if (["MEDIUM", "MODERATE"].includes(normalized)) return 55;
  if (["HIGH", "STRONG"].includes(normalized)) return 80;
  if (normalized === "SEVERE") return 95;
  return 50;
}

function mapEligibility(status: string): "ELIGIBLE" | "NOT_ELIGIBLE" | "UNCERTAIN" {
  if (status === "LIKELY_ELIGIBLE") return "ELIGIBLE";
  if (status === "LIKELY_INELIGIBLE") return "NOT_ELIGIBLE";
  return "UNCERTAIN";
}

export function mapPrismaAnalysis(a: Analysis): AnalysisView {
  const rf = a.riskFactors as unknown as RiskFactors;
  const lb = a.legalBasis as unknown as LegalBasis;

  const legalBasisText = [
    `Classification: ${lb.classification === "NON_BAILABLE" ? "Non-Bailable Offense" : "Bailable Offense"}.`,
    `Primary Section: ${lb.primarySection || a.applicableSections[0] || "N/A"}.`,
    lb.applicableSections.length > 0 ? `Applicable Laws: ${lb.applicableSections.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const precedentsRaw = a.precedents as unknown as Array<{
    case?: string;
    caseName?: string;
    title?: string;
    principle?: string;
    reason?: string;
    summary?: string;
    relevance?: string;
    searchLink?: string;
    similarity?: number;
  }> | null;

  const normalizedPrecedents = normalizePrecedents(precedentsRaw);

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
    precedents: normalizedPrecedents.map((precedent, index) => ({
      ...precedent,
      searchLink: precedent.searchLink || buildSearchLink(precedent.case),
      similarity: precedentsRaw?.[index]?.similarity,
    })),
    biasWarning: a.biasWarning ?? undefined,
    createdAt: a.createdAt.toISOString(),
  };
}

export type Severity = "High" | "Medium" | "Low";
export type Verdict = "Favorable" | "Unfavorable" | "Mixed";

export interface CaseAnalysis {
  verdict: Verdict;
  riskScore: number;
  summary: string;
  riskBreakdown?: {
    base: number;
    riskContribution: number;
    strengthReduction: number;
    finalScore: number;
  } | null;
  analysis?: string[];
  risks?: Array<{
    text: string;
    level: "LOW" | "MEDIUM" | "HIGH";
  }>;
  strengths?: Array<{
    text: string;
    impact: "LOW" | "MEDIUM" | "HIGH";
  }>;
  grounds?: string[];
  courtNote?: string;
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
  precedents: Precedent[];
  recommendations: string[];
  biasWarning: string | null;
}

export interface AnalyzeRequest {
  caseTitle?: string;
  whatHappened?: string;
  when?: string;
  incidentDate?: string;
  where?: string;
  incidentLocation?: string;
  people?: string;
  partiesInvolved?: string;
  stage?: string;
  proceduralStage?: string;
  evidence?: string;
  evidenceDetails?: string;
  questions?: string;
  legalQuestions?: string;
  caseDescription?: string;
  caseId?: string;
}

export interface AnalyzeResponse {
  success?: boolean;
  analysis?: CaseAnalysis;
  error?: string;
}
