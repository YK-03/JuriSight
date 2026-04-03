import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-sync";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";
import  db  from "@/lib/db";

const BodySchema = z.object({ caseId: z.string().cuid() });

export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const { caseId } = BodySchema.parse(await req.json());
    const caseData = await db.case.findFirst({
      where: { id: caseId, userId },
      include: { analysis: true },
    });

    if (!caseData || !caseData.analysis) {
      return NextResponse.json({ error: "Case analysis is required" }, { status: 400 });
    }

    const { text } = await generateText({
      model: anthropic("claude-opus-4-5"),
      system: "You are a legal drafting assistant specializing in Indian criminal law bail applications.",
      prompt: `Draft a formal bail application for:
Court: ${caseData.jurisdiction}
Section: ${caseData.section}
Accused: ${caseData.accusedName}
Offense: ${caseData.offenseType}, ${caseData.offenseDescription}
Grounds: ${caseData.analysis.reasoning}
Favorable factors: ${caseData.analysis.positiveFactors.join(", ")}

Format as a proper legal document with:
1. Court header
2. Application title
3. Respectful submission para
4. Grounds (numbered)
5. Prayer clause
6. Date and signature block

Use formal legal language appropriate for Indian courts.
Keep it under 500 words.`,
    });

    return NextResponse.json({ draft: text.trim() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to generate draft" }, { status: 500 });
  }
}
