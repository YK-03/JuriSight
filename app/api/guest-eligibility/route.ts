import { generateAIResponse } from "@/lib/groq";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const guestEligibilityRequestSchema = z.object({
  crpcSection: z.string().trim().min(1),
  offenseType: z.string().trim().min(1),
  accusedProfile: z.string().trim().min(1),
  priorRecord: z.string().trim().min(1),
  cooperationLevel: z.string().trim().min(1),
  description: z.string().trim().min(1),
});

const guestEligibilityResponseSchema = z.object({
  verdict: z.union([
    z.literal("Bailable"),
    z.literal("Non-Bailable"),
    z.literal("Conditional Bail (Discretionary)"),
  ]),
  riskScore: z.number().min(0).max(100),
  crpcSection: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  riskFactors: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        severity: z.union([z.literal("HIGH"), z.literal("MEDIUM"), z.literal("LOW")]),
      }),
    )
    .length(2),
  oneRecommendation: z.string().trim().min(1),
});

const systemPrompt = `You are JuriSight, an expert Indian criminal procedure assistant.

Return ONLY valid JSON with this exact shape:
{
  "verdict": "Bailable" | "Non-Bailable" | "Conditional Bail (Discretionary)",
  "riskScore": number,
  "crpcSection": string,
  "summary": string,
  "riskFactors": [
    { "label": string, "severity": "HIGH" | "MEDIUM" | "LOW" }
  ],
  "oneRecommendation": string
}

Rules:
- Apply Indian law and CrPC principles only.
- The summary must be plain English with a maximum of 2 sentences.
- Return exactly 2 riskFactors.
- Return ONLY valid JSON. Do not include explanations, markdown, or extra text.
- No keys other than those specified.`;

function stripMarkdownFences(value: string) {
  let cleaned = value.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "");
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/\s*```$/, "");
  }

  return cleaned.trim();
}


export async function POST(request: Request) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const parsedBody = guestEligibilityRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const prompt = [
      "Assess guest bail eligibility from the following facts and return the required JSON only.",
      `CrPC Section: ${parsedBody.data.crpcSection}`,
      `Offense Type: ${parsedBody.data.offenseType}`,
      `Accused Profile: ${parsedBody.data.accusedProfile}`,
      `Prior Record: ${parsedBody.data.priorRecord}`,
      `Cooperation Level: ${parsedBody.data.cooperationLevel}`,
      `Description: ${parsedBody.data.description}`,
    ].join("\n");

    const cacheKey = JSON.stringify(parsedBody.data);
    let aiResponse;
    try {
      const fullPrompt = `${systemPrompt}\n\n${prompt}\n\nReturn ONLY valid JSON. Do not include explanations, markdown, or extra text.`;
      const rawText = await generateAIResponse(fullPrompt);

      let safeText = rawText;
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        safeText = rawText.slice(firstBrace, lastBrace + 1);
      }
      
      safeText = safeText.trim();

      let parsed;
      try {
        parsed = JSON.parse(safeText);
      } catch (err) {
        throw new Error("Invalid JSON response from model");
      }

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON structure");
      }

      if (!parsed.verdict || !Array.isArray(parsed.riskFactors)) {
        throw new Error("Invalid JSON structure from model");
      }

      aiResponse = { success: true, text: safeText };
    } catch (error) {
      console.error("[Groq Error]", error);
      aiResponse = { success: false, fallback: true };
    }

    if (!aiResponse.success || aiResponse.fallback) {
      return NextResponse.json(
        { success: false, fallback: true, message: aiResponse.message || "AI is currently under heavy load." },
        { status: 200 }
      );
    }

    const cleanedText = aiResponse.text as string;
    let parsedJson;

    try {
      parsedJson = JSON.parse(cleanedText);
    } catch (err) {
      throw new Error("Invalid JSON response from model");
    }
    
    if (!parsedJson || typeof parsedJson !== "object") {
      throw new Error("Invalid JSON structure");
    }
    const validatedResult = guestEligibilityResponseSchema.parse(parsedJson);

    return NextResponse.json(validatedResult);
  } catch (e: any) {
    console.error("[API ERROR]", e);

    return NextResponse.json(
      { success: false, fallback: true, message: "AI is currently under heavy load. Please try again shortly." },
      { status: 200 }
    );
  }
}
