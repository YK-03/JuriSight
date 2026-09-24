import { NextResponse } from "next/server";
import { generateAIResponse, extractJsonBlock } from "@/lib/groq";
import {
  ConfidenceLevel,
  EligibilityStatus,
  OffenseSeverity,
  Prisma,
  RiskLevel,
} from "@prisma/client";
import { AnalyzeRequest, CaseAnalysis } from "@/lib/analysis-types";
import db from "@/lib/db";
import { buildFallbackPrecedents, normalizePrecedents } from "@/lib/precedents";
import { getOrCreateUser } from "@/lib/user-sync";
import { runLegalRules, LegalRuleInput, type LegalRuleOutput } from "@/lib/legal-rules";
import {
  formatAuthoritativeSectionsBlock,
  mergeApplicableSections,
  parseSuppliedSections,
} from "@/lib/section-preservation";
import {
  buildCaseSpecificGroundingCorpus,
  normalizeRiskFactors,
  toAnalysisRiskFactors,
} from "@/lib/risk-factors";
import { resolveLegalReasoning } from "@/lib/analysis-source-of-truth";
import {
  parseCustodyDaysForRules,
} from "@/lib/case-intake";
import { resolveLegalFramework } from "@/lib/legal-framework";

export const runtime = "nodejs";

function extractSections(input: string) {
  const match = input.match(/(?:sections?|under)[^\w]*([\w\d\s,\.-]+)/i);
  return match ? match[1].trim().slice(0, 50) : "Not specified";
}

function detectStage(input: string) {
  const lower = input.toLowerCase();
  if (lower.includes("charge sheet") || lower.includes("chargesheet") || lower.includes("charge-sheet")) return "Charge Sheet Filed";
  if (lower.includes("fir") || lower.includes("complaint")) return "FIR Filed / Pre-Charge Sheet";
  if (lower.includes("trial") || lower.includes("hearing")) return "Trial Ongoing";
  if (lower.includes("investigation") || lower.includes("inquiry")) return "Investigation Stage";
  return "Unknown";
}

function detectCustody(input: string) {
  const lower = input.toLowerCase();
  if (lower.match(/custody for \d+|arrested on|in jail since|remand/)) return "In Custody";
  if (lower.includes("anticipatory") || lower.includes("apprehension of arrest")) return "Not Arrested (Anticipatory)";
  return "Unknown";
}

function extractKeyFacts(input: string) {
  if (!input || input.trim().length === 0) return ["No detailed facts provided"];
  const sentences = input.split(/(?<=[.!?])\s+/);
  const facts = sentences.slice(0, 4).map(s => s.trim()).filter(Boolean);
  return facts.length > 0 ? facts : ["No detailed facts provided"];
}

function normalizeCase(input: string) {
  return {
    sections: extractSections(input),
    stage: detectStage(input),
    custody: detectCustody(input),
    facts: extractKeyFacts(input),
  };
}

/** Determine whether a chargesheet has been filed from the procedural stage string. */
function isChargesheetFiled(proceduralStage: string): boolean {
  const lower = proceduralStage.toLowerCase();
  return (
    lower.includes("chargesheet") ||
    lower.includes("charge sheet") ||
    lower.includes("charge-sheet") ||
    lower.includes("trial") ||
    lower.includes("session") ||
    lower.includes("framing of charges")
  );
}


/**
 * Fully deterministic risk score calculation.
 * Uses ONLY stable form/DB intake values — NEVER AI-generated data.
 * Same intake fields always produce the exact same score.
 */
