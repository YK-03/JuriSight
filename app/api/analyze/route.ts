import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  ConfidenceLevel,
  EligibilityStatus,
  OffenseSeverity,
  Prisma,
  RiskLevel,
} from "@prisma/client";
import { AnalyzeRequest, CaseAnalysis } from "@/lib/analysis-types";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-sync";

export const runtime = "nodejs";

const systemPrompt = `You are JuriSight, an expert Indian legal analysis AI with deep knowledge of IPC, CrPC, BNS 2023, constitutional law, and Supreme Court / High Court precedents.

Analyse the case description provided and respond ONLY with a valid JSON object - no markdown, no explanation, no preamble. The JSON must exactly match this TypeScript interface:

{
  "verdict": "Favorable" | "Unfavorable" | "Mixed",
  "riskScore": number,          // 0 = no risk, 100 = extreme risk
  "summary": string,            // 2-3 sentences, plain English
  "riskFactors": [
    {
      "label": string,
      "severity": "High" | "Medium" | "Low",
      "description": string       // 1 sentence
    }
  ],
  "legalReasoning": string,     // 3-5 paragraphs, cite specific sections
  "applicableSections": [
    {
      "code": string,             // e.g. "IPC 420", "BNS 316"
      "title": string,
      "relevance": string         // 1 sentence
    }
  ],
  "precedents": [
    {
      "case": string,
      "citation": string,         // year + court abbreviation
      "relevance": string         // 1 sentence
    }
  ],
  "recommendations": string[],  // 3-5 actionable items
  "biasWarning": string | null  // flag if caste/religion/gender bias risk
}

Return only the JSON object. Nothing before or after it.`;

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
  try {
    const body: AnalyzeRequest = await req.json();
    const requestedCaseId = typeof body.caseId === "string" && body.caseId.trim() ? body.caseId : null;
    let caseDescription =
      typeof body.caseDescription === "string" && body.caseDescription.trim()
        ? body.caseDescription.trim()
        : "";
    let userIdForPersistence: string | null = null;

    if (!caseDescription && requestedCaseId) {
      const user = await getOrCreateUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      userIdForPersistence = user.id;

      const caseRecord = await db.case.findFirst({
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

      caseDescription = buildCaseDescriptionFromRecord(caseRecord);
    }

    if (!caseDescription || caseDescription.length < 20) {
      return NextResponse.json(
        { error: "Case description must be at least 20 characters long." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const result = await model.generateContent(caseDescription);
    const responseText = result.response.text();

    let cleanJsonText = responseText.trim();
    if (cleanJsonText.startsWith("```json")) {
      cleanJsonText = cleanJsonText.replace(/^```json\s*/i, "");
    }
    if (cleanJsonText.startsWith("```")) {
      cleanJsonText = cleanJsonText.replace(/^```\s*/, "");
    }
    if (cleanJsonText.endsWith("```")) {
      cleanJsonText = cleanJsonText.replace(/\s*```$/, "");
    }

    let analysis: CaseAnalysis;

    try {
      analysis = JSON.parse(cleanJsonText) as CaseAnalysis;
    } catch {
      console.error("JSON Parse Error:", cleanJsonText);
      return NextResponse.json(
        { error: "Model returned invalid JSON format." },
        { status: 500 },
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
          await persistAnalysis(requestedCaseId, analysis, userIdForPersistence);
        }
      } catch (persistenceError) {
        console.error("Analysis persistence failed:", persistenceError);
      }
    }

    return NextResponse.json({ analysis });
  } catch (error: unknown) {
    console.error("Analysis Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to analyze case description.",
      },
      { status: 500 },
    );
  }
}
