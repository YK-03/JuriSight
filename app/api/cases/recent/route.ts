import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-sync";

type RawAnalysisShape = {
  riskScore?: unknown;
  summary?: unknown;
  recommendations?: unknown;
};

function getRiskScore(analysis: {
  riskScore: number;
  rawAnalysis: RawAnalysisShape | null;
}) {
  const rawRiskScore = analysis.rawAnalysis?.riskScore;
  if (typeof rawRiskScore === "number" && Number.isFinite(rawRiskScore)) {
    return Math.max(0, Math.min(100, Math.round(rawRiskScore)));
  }

  return Math.max(0, Math.min(100, analysis.riskScore * 10));
}

function getRecommendation(analysis: {
  recommendation: string;
  rawAnalysis: RawAnalysisShape | null;
}) {
  const rawRecommendations = analysis.rawAnalysis?.recommendations;
  if (Array.isArray(rawRecommendations)) {
    const firstRecommendation = rawRecommendations.find((value) => typeof value === "string" && value.trim());
    if (typeof firstRecommendation === "string") {
      return firstRecommendation;
    }
  }

  return analysis.recommendation;
}

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cases = await db.case.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
    select: {
      id: true,
      title: true,
      createdAt: true,
      status: true,
      analysis: {
        select: {
          riskScore: true,
          eligibilityStatus: true,
          recommendation: true,
          rawAnalysis: true,
        },
      },
    },
  });

  return NextResponse.json(
    cases.map((caseItem) => ({
      id: caseItem.id,
      title: caseItem.title,
      createdAt: caseItem.createdAt.toISOString(),
      status: caseItem.status,
      analysis: caseItem.analysis
        ? {
            riskScore: getRiskScore({
              riskScore: caseItem.analysis.riskScore,
              rawAnalysis: caseItem.analysis.rawAnalysis as RawAnalysisShape | null,
            }),
            eligibilityStatus: caseItem.analysis.eligibilityStatus,
            recommendation: getRecommendation({
              recommendation: caseItem.analysis.recommendation,
              rawAnalysis: caseItem.analysis.rawAnalysis as RawAnalysisShape | null,
            }),
          }
        : null,
    })),
  );
}