function calculateRiskScore(input: {
  offenseType?: string;
  previousBail?: string;
  custodyDuration?: string;
  accusedTags?: string[];
}): number {
  let score = 50;

  const offense = input.offenseType?.toLowerCase() || "";
  const previousBail = input.previousBail?.toLowerCase() || "";
  const custody = input.custodyDuration?.toLowerCase() || "";
  const tags = (input.accusedTags || []).map(t => t.toLowerCase());

  // OFFENSE SEVERITY
  if (offense.includes("non-bailable")) {
    score += 15;
  }

  // PREVIOUS BAIL REJECTION
  if (
    previousBail.includes("rejected") ||
    previousBail.includes("dismissed")
  ) {
    score += 10;
  }

  // CUSTODY DURATION
  if (custody.includes("1 to 6")) {
    score += 5;
  }

  if (custody.includes("over 6")) {
    score += 10;
  }

  // MITIGATING FACTORS
  if (tags.includes("first-time offender")) {
    score -= 8;
  }

  if (tags.includes("cooperated in investigation")) {
    score -= 10;
  }

  if (tags.includes("cooperated")) {
    score -= 10;
  }

  if (tags.includes("parity with co-accused")) {
    score -= 6;
  }

  if (tags.includes("local residence")) {
    score -= 4;
  }

  const final = Math.max(0, Math.min(100, score));

  console.log("DETERMINISTIC FORM SCORE:", {
    offense,
    previousBail,
    custody,
    tags,
    final,
  });

  return final;
}

function clampRiskScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function mapVerdictToEligibilityStatus(verdict: CaseAnalysis["verdict"]): EligibilityStatus {
  switch (verdict) {
    case "Favorable":
      return "LIKELY_ELIGIBLE";
    case "Unfavorable":
      return "LIKELY_INELIGIBLE";
    case "Mixed":
    default:
      return "BORDERLINE";
  }
}

function normalizeModelVerdict(value: unknown): CaseAnalysis["verdict"] {
  if (typeof value !== "string") {
    return "Mixed";
  }

  switch (value.trim().toLowerCase()) {
    case "high":
    case "favorable":
      return "Favorable";
    case "low":
    case "unfavorable":
      return "Unfavorable";
    case "moderate":
    case "mixed":
      return "Mixed";
    default:
      return "Mixed";
  }
}

function mapRiskScoreToConfidenceLevel(riskScore: number): ConfidenceLevel {
  if (riskScore <= 35 || riskScore >= 75) {
    return "HIGH";
  }

  if (riskScore <= 55) {
    return "MEDIUM";
  }

  return "LOW";
}

function mapRiskScoreToRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= 70) {
    return "HIGH";
  }

  if (riskScore >= 40) {
    return "MEDIUM";
  }

  return "LOW";
}

function mapRiskFactorsToOffenseSeverity(
  riskFactors: CaseAnalysis["riskFactors"],
  riskScore: number,
): OffenseSeverity {
  const hasHighRiskFactor = riskFactors.some((factor) => factor.severity === "High");
  const hasMediumRiskFactor = riskFactors.some((factor) => factor.severity === "Medium");

  if (hasHighRiskFactor && riskScore >= 80) {
    return "SEVERE";
  }

  if (hasHighRiskFactor) {
    return "HIGH";
  }

  if (hasMediumRiskFactor || riskScore >= 45) {
    return "MODERATE";
  }

  return "LOW";
}

