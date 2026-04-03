import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-sync";
import { z } from "zod";
import db from "@/lib/db";
import { generateBailAnalysis } from "@/lib/ai";

const AnalyzeSchema = z.object({
  caseId: z.string().cuid(),
});

export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const { caseId } = AnalyzeSchema.parse(await req.json());

    const caseData = await db.case.findFirst({
      where: { id: caseId, userId },
    });

    if (!caseData) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    const analysis = await generateBailAnalysis(caseData);

    const upserted = await db.analysis.upsert({
      where: { caseId: caseData.id },
      update: {
        eligibilityStatus: analysis.eligibilityStatus,
        confidenceLevel: analysis.confidenceLevel,
        confidenceExplanation: analysis.confidenceExplanation,
        riskScore: analysis.riskScore,
        reasoning: analysis.reasoning,
        riskFactors: analysis.riskFactors,
        legalBasis: analysis.legalBasis,
        flightRisk: analysis.riskFactors.flightRisk,
        offenseSeverity: analysis.riskFactors.offenseSeverity,
        recommendation: analysis.recommendation,
        applicableSections: analysis.legalBasis.applicableSections,
        positiveFactors: analysis.positiveFactors,
        negativeFactors: analysis.negativeFactors,
        suggestedConditions: analysis.suggestedConditions,
        biasWarning: analysis.biasWarning,
      },
      create: {
        caseId: caseData.id,
        eligibilityStatus: analysis.eligibilityStatus,
        confidenceLevel: analysis.confidenceLevel,
        confidenceExplanation: analysis.confidenceExplanation,
        riskScore: analysis.riskScore,
        reasoning: analysis.reasoning,
        riskFactors: analysis.riskFactors,
        legalBasis: analysis.legalBasis,
        flightRisk: analysis.riskFactors.flightRisk,
        offenseSeverity: analysis.riskFactors.offenseSeverity,
        recommendation: analysis.recommendation,
        applicableSections: analysis.legalBasis.applicableSections,
        positiveFactors: analysis.positiveFactors,
        negativeFactors: analysis.negativeFactors,
        suggestedConditions: analysis.suggestedConditions,
        biasWarning: analysis.biasWarning,
      },
    });

    await db.case.update({
      where: { id: caseData.id },
      data: { status: "ANALYZED" },
    });

    return NextResponse.json(upserted);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
