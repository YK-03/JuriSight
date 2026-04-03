import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-sync";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";
import db from "@/lib/db";

const BodySchema = z.object({ caseId: z.string().cuid() });
const PrecedentSchema = z.array(
  z.object({
    caseName: z.string(),
    court: z.string(),
    year: z.number().int(),
    outcome: z.enum(["BAIL_GRANTED", "BAIL_DENIED"]),
    reason: z.string(),
  }),
);

export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const { caseId } = BodySchema.parse(await req.json());
    const caseData = await db.case.findFirst({ where: { id: caseId, userId }, include: { analysis: true } });
    if (!caseData) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    if (caseData.analysis?.precedents) {
      return NextResponse.json({ precedents: caseData.analysis.precedents });
    }

    const { text } = await generateText({
      model: anthropic("claude-opus-4-5"),
      system: "You are a Indian legal research assistant with knowledge of Supreme Court and High Court bail judgments.",
      prompt: `Find 3 real Indian court cases similar to this bail case:\nSection: ${caseData.section}, Offense: ${caseData.offenseType}, Profile: ${caseData.accusedProfile}\n\nReturn JSON array of exactly 3 cases:\n[{\n  caseName: string,\n  court: string,\n  year: number,\n  outcome: 'BAIL_GRANTED' | 'BAIL_DENIED',\n  reason: string (max 20 words)\n}]\n\nOnly return real, verifiable cases. If unsure, use well-known landmark cases like Sanjay Chandra v CBI, Arnesh Kumar v State of Bihar, etc.`,
    });

    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const precedents = PrecedentSchema.parse(JSON.parse(cleaned));

    if (caseData.analysis) {
      await db.analysis.update({ where: { caseId }, data: { precedents } });
    }

    return NextResponse.json({ precedents });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to fetch precedents" }, { status: 500 });
  }
}
