import { NextResponse } from "next/server";
import { generateAIResponse } from "@/lib/groq";
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

export const runtime = "nodejs";

const systemInstruction = `You are a legal analysis assistant. Return ONLY valid JSON. Do not include explanations, markdown, or extra text.`;

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
}) {
  return [
    `Case title: ${caseRecord.title}`,
    `Accused name: ${caseRecord.accusedName}`,
    `Offense type: ${caseRecord.offenseType}`,
    `Section reference: ${caseRecord.section}`,
    `Accused profile: ${caseRecord.accusedProfile}`,
    `Cooperation level / procedural stage: ${caseRecord.cooperationLevel}`,
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

function buildAnalysisPersistenceData(caseId: string, analysis: CaseAnalysis) {
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
    riskScore: Math.max(0, Math.min(10, Math.round(riskScore / 10))),
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
      classification: analysis.verdict === "Unfavorable" ? "NON_BAILABLE" : "BAILABLE",
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

async function persistAnalysis(caseId: string, analysis: CaseAnalysis, userId: string) {
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

  const analysisData = buildAnalysisPersistenceData(caseId, analysis);
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
          jurisdiction: true,
          legalFramework: true,
          specialAct: true,
          maximumSentenceYears: true,
          timeServedDays: true,
        },
      });

      if (!caseRecord) {
        return NextResponse.json({ error: "Case not found" }, { status: 404 });
      }
    }

    const caseTitle = body.caseTitle || caseRecord?.title || "Not specified";
    const stage = body.stage || body.proceduralStage || caseRecord?.cooperationLevel || "Unknown";
    const when = body.when || body.incidentDate || caseRecord?.timeServedDays?.toString() || "Not specified";
    const where = body.where || body.incidentLocation || caseRecord?.jurisdiction || "Not specified";
    const people = body.people || body.partiesInvolved || caseRecord?.accusedName || "Not specified";
    const evidence = body.evidence || body.evidenceDetails || "Not specified";
    const questions = body.questions || body.legalQuestions || "Not specified";
    
    let rawFacts = body.whatHappened || caseRecord?.offenseDescription || body.caseDescription || "";
    if (!rawFacts || rawFacts.trim().length < 20) {
      return NextResponse.json(
        { error: "Case facts must be at least 20 characters long." },
        { status: 400 },
      );
    }
    const whatHappened = rawFacts.length > 500 ? rawFacts.slice(0, 500) + "..." : rawFacts;

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
  "risks": [
    { "text": "case-specific risk", "level": "LOW | MEDIUM | HIGH" }
  ],
  "strengths": [
    { "text": "case-specific strength", "impact": "LOW | MEDIUM | HIGH" }
  ],
  "legalReasoning": "detailed paragraph explaining the eligibility assessment",
  "applicableSections": ["IPC Section 420", "CrPC Section 439"],
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
- Focus on extracting qualitative legal analysis: risks, strengths, reasoning, precedents
- Eligibility is your qualitative assessment: "High", "Moderate", or "Low"

-------------------------------------
LEGAL INTELLIGENCE RULES
-------------------------------------

- ALWAYS include correct CrPC section:
  - Anticipatory bail → CrPC 438
  - Regular bail → CrPC 437 / 439

- Include IPC sections based on facts:
  - Financial diversion → IPC 420, 406
  - Theft → IPC 379
  - Cheating → IPC 417, 420

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
- Risks must be specific to THIS case
- legalReasoning must explain WHY the score exists
- Never leave any field empty
- Return ONLY valid JSON — no markdown, no explanation

-------------------------------------
INPUT CASE
-------------------------------------
Title: ${caseTitle}
Stage: ${stage}
Timeline: ${when}
Location: ${where}
Involved Parties: ${people}
What Happened: ${whatHappened}
Evidence: ${evidence}
Legal Questions: ${questions}
`;

    let mappedAnalysis: CaseAnalysis | null = null;

    try {
      const rawText = await generateAIResponse(finalPrompt);
      
      let safeText = rawText;
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        safeText = rawText.slice(firstBrace, lastBrace + 1);
      }

      safeText = safeText.trim();

      let parsed;
      try {
        parsed = JSON.parse(safeText);
      } catch (err) {
        throw new Error("Invalid JSON response from model");
      }

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON structure");
      }

      if (
        !parsed.eligibility ||
        !Array.isArray(parsed.risks) ||
        !Array.isArray(parsed.strengths)
      ) {
        throw new Error("Invalid JSON structure from model");
      }

      // Ensure optional fields default safely
      if (!Array.isArray(parsed.applicableSections)) parsed.applicableSections = [];
      if (!Array.isArray(parsed.precedents)) parsed.precedents = [];
      if (!Array.isArray(parsed.recommendations)) parsed.recommendations = [];
      if (!parsed.analysisSummary) parsed.analysisSummary = "";
      if (!parsed.legalReasoning) parsed.legalReasoning = "";

      const normalizedPrecedents = normalizePrecedents(parsed.precedents);
      const fallbackPrecedents = buildFallbackPrecedents(parsed.precedents);
      const precedents =
        normalizedPrecedents.length > 0
          ? normalizedPrecedents
          : fallbackPrecedents;

      const computedRiskScore = calculateRiskScore({
        offenseType: caseRecord?.offenseType || body.whatHappened || "",
        previousBail: body.stage || caseRecord?.cooperationLevel || "",
        custodyDuration: body.when || caseRecord?.timeServedDays?.toString() || "",
        accusedTags: [
          caseRecord?.accusedProfile,
          caseRecord?.cooperationLevel === "High" ? "cooperated" : undefined,
          caseRecord?.priorRecord === false ? "first-time offender" : undefined,
        ].filter((t): t is string => !!t),
      });

      mappedAnalysis = {
        verdict: parsed.eligibility || "Moderate",
        riskScore: computedRiskScore,
        riskBreakdown: null,
        summary: parsed.analysisSummary || parsed.legalReasoning?.slice(0, 200) || "Eligibility analysis evaluated.",
        analysis: Array.isArray(parsed.analysis) ? parsed.analysis : [],
        risks: parsed.risks || [],
        strengths: parsed.strengths || [],
        grounds: Array.isArray(parsed.analysis) ? parsed.analysis : [],
        courtNote: "",
        riskFactors: (parsed.risks || []).map((r: any) => ({
          label: r?.text || "Identified Risk",
          severity: r?.level || "MEDIUM",
          description: r?.text || "",
        })),
        legalReasoning: parsed.legalReasoning || "",
        applicableSections: parsed.applicableSections.map((s: any) =>
          typeof s === "string" ? { code: s, title: s, relevance: "" } : {
            code: s?.code || "",
            title: s?.title || s?.code || "",
            relevance: s?.relevance || s?.description || "",
          }
        ),
        precedents,
        recommendations: parsed.recommendations || [],
        biasWarning: null,
      } as unknown as CaseAnalysis;

      console.log(`[Groq] SUCCESS`);
    } catch (err: any) {
      console.log(`[Groq] failed`, err?.message || err);
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
            userIdForPersistence
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
