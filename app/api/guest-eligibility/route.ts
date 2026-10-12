import { generateAIResponse, extractJsonBlock } from "@/lib/groq";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  acquireAIAbuseControl,
  AI_LIMITS,
  AI_REQUEST_MAX_BYTES,
  readJsonBody,
  RequestLimitError,
} from "@/lib/ai-abuse-controls";

export const runtime = "nodejs";

const guestEligibilityRequestSchema = z.object({
  crpcSection: z.string().trim().min(1).max(1200),
  offenseType: z.string().trim().min(1).max(1200),
  accusedProfile: z.string().trim().min(1).max(12000),
  priorRecord: z.string().trim().min(1).max(12000),
  cooperationLevel: z.string().trim().min(1).max(1200),
  description: z.string().trim().min(1).max(12000),
}).strict();

const guestEligibilityResponseSchema = z.object({
  verdict: z.union([
    z.literal("Bailable"),
    z.literal("Non-Bailable"),
    z.literal("Conditional Bail (Discretionary)"),
  ]),
  riskScore: z.number().min(0).max(100),
  crpcSection: z.string().trim().min(1).max(1200),
  summary: z.string().trim().min(1).max(2000),
  riskFactors: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(300),
        severity: z.union([z.literal("HIGH"), z.literal("MEDIUM"), z.literal("LOW")]),
      }).strict(),
    )
    .length(2),
  oneRecommendation: z.string().trim().min(1).max(2000),
}).strict();

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
    rawBody = await readJsonBody(request, AI_REQUEST_MAX_BYTES.guestEligibility);
  } catch (error) {
    if (error instanceof RequestLimitError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    if (rawBody && typeof rawBody === "object" && !Array.isArray(rawBody) &&
      Object.values(rawBody as Record<string, unknown>).some((value) => typeof value === "string" && value.length > 12_000)) {
      return NextResponse.json({ error: "One or more fields exceed the permitted length." }, { status: 413 });
    }
    const parsedBody = guestEligibilityRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (Object.values(parsedBody.data).some((value) => value.length > 12_000)) {
      return NextResponse.json({ error: "One or more fields exceed the permitted length." }, { status: 413 });
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
      const releaseOrResponse = await acquireAIAbuseControl(request, AI_LIMITS.guestEligibility);
      if (releaseOrResponse instanceof Response) return releaseOrResponse;
      let rawText: string;
      try {
        rawText = await generateAIResponse({ system: systemPrompt, user: prompt });
      } finally {
        await releaseOrResponse();
      }
      const validatedResult = guestEligibilityResponseSchema.parse(extractJsonBlock(rawText));
      if (validatedResult.crpcSection !== parsedBody.data.crpcSection) {
        throw new Error("Model changed the authoritative CrPC section");
      }
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
