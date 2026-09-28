import type { CaseAnalysis } from "@/lib/analysis-types";
import { normalizePrecedents, type Precedent } from "@/lib/precedents";

export type BailApplicationCaseData = {
  title: string;
  accusedName: string;
  section: string;
  offenseType: string;
  accusedProfile: string;
  priorRecord: boolean;
  offenseDescription: string;
  cooperationLevel: string;
  jurisdiction: string;
  bailType?: string | null;
  proceduralStage?: string | null;
  custodyStatus?: string | null;
  previousBail?: string | null;
};

export type BailApplicationAnalysis = Pick<
  CaseAnalysis,
  "verdict" | "riskScore" | "summary" | "riskFactors" | "legalReasoning" | "applicableSections" | "precedents" | "recommendations"
>;

export type BailApplicationValidation = {
  missing: string[];
  analysis: BailApplicationAnalysis | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isAnalysis(value: unknown): value is BailApplicationAnalysis {
  if (!isRecord(value)) return false;
  return (
    (value.verdict === "Favorable" || value.verdict === "Unfavorable" || value.verdict === "Mixed") &&
    typeof value.riskScore === "number" &&
    nonEmpty(value.summary) &&
    Array.isArray(value.riskFactors) &&
    nonEmpty(value.legalReasoning) &&
    Array.isArray(value.applicableSections) &&
    Array.isArray(value.precedents) &&
    Array.isArray(value.recommendations)
  );
}

export function validateBailApplicationInput(
  caseData: BailApplicationCaseData,
  rawAnalysis: unknown,
): BailApplicationValidation {
  const missing: string[] = [];
  const requiredCaseFields: Array<[keyof BailApplicationCaseData, string]> = [
    ["title", "case title"],
    ["accusedName", "accused name"],
    ["section", "statutory section(s)"],
    ["offenseType", "offence type"],
    ["offenseDescription", "case facts / offence description"],
    ["jurisdiction", "jurisdiction"],
  ];

  for (const [field, label] of requiredCaseFields) {
    if (!nonEmpty(caseData[field])) missing.push(label);
  }

  if (!isAnalysis(rawAnalysis)) {
    missing.push("completed structured analysis");
  }

  return { missing, analysis: isAnalysis(rawAnalysis) ? rawAnalysis : null };
}

function clean(value: unknown, fallback = "Not provided") {
  return nonEmpty(value) ? value.trim() : fallback;
}

function bulletLines(values: string[]) {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- Not provided in the analysis.";
}

function uniqueSections(caseSection: string, analysisSections: BailApplicationAnalysis["applicableSections"]) {
  const values = [
    ...caseSection.split(/[,\n]+/).map((value) => value.trim()),
    ...analysisSections.map((section) => section.code.trim()),
  ].filter(Boolean);
  return [...new Set(values)];
}

function curatedPrecedents(precedents: Precedent[]) {
  return normalizePrecedents(precedents).filter((precedent) => precedent.provenance === "curated");
}

export function buildBailApplicationDocument(
  caseData: BailApplicationCaseData,
  analysis: BailApplicationAnalysis,
): string {
  const sections = uniqueSections(caseData.section, analysis.applicableSections);
  const precedents = curatedPrecedents(analysis.precedents);
  const precedentText = precedents.length > 0
    ? precedents.map((precedent) => {
      const source = precedent.searchLink ? `\n  Source: ${precedent.searchLink}` : "";
      return `- ${precedent.case}: ${precedent.principle}${source}`;
    }).join("\n")
    : "- No curated precedent was retrieved for this matter.";

  return `BAIL APPLICATION WORKING DRAFT

AI-GENERATED. VERIFY WITH A LICENSED ADVOCATE.
This is a preparation draft, not a court filing or a legal opinion. It contains only the case information and analysis currently stored in JuriSight.

IN THE COMPETENT COURT HAVING JURISDICTION OVER: ${clean(caseData.jurisdiction)}

MATTER
${clean(caseData.title)}

APPLICANT / ACCUSED
${clean(caseData.accusedName)}

REQUEST
The applicant seeks ${clean(caseData.bailType, "appropriate bail relief")}. The precise relief, court caption, procedural provisions, and filing format must be completed and verified by counsel against the court record.

FACTUAL INFORMATION PROVIDED BY THE USER
- Offence type: ${clean(caseData.offenseType)}
- Statutory section(s) recorded at intake: ${clean(caseData.section)}
- Accused profile: ${clean(caseData.accusedProfile)}
- Prior criminal record: ${caseData.priorRecord ? "Prior record indicated" : "No prior record indicated"}
- Custody status: ${clean(caseData.custodyStatus)}
- Procedural stage: ${clean(caseData.proceduralStage)}
- Cooperation with investigation: ${clean(caseData.cooperationLevel)}
- Previous bail history: ${clean(caseData.previousBail)}

FACTUAL BACKGROUND
${clean(caseData.offenseDescription)}

APPLICABLE STATUTORY SECTIONS
${sections.length > 0 ? sections.map((section) => `- ${section}`).join("\n") : "- No applicable section was recorded."}

CURATED PRECEDENTS RETRIEVED FOR THIS MATTER
${precedentText}

ANALYSIS SUMMARY
${clean(analysis.summary)}

DETERMINISTIC / STRUCTURED OUTCOME
- Verdict: ${analysis.verdict}
- Risk score: ${analysis.riskScore} / 100
- Applicable sections above include the preserved intake sections and structured analysis sections.

AI-GENERATED LEGAL REASONING FOR COUNSEL REVIEW
${clean(analysis.legalReasoning)}

ANALYSIS RISK FACTORS
${bulletLines(analysis.riskFactors.map((factor) => `${factor.label}: ${factor.description} (${factor.severity})`))}

RECOMMENDATIONS FOR COUNSEL REVIEW
${bulletLines(analysis.recommendations)}

DOCUMENT BOUNDARY
This draft does not add facts, dates, names, citations, procedural history, statutory provisions, or court-specific formatting that are not present in the stored case and analysis. Counsel must verify every factual and legal statement before use.
`;
}