function buildCaseDescriptionFromRecord(caseRecord: {
  title: string;
  offenseDescription: string;
  offenseType: string;
  accusedName: string;
  accusedProfile: string;
  section: string;
  cooperationLevel: string;
  jurisdiction: string;
  legalFramework: string | null;
  specialAct: string | null;
  maximumSentenceYears: number | null;
  timeServedDays: number | null;
  bailType?: string | null;
  proceduralStage?: string | null;
  custodyStatus?: string | null;
  previousBail?: string | null;
}) {
  return [
    `Case title: ${caseRecord.title}`,
    `Accused name: ${caseRecord.accusedName}`,
    `Offense type: ${caseRecord.offenseType}`,
    `Section reference: ${caseRecord.section}`,
    `Accused profile: ${caseRecord.accusedProfile}`,
    caseRecord.bailType ? `Bail type: ${caseRecord.bailType}` : "",
    caseRecord.proceduralStage
      ? `Procedural stage: ${caseRecord.proceduralStage}`
      : `Procedural stage: ${caseRecord.cooperationLevel}`,
    `Cooperation level: ${caseRecord.cooperationLevel}`,
    caseRecord.custodyStatus ? `Custody status: ${caseRecord.custodyStatus}` : "",
    caseRecord.previousBail ? `Previous bail history: ${caseRecord.previousBail}` : "",
    `Jurisdiction: ${caseRecord.jurisdiction}`,
    caseRecord.legalFramework ? `Legal framework: ${caseRecord.legalFramework}` : "",
    caseRecord.specialAct ? `Special Act: ${caseRecord.specialAct}` : "",
    caseRecord.maximumSentenceYears !== null
      ? `Maximum sentence years: ${caseRecord.maximumSentenceYears}`
      : "",
    caseRecord.timeServedDays !== null ? `Time served days: ${caseRecord.timeServedDays}` : "",
    `Case facts: ${caseRecord.offenseDescription}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildAnalysisPersistenceData(caseId: string, analysis: CaseAnalysis, legalRules: LegalRuleOutput) {
  const riskScore = clampRiskScore(analysis.riskScore);
  const eligibilityStatus = mapVerdictToEligibilityStatus(analysis.verdict);
  const confidenceLevel = mapRiskScoreToConfidenceLevel(riskScore);
  const flightRisk = mapRiskScoreToRiskLevel(riskScore);
  const offenseSeverity = mapRiskFactorsToOffenseSeverity(analysis.riskFactors, riskScore);
  const applicableSectionCodes = analysis.applicableSections.map((section) => section.code);
  const positiveFactors = analysis.riskFactors
    .filter((factor) => factor.severity === "Low")
    .map((factor) => factor.label);
  const negativeFactors = analysis.riskFactors
    .filter((factor) => factor.severity !== "Low")
    .map((factor) => factor.label);

  return {
    caseId,
    eligibilityStatus,
    confidenceLevel,
    confidenceExplanation: analysis.summary,
    riskScore: riskScore,
    reasoning: analysis.legalReasoning,
    riskFactors: {
      flightRisk,
      offenseSeverity,
      evidenceTampering: analysis.riskFactors.some((factor) =>
        /tamper|witness|evidence/i.test(factor.label),
      )
        ? "MEDIUM"
        : "LOW",
      communityTies: analysis.riskFactors.some((factor) =>
        /family|community|residence|employment/i.test(factor.label),
      )
        ? "STRONG"
        : "MODERATE",
    },
    legalBasis: {
      classification: legalRules.offenseClass.supported
        ? (analysis.verdict === "Unfavorable" ? "NON_BAILABLE" : "BAILABLE")
        : "UNRESOLVED",
      applicableSections: applicableSectionCodes,
      primarySection: applicableSectionCodes[0] ?? "",
    },
    flightRisk,
    offenseSeverity,
    recommendation:
      analysis.recommendations[0] ??
      analysis.summary ??
      "Review the AI analysis alongside the full case record.",
    applicableSections: applicableSectionCodes,
    positiveFactors,
    negativeFactors,
    suggestedConditions: analysis.recommendations,
    precedents: analysis.precedents as unknown as Prisma.InputJsonValue,
    biasWarning: analysis.biasWarning,
    rawAnalysis: analysis as unknown as Prisma.InputJsonValue,
  };
}

async function persistAnalysis(caseId: string, analysis: CaseAnalysis, userId: string, legalRules: LegalRuleOutput) {
  const caseRecord = await db.case.findFirst({
    where: {
      id: caseId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!caseRecord) {
    throw new Error("Case not found for analysis persistence.");
  }

  const analysisData = buildAnalysisPersistenceData(caseId, analysis, legalRules);
  const { caseId: persistedCaseId, ...analysisUpdateData } = analysisData;

  await db.analysis.upsert({
    where: { caseId },
    update: analysisUpdateData,
    create: {
      ...analysisUpdateData,
      caseId: persistedCaseId,
    },
  });

  await db.case.update({
    where: { id: caseId },
    data: {
      status: "ANALYZED",
    },
  });
}


export async function POST(req: Request) {
  let body: AnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const requestedCaseId = typeof body.caseId === "string" && body.caseId.trim() ? body.caseId : null;
    let userIdForPersistence: string | null = null;
    let caseRecord: any = null;

    if (requestedCaseId) {
      const user = await getOrCreateUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userIdForPersistence = user.id;

      caseRecord = await db.case.findFirst({
        where: {
          id: requestedCaseId,
          userId: user.id,
        },
        select: {
          title: true,
          offenseDescription: true,
          offenseType: true,
          accusedName: true,
          accusedProfile: true,
          section: true,
          cooperationLevel: true,
          priorRecord: true,
          jurisdiction: true,
          legalFramework: true,
          specialAct: true,
          maximumSentenceYears: true,
          timeServedDays: true,
          bailType: true,
          proceduralStage: true,
          custodyStatus: true,
          previousBail: true,
        },
      });

      if (!caseRecord) {
        return NextResponse.json({ error: "Case not found" }, { status: 404 });
      }
    }

    if (!requestedCaseId) {
      const hasOffenseClassification =
        typeof body.offenseType === "string" && body.offenseType.trim().length > 0;
      const hasPriorRecord = typeof body.priorRecord === "boolean";

      if (!hasOffenseClassification || !hasPriorRecord) {
        return NextResponse.json(
          { error: "offenseType and priorRecord are required for direct analysis." },
          { status: 400 },
        );
      }
    }

    const caseTitle = body.caseTitle || caseRecord?.title || "Not specified";
    const stage = body.proceduralStage || body.stage || caseRecord?.proceduralStage || caseRecord?.cooperationLevel || "Unknown";
    const when = body.incidentDate || body.when || caseRecord?.timeServedDays?.toString() || "Not specified";
    const where = body.incidentLocation || body.where || caseRecord?.jurisdiction || "Not specified";
    const people = body.partiesInvolved || body.people || caseRecord?.accusedName || "Not specified";
    const evidence = body.evidenceDetails || body.evidence || "Not specified";
    const questions = body.legalQuestions || body.questions || "Not specified";
    
    let rawFacts = body.whatHappened || caseRecord?.offenseDescription || body.caseDescription || "";
    if (!rawFacts || rawFacts.trim().length < 20) {
      return NextResponse.json(
        { error: "Case facts must be at least 20 characters long." },
        { status: 400 },
      );
    }
    // Phase 2: retain up to 8000 chars — enough for any realistic case narrative.
    // This replaces the previous 500-char hard truncation that was discarding material facts.
    const whatHappened = rawFacts.length > 8000 ? rawFacts.slice(0, 8000) + "..." : rawFacts;

    // -------------------------------------------------------------------------
    // Phase 2: normalizeCase — supplement gaps where structured inputs are absent.
    // Results are used ONLY as fallbacks; Phase 1 structured DB fields take priority.
    // -------------------------------------------------------------------------
    const normalized = normalizeCase(rawFacts);

    // -------------------------------------------------------------------------
    // Phase 2: Resolve structured inputs for deterministic legal rule engine.
    // Priority: explicit body field > DB record field > normalizeCase inference.
    // -------------------------------------------------------------------------
    const resolvedSections = body.sections || caseRecord?.section || normalized.sections || "";
    const resolvedLegalFramework = resolveLegalFramework({
      explicit: body.legalFramework,
      persisted: caseRecord?.legalFramework,
      suppliedSections: resolvedSections,
    });
    const resolvedCustodyStr =
      body.custodyDuration ||
      caseRecord?.custodyStatus ||
      (caseRecord?.timeServedDays ? `${caseRecord.timeServedDays} days` : "") ||
      "";
    const resolvedProceduralStage =
      body.proceduralStage ||
      caseRecord?.proceduralStage ||
      normalized.stage ||
      "Unknown";

    // Parse the supplied sections string into:
    //   ruleIdentities  → statute-qualified deterministic inputs
    //   parsedSections  → legacy bare-code compatibility values
    //   suppliedSectionLabels → display labels preserving IPC/BNS prefix (e.g. ["IPC 420","BNS 318"])
    const {
      forRules: parsedSections,
      ruleIdentities: parsedRuleIdentities,
      suppliedRaw: suppliedSectionLabels,
      parsed: parsedSectionRecords,
    } = parseSuppliedSections(resolvedSections, resolvedLegalFramework);

    const parsedCustodyDays = parseCustodyDaysForRules(resolvedCustodyStr);
    const chargesheetFiled = isChargesheetFiled(resolvedProceduralStage);

    // -------------------------------------------------------------------------
    // Phase 2: Run deterministic legal rule engine.
    // -------------------------------------------------------------------------
    const legalRuleInput: LegalRuleInput = {
      sections: parsedRuleIdentities,
      custodyDays: parsedCustodyDays,
      chargesheetFiled,
      age: 25, // age not yet captured in intake; default to adult
      framework: resolvedLegalFramework,
    };
    const legalRules = runLegalRules(legalRuleInput);

    // -------------------------------------------------------------------------
    // Phase 2: Assemble structured case facts block from all Phase 1 fields.
    // This is passed verbatim to the prompt so every available fact reaches the LLM.
    // -------------------------------------------------------------------------
    const resolvedBailType = body.bailType || caseRecord?.bailType || "Not specified";
    const resolvedAccusedName = body.accusedName || caseRecord?.accusedName || people;
    const resolvedAccusedProfile =
      typeof body.accusedProfile === "string"
        ? body.accusedProfile.trim() || "Not specified"
        : caseRecord?.accusedProfile?.trim() || "Not specified";
    const resolvedPriorRecord =
      body.priorRecord === false || caseRecord?.priorRecord === false
        ? "No prior record"
        : body.priorRecord === true || caseRecord?.priorRecord === true
        ? "Has prior record"
        : "Not specified";
    const resolvedPreviousBail = body.previousBail || caseRecord?.previousBail || "Not specified";
    const resolvedCooperation = body.cooperationLevel || caseRecord?.cooperationLevel || "Not specified";
    const resolvedOffenseType = body.offenseType || caseRecord?.offenseType || "Not specified";

    const structuredCaseFacts = [
      `Title: ${caseTitle}`,
      `Accused Name: ${resolvedAccusedName}`,
      `Accused Profile: ${resolvedAccusedProfile}`,
      `Sections Charged: ${resolvedSections || "Not specified"}`,
      `Legal Framework: ${resolvedLegalFramework}`,
      `Offense Type: ${resolvedOffenseType}`,
      `Bail Type Sought: ${resolvedBailType}`,
      `Procedural Stage: ${resolvedProceduralStage}`,
      `Custody Duration: ${resolvedCustodyStr || "Not specified"}`,
      `Prior Criminal Record: ${resolvedPriorRecord}`,
      `Previous Bail History: ${resolvedPreviousBail}`,
      `Cooperation with Investigation: ${resolvedCooperation}`,
      `Timeline: ${when}`,
      `Location / Jurisdiction: ${where}`,
      `Evidence Details: ${evidence}`,
      `Legal Questions Raised: ${questions}`,
      `\nCase Narrative:\n${whatHappened}`,
    ].join("\n");

    const finalPrompt = `You are a senior criminal defense lawyer in India specializing in bail law.

Your task is to analyze the case and return a STRICT JSON response.

IMPORTANT: Do NOT generate any numeric scores. The backend calculates risk scores deterministically.
Only extract structured legal facts as described below.

-------------------------------------
OUTPUT FORMAT (MANDATORY)
-------------------------------------

{
  "eligibility": "High | Moderate | Low",
  "analysisSummary": "concise 2-3 sentence summary of the bail outlook",
  "riskFactors": [
    {
      "title": "short name of the risk (not a full sentence)",
      "description": "case-specific explanation of why this factor matters, using only supplied facts",
      "severity": "LOW | MEDIUM | HIGH"
    }
  ],
  "strengths": [
    { "text": "case-specific strength", "impact": "LOW | MEDIUM | HIGH" }
  ],
  "legalReasoning": "detailed paragraph explaining how the supplied case facts and deterministic legal findings support the qualitative assessment",
  "applicableSections": ["IPC Section 468"],
  "precedents": [
    {
      "case": "Sanjay Chandra v. CBI (2012)",
      "principle": "Bail should not be denied merely due to seriousness of allegations if trial will take time.",
      "appliedTo": "<specific fact from case e.g. alleged diversion of ₹X Crores>",
      "relevance": "<explicit connection: this fact → this principle → bail outcome>"
    },
    {
      "case": "State of Rajasthan v. Balchand (1977)",
      "principle": "Bail is the rule and jail is the exception",
      "appliedTo": "<specific fact from case e.g. no prior criminal record>",
      "relevance": "<explicit connection: this fact → this principle → bail outcome>"
    },
    {
      "case": "<third case relevant to this specific case type>",
      "principle": "<1-line principle>",
      "appliedTo": "<specific fact from this case>",
      "relevance": "<explicit connection>"
    }
  ],
  "recommendations": ["specific actionable recommendation"]
}

For each precedent:
- Provide a real Indian case name (prefer Supreme Court / High Court)
- Provide a concise legal principle
- Generate a searchLink using:
  https://indiankanoon.org/search/?formInput=<case name>
- Use URL encoding (spaces -> %20)
- Do NOT skip this field

-------------------------------------
FACT EXTRACTION RULES (CRITICAL)
-------------------------------------

- Do NOT return any numeric score fields (no riskScore, no riskBreakdown, no finalScore)
- The backend calculates risk scores from stable form inputs only
- Focus on extracting qualitative legal analysis: riskFactors, strengths, reasoning, precedents
- Eligibility is your qualitative assessment: "High", "Moderate", or "Low"
- riskFactors.title is a concise name (about 3–8 words). It is NOT a truncated sentence.
- riskFactors.description must explain why the factor exists, its legal/practical significance, or what the prosecution may argue. It must NOT restate the title.
- Ground every risk factor in the INPUT CASE facts and the deterministic findings above. Do not invent facts.
- Do not paraphrase the entire case narrative as a risk factor.
- Return 3 to 5 DISTINCT risk factors. Do not repeat the same underlying factor.

-------------------------------------
${legalRules.promptInjection}
-------------------------------------

${formatAuthoritativeSectionsBlock(suppliedSectionLabels)}

- Do NOT add procedural bail provisions (such as CrPC 438 or BNSS 482) to applicableSections.
  The backend adds the framework-appropriate procedural provisions based on the declared bail type.
- Do NOT replace or shrink the authoritative supplied section list.
  The backend always preserves those sections even if you omit them.
- In applicableSections, you may list additional possible/unverified statutory issues only.
  Do not treat procedural bail provisions as offence sections.

- PRECEDENTS — return EXACTLY 3, structured as objects:

  "precedents": [
    {
      "case": "Case Name v. Party (Year)",
      "principle": "1-line legal principle established",
      "appliedTo": "specific fact from THIS case input (e.g. alleged diversion of ₹2 Crores)",
      "relevance": "explicit connection: fact → legal principle → why it supports or restricts bail here"
    }
  ]

- Select precedents DETERMINISTICALLY by case type:
  Financial / economic offence:
    1. Sanjay Chandra v. CBI (2012) — bail in economic offences
    2. Pepsi Foods Ltd. v. Special Judicial Magistrate (1998) — civil dispute vs criminal intent
    3. Arnesh Kumar v. State of Bihar (2014) — investigation vs personal liberty

  Theft / minor offence:
    1. State of Rajasthan v. Balchand (1977) — bail is rule, jail is exception
    2. Hussainara Khatoon v. State of Bihar (1979) — presumption of innocence, speedy trial
    3. Dataram Singh v. State of Uttar Pradesh (2018) — bail for first-time offenders

- "appliedTo" MUST directly name a fact from the input (not generic)
- "relevance" MUST explicitly connect: that fact → the principle → bail outcome
- Do NOT invent cases. Do NOT randomize. Same facts → same precedents.

-------------------------------------
QUALITY RULES
-------------------------------------

- No generic statements
- Risk factor titles and descriptions must be complementary, not duplicates
- legalReasoning must explain how the supplied case facts and deterministic legal findings support the qualitative assessment
- Never leave any field empty
- Return ONLY valid JSON — no markdown, no explanation

-------------------------------------
INPUT CASE
-------------------------------------
${structuredCaseFacts}
`;

    let mappedAnalysis: CaseAnalysis | null = null;

    try {
      const rawText = await generateAIResponse(finalPrompt);
      const parsed = extractJsonBlock(rawText) as any;

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON structure from model");
      }

      // Normalize risks and strengths into strictly-typed arrays
      const rawRisks =
        Array.isArray(parsed.riskFactors) && parsed.riskFactors.length > 0
          ? parsed.riskFactors
          : Array.isArray(parsed.risks)
          ? parsed.risks
          : parsed.risks && typeof parsed.risks === "object"
          ? Object.values(parsed.risks)
          : [];
      const caseFactsForRisks = buildCaseSpecificGroundingCorpus({
        narrative: whatHappened,
        structuredValues: [
          resolvedAccusedName,
          resolvedAccusedProfile,
          resolvedSections,
          resolvedOffenseType,
          resolvedBailType,
          resolvedProceduralStage,
          resolvedCustodyStr,
          resolvedPriorRecord,
          resolvedPreviousBail,
          resolvedCooperation,
          when,
          where,
          evidence,
          questions,
        ],
        suppliedSections: suppliedSectionLabels,
        deterministicFindings: [
          legalRules.offenseClass.supported && legalRules.offenseClass.primarySection
            ? `${legalRules.offenseClass.primarySection} classified as ${legalRules.offenseClass.severity}`
            : "",
          legalRules.defaultBail.daysServed !== null
            ? `${legalRules.defaultBail.daysServed} days custody recorded against ${legalRules.defaultBail.daysRequired}-day default-bail threshold`
            : "",
        ],
      });
      const normalizedRiskContracts = normalizeRiskFactors(rawRisks, {
        caseFacts: caseFactsForRisks,
      });
      const analysisRiskFactors = toAnalysisRiskFactors(normalizedRiskContracts);
      const normalizedRisks = normalizedRiskContracts.map((factor) => ({
        text: factor.title,
        level: factor.severity,
      }));

      const rawStrengths = Array.isArray(parsed.strengths)
        ? parsed.strengths
        : parsed.strengths && typeof parsed.strengths === "object"
        ? Object.values(parsed.strengths)
        : [];
      const normalizedStrengths = rawStrengths.map((s: any) => {
        const text = typeof s === "string" ? s.trim() : typeof s?.text === "string" ? s.text.trim() : typeof s?.label === "string" ? s.label.trim() : "Mitigating Factor";
        const rawImpact = String(s?.impact || s?.level || "").toUpperCase();
        const impact: "LOW" | "MEDIUM" | "HIGH" = rawImpact === "HIGH" || rawImpact === "LOW" ? rawImpact : "MEDIUM";
        return { text: text || "Mitigating Factor", impact };
      });

      const rawSections = Array.isArray(parsed.applicableSections)
        ? parsed.applicableSections
        : [];

      const applicableSections = mergeApplicableSections({
      parsed: parsedSectionRecords,
      bailType: resolvedBailType,
      framework: resolvedLegalFramework,
      bailCourtLevel: body.bailCourtLevel,
      llmSections: rawSections,
      });


      const rawPrecedents = Array.isArray(parsed.precedents)
        ? parsed.precedents
        : parsed.precedents && typeof parsed.precedents === "object" && Array.isArray(parsed.precedents.cases)
        ? parsed.precedents.cases
        : [];
      const normalizedPrecedents = normalizePrecedents(rawPrecedents);
      const fallbackPrecedents = buildFallbackPrecedents(rawPrecedents);
      const precedents =
        normalizedPrecedents.length > 0
          ? normalizedPrecedents
          : fallbackPrecedents;

      const isCooperative =
        body.cooperationLevel?.toLowerCase().includes("cooperat") ||
        caseRecord?.cooperationLevel?.toLowerCase().includes("cooperat") ||
        body.cooperationLevel === "High" ||
        caseRecord?.cooperationLevel === "High";

      const isFirstTime =
        body.priorRecord === false ||
        caseRecord?.priorRecord === false;

      const computedRiskScore = calculateRiskScore({
        offenseType: body.offenseType || caseRecord?.offenseType || "",
        previousBail: body.previousBail || caseRecord?.previousBail || "",
        custodyDuration:
          body.custodyDuration ||
          caseRecord?.custodyStatus ||
          (caseRecord?.timeServedDays ? `${caseRecord.timeServedDays} days` : "") ||
          "",
        accusedTags: [
          body.accusedProfile || caseRecord?.accusedProfile,
          isCooperative ? "cooperated in investigation" : undefined,
          isFirstTime ? "first-time offender" : undefined,
        ].filter((t): t is string => !!t),
      });

      const legalReasoning = resolveLegalReasoning(parsed.legalReasoning, legalRules, computedRiskScore);
      const analysisSummary = typeof parsed.analysisSummary === "string" && parsed.analysisSummary.trim()
        ? parsed.analysisSummary.trim()
        : legalReasoning.slice(0, 200) || "Eligibility analysis evaluated.";

      const rawRecommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
      const recommendations = rawRecommendations
        .map((rec: any) => (typeof rec === "string" ? rec.trim() : String(rec?.text || "")))
        .filter(Boolean);

      const rawAnalysisList = Array.isArray(parsed.analysis)
        ? parsed.analysis.map((a: any) => (typeof a === "string" ? a.trim() : String(a || ""))).filter(Boolean)
        : [];

      mappedAnalysis = {
        verdict: normalizeModelVerdict(parsed.eligibility || ""),
        riskScore: computedRiskScore,
        riskBreakdown: null,
        summary: analysisSummary,
        analysis: rawAnalysisList,
        risks: normalizedRisks,
        strengths: normalizedStrengths,
        grounds: rawAnalysisList,
        courtNote: "",
        riskFactors: analysisRiskFactors,
        legalReasoning,
        applicableSections,
        precedents,
        recommendations,
        biasWarning: null,
      };

      console.log(`[Groq] SUCCESS`);
    } catch (err: any) {
      console.error(`[Analyze API] Groq analysis failed:`, err?.message || err);
      return NextResponse.json(
        { success: false, error: "AI service unavailable. Please try again." },
        { status: 503 }
      );
    }

    if (requestedCaseId) {
      try {
        if (!userIdForPersistence) {
          const user = await getOrCreateUser();
          if (user) {
            userIdForPersistence = user.id;
          }
        }

        if (userIdForPersistence) {
          await persistAnalysis(
            requestedCaseId,
            mappedAnalysis,
            userIdForPersistence,
            legalRules,
          );
        }
      } catch (persistenceError) {
        console.error("Analysis persistence failed:", persistenceError);
      }
    }

    return NextResponse.json({ success: true, analysis: mappedAnalysis });
  } catch (e: any) {
    console.error("[API ERROR]", e);

    return NextResponse.json(
      { success: false, error: "AI service unavailable. Please try again." },
      { status: 503 }
    );
  }
}
