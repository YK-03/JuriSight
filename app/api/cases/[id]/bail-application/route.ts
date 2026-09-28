import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-sync";
import db from "@/lib/db";
import {
  buildBailApplicationDocument,
  validateBailApplicationInput,
  type BailApplicationCaseData,
} from "@/lib/bail-application";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const caseData = await db.case.findFirst({
    where: { id, userId: user.id },
    include: { analysis: true },
  });

  if (!caseData) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const caseInput: BailApplicationCaseData = {
    title: caseData.title,
    accusedName: caseData.accusedName,
    section: caseData.section,
    offenseType: caseData.offenseType,
    accusedProfile: caseData.accusedProfile,
    priorRecord: caseData.priorRecord,
    offenseDescription: caseData.offenseDescription,
    cooperationLevel: caseData.cooperationLevel,
    jurisdiction: caseData.jurisdiction,
    bailType: caseData.bailType,
    proceduralStage: caseData.proceduralStage,
    custodyStatus: caseData.custodyStatus,
    previousBail: caseData.previousBail,
  };
  const validation = validateBailApplicationInput(caseInput, caseData.analysis?.rawAnalysis);

  if (validation.missing.length > 0 || !validation.analysis) {
    return NextResponse.json(
      {
        error: "The document cannot be generated until the required information is complete.",
        missing: validation.missing,
      },
      { status: 422 },
    );
  }

  const document = buildBailApplicationDocument(caseInput, validation.analysis);
  return new NextResponse(document, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="juriSight-bail-application-${id}.txt"`,
    },
  });
}

