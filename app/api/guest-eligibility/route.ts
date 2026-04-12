import { GoogleGenerativeAI } from "@google/generative-ai";
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
- No markdown.
- No extra text.
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
  try {
    const rawBody = await request.json();
    const parsedBody = guestEligibilityRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is not configured.");
      return NextResponse.json({ error: "Failed to generate eligibility result." }, { status: 500 });
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const generation = await model.generateContent(prompt);
    const rawText = generation.response.text();
    const cleanedText = stripMarkdownFences(rawText);
    const parsedJson = JSON.parse(cleanedText);
    const validatedResult = guestEligibilityResponseSchema.parse(parsedJson);

    return NextResponse.json(validatedResult);
  } catch (error) {
    console.error("Guest eligibility route failed:", error);
    return NextResponse.json({ error: "Failed to generate eligibility result." }, { status: 500 });
  }
}
