import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";
import db from "@/lib/db";
import { buildFallbackPrecedents, normalizePrecedents, PrecedentsSchema } from "@/lib/precedents";
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

    const storedPrecedents = normalizePrecedents(caseData.analysis?.precedents);
    if (storedPrecedents.length > 0) {
      return NextResponse.json({ precedents: storedPrecedents });
    }

    const { text } = await generateText({
      model: anthropic("claude-opus-4-5"),
      system: "You are an Indian legal research assistant. Return only valid JSON.",
      prompt: `Find 3 real Indian court cases similar to this bail case:
Section: ${caseData.section}
Offense: ${caseData.offenseType}
Profile: ${caseData.accusedProfile}

Return a JSON array of exactly 3 objects:
[
  {
    "case": "Real Indian case name",
    "principle": "Concise legal principle",
    "searchLink": "https://indiankanoon.org/search/?formInput=<url-encoded case name>"
  }
]

For each precedent:
- Provide a real Indian case name (prefer Supreme Court / High Court)
- Provide a concise legal principle
- Generate a searchLink using:
  https://indiankanoon.org/search/?formInput=<case name>
- Use URL encoding (spaces -> %20)
- Do NOT skip this field

Do not return markdown or extra text.`,
    });

    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const precedents = normalizePrecedents(parsed);
    const fallbackPrecedents = buildFallbackPrecedents(parsed);
    const safePrecedents = PrecedentsSchema.parse(
      precedents.length > 0 ? precedents : fallbackPrecedents,
    );

    if (caseData.analysis) {
      await db.analysis.update({ where: { caseId }, data: { precedents: safePrecedents } });
    }

    return NextResponse.json({ precedents: safePrecedents });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to fetch precedents" }, { status: 500 });
  }
}
