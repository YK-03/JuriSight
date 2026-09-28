import { NextResponse } from "next/server";
import { z } from "zod";
import db from "@/lib/db";
import { PrecedentsSchema, type Precedent } from "@/lib/precedents";
import { retrievePrecedents } from "@/lib/precedent-retrieval";
import { getOrCreateUser } from "@/lib/user-sync";

const BodySchema = z.object({ caseId: z.string().cuid() });

export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { caseId } = BodySchema.parse(await req.json());
    const caseData = await db.case.findFirst({
      where: { id: caseId, userId: user.id },
      include: { analysis: true },
    });

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const retrieved = retrievePrecedents({
      bailType: caseData.bailType,
      offenseType: caseData.offenseType,
      section: caseData.section,
      accusedProfile: caseData.accusedProfile,
      priorRecord: caseData.priorRecord,
      cooperationLevel: caseData.cooperationLevel,
      custodyDuration: caseData.custodyStatus ?? (caseData.timeServedDays ? `${caseData.timeServedDays} days` : ""),
      custodyStatus: caseData.custodyStatus,
      proceduralStage: caseData.proceduralStage,
      previousBail: caseData.previousBail,
      offenseDescription: caseData.offenseDescription,
    });

    const precedents: Precedent[] = retrieved.map((precedent) => ({
      id: precedent.id,
      case: `${precedent.caseName} (${precedent.year})`,
      principle: precedent.principle,
      ...(precedent.sourceUrl ? { searchLink: precedent.sourceUrl } : {}),
      category: precedent.category,
      tags: precedent.tags,
      bailPosture: precedent.bailPosture,
      proceduralStage: precedent.proceduralStage,
      provenance: precedent.provenance,
    }));
    const safePrecedents = PrecedentsSchema.parse(precedents);

    if (caseData.analysis) {
      await db.analysis.update({ where: { caseId }, data: { precedents: safePrecedents } });
    }

    return NextResponse.json({ precedents: safePrecedents });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }

    console.error("[Precedents API Error]:", error);
    return NextResponse.json({ error: "Failed to fetch precedents" }, { status: 503 });
  }
}
