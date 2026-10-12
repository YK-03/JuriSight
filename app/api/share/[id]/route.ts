import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getOrCreateUser } from "@/lib/user-sync";
import db from "@/lib/db";
import { normalizePrecedents } from "@/lib/precedents";

const publicAnalysisSelect = {
  eligibilityStatus: true,
  confidenceLevel: true,
  confidenceExplanation: true,
  riskScore: true,
  reasoning: true,
  riskFactors: true,
  legalBasis: true,
  flightRisk: true,
  offenseSeverity: true,
  recommendation: true,
  applicableSections: true,
  positiveFactors: true,
  negativeFactors: true,
  suggestedConditions: true,
  precedents: true,
  biasWarning: true,
  createdAt: true,
} as const;

function publicVerdict(status: string) {
  if (status === "LIKELY_ELIGIBLE") return "Favorable" as const;
  if (status === "LIKELY_INELIGIBLE") return "Unfavorable" as const;
  return "Mixed" as const;
}

function publicRiskFactors(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([key, level]) => {
    const normalized = String(level).toUpperCase();
    const severity = normalized === "HIGH" || normalized === "SEVERE" ? "High" : normalized === "LOW" ? "Low" : "Medium";
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
    return {
      title: label,
      label,
      severity,
      description: `${label}: ${String(level)}. Review the underlying case record before relying on this shared summary.`,
    };
  });
}

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: shareToken } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(shareToken)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const found = await db.case.findFirst({
    where: { shareToken: shareToken || undefined, isPublic: true },
    select: {
      id: true,
      title: true,
      createdAt: true,
      analysis: { select: publicAnalysisSelect },
    },
  });

  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const analysis = found.analysis
    ? {
        verdict: publicVerdict(found.analysis.eligibilityStatus),
        riskScore: found.analysis.riskScore,
        summary: found.analysis.confidenceExplanation,
        riskFactors: publicRiskFactors(found.analysis.riskFactors),
        legalReasoning: found.analysis.reasoning,
        applicableSections: found.analysis.applicableSections.map((code) => ({
          code,
          title: code,
          relevance: "Approved shared statutory reference.",
        })),
        precedents: normalizePrecedents(found.analysis.precedents),
        recommendations: found.analysis.suggestedConditions,
        biasWarning: found.analysis.biasWarning,
      }
    : null;

  return NextResponse.json({
    id: found.id,
    title: found.title,
    createdAt: found.createdAt.toISOString(),
    analysis,
  });
}

/** Explicitly enable sharing for an owned case and issue a high-entropy token. */
export async function POST(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  let shareToken: string | null = null;
  try {
    await db.$transaction(async (tx) => {
      const caseRecord = await tx.case.findFirst({
        where: { id, userId: user.id },
        select: { id: true, shareToken: true },
      });

      if (!caseRecord) return;

      shareToken = caseRecord.shareToken ?? randomUUID();
      await tx.case.update({
        where: { id: caseRecord.id },
        data: { isPublic: true, shareToken },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    return NextResponse.json({ error: "Unable to update sharing right now" }, { status: 503 });
  }

  if (!shareToken) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  return NextResponse.json({ shareToken });
}

/** Revoke the public token for an owned case. */
export async function DELETE(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  let updated;
  try {
    updated = await db.$transaction(async (tx) => tx.case.updateMany({
      where: { id, userId: user.id },
      data: { isPublic: false, shareToken: null },
    }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    return NextResponse.json({ error: "Unable to update sharing right now" }, { status: 503 });
  }

  if (updated.count === 0) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
