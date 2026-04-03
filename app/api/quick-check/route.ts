import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { z } from "zod";

const QuickCheckSchema = z.object({
  accusedName: z.string().min(1),
  sections: z.string().min(1),
  offenseType: z.string().min(1),
  priorRecord: z.boolean(),
  jurisdiction: z.string().min(1),
});

const QuickCheckResultSchema = z.object({
  eligibilityStatus: z.enum(["LIKELY_ELIGIBLE", "BORDERLINE", "LIKELY_INELIGIBLE"]),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reasoning: z.string(),
  positiveFactors: z.array(z.string()),
  negativeFactors: z.array(z.string()),
  suggestedConditions: z.array(z.string()),
  legalBasis: z.string(),
});

function extractJsonBlock(raw: string): unknown {
  return JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
}

export async function POST(req: Request) {
  try {
    const body = QuickCheckSchema.parse(await req.json());

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Assessment failed" }, { status: 500 });
    }

    const prompt = `You are an expert Indian criminal lawyer specializing in bail applications under CrPC/BNS.

Assess bail eligibility for the following case:
- Accused: ${body.accusedName}
- Sections: ${body.sections}
- Offense type: ${body.offenseType}
- Prior criminal record: ${body.priorRecord ? "Yes" : "No"}
- Jurisdiction: ${body.jurisdiction}

Return ONLY valid JSON with this exact structure:
{
  "eligibilityStatus": "LIKELY_ELIGIBLE" | "BORDERLINE" | "LIKELY_INELIGIBLE",
  "confidenceLevel": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "2-3 sentence explanation",
  "positiveFactors": ["factor 1", "factor 2"],
  "negativeFactors": ["factor 1", "factor 2"],
  "suggestedConditions": ["condition 1", "condition 2"],
  "legalBasis": "one sentence citing relevant CrPC/BNS section"
}`;

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt,
    });

    const result = QuickCheckResultSchema.parse(extractJsonBlock(text));
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: "Assessment failed" }, { status: 500 });
  }
}
