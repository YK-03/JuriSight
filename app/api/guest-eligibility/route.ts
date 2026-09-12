import { generateAIResponse, extractJsonBlock } from "@/lib/groq";
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

function normalizeGuestVerdict(raw: unknown): "Bailable" | "Non-Bailable" | "Conditional Bail (Discretionary)" {
  const str = String(raw || "").trim().toLowerCase();
  if (str.includes("non-bailable") || str.includes("non bailable")) {
    return "Non-Bailable";
  }
  if (str.includes("conditional") || str.includes("discretionary")) {
    return "Conditional Bail (Discretionary)";
  }
  if (str.includes("bailable")) {
    return "Bailable";
  }
  return "Conditional Bail (Discretionary)";
}

function normalizeGuestRiskFactors(raw: unknown): Array<{ label: string; severity: "HIGH" | "MEDIUM" | "LOW" }> {
  const rawList = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
    ? Object.values(raw)
    : [];

  const items = rawList.map((rf: any) => {
    const rawSev = String(rf?.severity || rf?.level || "").trim().toUpperCase();
    const severity: "HIGH" | "MEDIUM" | "LOW" = rawSev === "HIGH" || rawSev === "LOW" ? rawSev : "MEDIUM";
    const label = String(rf?.label || rf?.text || rf?.factor || "Case Factor").trim();
    return { label: label || "Case Factor", severity };
  });

  if (items.length === 0) {
    return [
      { label: "Investigation Stage Assessment", severity: "MEDIUM" },
      { label: "Statutory Allegation Severity", severity: "MEDIUM" },
    ];
  }
  if (items.length === 1) {
    return [
      items[0],
      { label: "Procedural Compliance Review", severity: "MEDIUM" },
    ];
  }
  return items.slice(0, 2);
}

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

    try {
      const fullPrompt = `${systemPrompt}\n\n${prompt}\n\nReturn ONLY valid JSON. Do not include explanations, markdown, or extra text.`;
      const rawText = await generateAIResponse(fullPrompt);
      const parsed = extractJsonBlock(rawText) as any;

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid JSON structure from model");
      }

      const normalizedPayload = {
        verdict: normalizeGuestVerdict(parsed.verdict),
        riskScore: Math.min(100, Math.max(0, Math.round(Number(parsed.riskScore) || 50))),
        crpcSection: String(parsed.crpcSection || parsedBody.data.crpcSection).trim() || parsedBody.data.crpcSection,
        summary: String(parsed.summary || "").trim() || "Eligibility evaluated based on provided procedural facts.",
        riskFactors: normalizeGuestRiskFactors(parsed.riskFactors),
        oneRecommendation: String(parsed.oneRecommendation || parsed.recommendation || "").trim() || "Ensure strict adherence to procedural conditions and legal representation.",
      };

      const validatedResult = guestEligibilityResponseSchema.parse(normalizedPayload);
      return NextResponse.json(validatedResult);
    } catch (error) {
      console.error("[Guest Eligibility Error]:", error);
      return NextResponse.json(
        { success: false, error: "AI is currently under heavy load. Please try again shortly." },
        { status: 503 }
      );
    }
  } catch (e: any) {
    console.error("[API ERROR]", e);

    return NextResponse.json(
      { success: false, error: "AI is currently under heavy load. Please try again shortly." },
      { status: 500 }
    );
  }
}
