import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type OffenseType = "non-bailable" | "bailable" | "ndps" | "uapa" | "pmla" | "unknown";
type CustodyDuration = "under-30" | "1-6mo" | "6-12mo" | "1-2yr" | "over-2yr";
type CourtStage = "sessions" | "magistrate" | "no-chargesheet" | "high-court";
type PreviousBail = "none" | "1-rejected" | "2plus-rejected" | "granted-cancelled";
type Eligibility = "Likely eligible" | "Uncertain" | "Unlikely eligible";

interface BailStrategyRequestBody {
  sections: string;
  offenseType: OffenseType;
  custodyDuration: CustodyDuration;
  courtStage: CourtStage;
  previousBail: PreviousBail;
  accusedTags: string[];
  age: string;
  firOrCnr: string;
  additionalContext: string;
}

interface BailGround {
  title: string;
  explanation: string;
}

interface BailPrecedent {
  case: string;
  citation: string;
  relevance: string;
}

interface BailStrategyResponse {
  eligibility: Eligibility;
  custodyLabel: string;
  suretyRangeMin: number;
  suretyRangeMax: number;
  recommendedSection: string;
  recommendedCourt: string;
  escalationPath: string;
  grounds: BailGround[];
  precedents: BailPrecedent[];
  courtNote: string;
  biasWarning: string | null;
}

const OFFENSE_TYPES: OffenseType[] = ["non-bailable", "bailable", "ndps", "uapa", "pmla", "unknown"];
const CUSTODY_DURATIONS: CustodyDuration[] = ["under-30", "1-6mo", "6-12mo", "1-2yr", "over-2yr"];
const COURT_STAGES: CourtStage[] = ["sessions", "magistrate", "no-chargesheet", "high-court"];
const PREVIOUS_BAIL_OPTIONS: PreviousBail[] = ["none", "1-rejected", "2plus-rejected", "granted-cancelled"];

const systemPrompt = `You are JuriSight, an expert Indian criminal procedure assistant preparing a structured bail strategy brief.

Return ONLY a valid JSON object with this exact shape:
{
  "eligibility": "Likely eligible" | "Uncertain" | "Unlikely eligible",
  "custodyLabel": string,
  "suretyRangeMin": number,
  "suretyRangeMax": number,
  "recommendedSection": string,
  "recommendedCourt": string,
  "escalationPath": string,
  "grounds": [{ "title": string, "explanation": string }],
  "precedents": [{ "case": string, "citation": string, "relevance": string }],
  "courtNote": string,
  "biasWarning": string | null
}

Mandatory behavior:
- Generate a bail strategy brief for Indian law only.
- Use CrPC provisions or BNSS equivalents, and cite both if uncertain.
- Handle NDPS, UAPA, and PMLA with stricter bail logic and statutory limitations where relevant.
- Check and discuss default bail under CrPC 167(2) or BNSS equivalent when the charge sheet is not filed.
- Grounds must be derived from the accusedTags and overall inputs, not generic boilerplate.
- Include 2 to 4 real precedents relevant to the issue.
- Give a specific court filing strategy tailored to the current courtStage and prior bail history.
- Provide a realistic surety range with minimum and maximum values, not a single exact amount.
- Set biasWarning to a short specific warning if bias risk appears; otherwise null.
- Return only JSON with no markdown, no preface, and no trailing text.`;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function normalizeBody(input: unknown): BailStrategyRequestBody | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const candidate = input as Record<string, unknown>;

  if (!isOneOf(candidate.offenseType, OFFENSE_TYPES)) {
    return null;
  }

  if (!isOneOf(candidate.custodyDuration, CUSTODY_DURATIONS)) {
    return null;
  }

  if (!isOneOf(candidate.courtStage, COURT_STAGES)) {
    return null;
  }

  if (!isOneOf(candidate.previousBail, PREVIOUS_BAIL_OPTIONS)) {
    return null;
  }

  if (
    typeof candidate.sections !== "string" ||
    !isStringArray(candidate.accusedTags) ||
    typeof candidate.age !== "string" ||
    typeof candidate.firOrCnr !== "string" ||
    typeof candidate.additionalContext !== "string"
  ) {
    return null;
  }

  return {
    sections: candidate.sections,
    offenseType: candidate.offenseType,
    custodyDuration: candidate.custodyDuration,
    courtStage: candidate.courtStage,
    previousBail: candidate.previousBail,
    accusedTags: candidate.accusedTags,
    age: candidate.age,
    firOrCnr: candidate.firOrCnr,
    additionalContext: candidate.additionalContext,
  };
}

function stripMarkdownFences(value: string): string {
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

function isGround(value: unknown): value is BailGround {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as BailGround).title === "string" &&
      typeof (value as BailGround).explanation === "string",
  );
}

function isPrecedent(value: unknown): value is BailPrecedent {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as BailPrecedent).case === "string" &&
      typeof (value as BailPrecedent).citation === "string" &&
      typeof (value as BailPrecedent).relevance === "string",
  );
}

function isStrategy(value: unknown): value is BailStrategyResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const strategy = value as BailStrategyResponse;

  return (
    (strategy.eligibility === "Likely eligible" ||
      strategy.eligibility === "Uncertain" ||
      strategy.eligibility === "Unlikely eligible") &&
    typeof strategy.custodyLabel === "string" &&
    typeof strategy.suretyRangeMin === "number" &&
    Number.isFinite(strategy.suretyRangeMin) &&
    typeof strategy.suretyRangeMax === "number" &&
    Number.isFinite(strategy.suretyRangeMax) &&
    strategy.suretyRangeMin >= 0 &&
    strategy.suretyRangeMax >= strategy.suretyRangeMin &&
    typeof strategy.recommendedSection === "string" &&
    typeof strategy.recommendedCourt === "string" &&
    typeof strategy.escalationPath === "string" &&
    Array.isArray(strategy.grounds) &&
    strategy.grounds.length > 0 &&
    strategy.grounds.every(isGround) &&
    Array.isArray(strategy.precedents) &&
    strategy.precedents.length >= 2 &&
    strategy.precedents.length <= 4 &&
    strategy.precedents.every(isPrecedent) &&
    typeof strategy.courtNote === "string" &&
    (typeof strategy.biasWarning === "string" || strategy.biasWarning === null)
  );
}

function labelForCustodyDuration(value: CustodyDuration): string {
  switch (value) {
    case "under-30":
      return "Under 30 days";
    case "1-6mo":
      return "1 to 6 months";
    case "6-12mo":
      return "6 to 12 months";
    case "1-2yr":
      return "1 to 2 years";
    case "over-2yr":
      return "Over 2 years";
  }
}

function labelForOffenseType(value: OffenseType): string {
  switch (value) {
    case "non-bailable":
      return "Non-bailable offense";
    case "bailable":
      return "Bailable offense";
    case "ndps":
      return "NDPS matter";
    case "uapa":
      return "UAPA matter";
    case "pmla":
      return "PMLA matter";
    case "unknown":
      return "Unclear offense classification";
  }
}

function labelForCourtStage(value: CourtStage): string {
  switch (value) {
    case "sessions":
      return "Sessions Court stage";
    case "magistrate":
      return "Magistrate stage";
    case "no-chargesheet":
      return "Charge sheet not filed";
    case "high-court":
      return "High Court stage";
  }
}

function labelForPreviousBail(value: PreviousBail): string {
  switch (value) {
    case "none":
      return "No prior bail rejection";
    case "1-rejected":
      return "One prior rejection";
    case "2plus-rejected":
      return "Two or more prior rejections";
    case "granted-cancelled":
      return "Bail previously granted and later cancelled";
  }
}

function buildPrompt(body: BailStrategyRequestBody): string {
  return [
    "Prepare a structured bail strategy brief from the following Indian criminal matter inputs.",
    "",
    `Sections: ${body.sections.trim() || "Not provided"}`,
    `Offense type: ${labelForOffenseType(body.offenseType)}`,
    `Custody duration: ${labelForCustodyDuration(body.custodyDuration)}`,
    `Court stage: ${labelForCourtStage(body.courtStage)}`,
    `Previous bail status: ${labelForPreviousBail(body.previousBail)}`,
    `Accused tags: ${body.accusedTags.length > 0 ? body.accusedTags.join(", ") : "None provided"}`,
    `Age: ${body.age.trim() || "Not provided"}`,
    `FIR or CNR: ${body.firOrCnr.trim() || "Not provided"}`,
    `Additional context: ${body.additionalContext.trim() || "Not provided"}`,
    "",
    "Important reasoning rules:",
    "- Derive the grounds directly from accused tags and the procedural posture.",
    "- If the court stage indicates no charge sheet, analyze default bail under CrPC 167(2) or BNSS equivalent explicitly.",
    "- If offense type involves NDPS, UAPA, or PMLA, address the stricter statutory bail threshold and explain how it affects strategy.",
    "- Recommend the most suitable court and escalation path based on current stage and prior bail history.",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const body = normalizeBody(rawBody);

    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!body.offenseType) {
      return NextResponse.json({ error: "offenseType is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured." }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const result = await model.generateContent(buildPrompt(body));
    const responseText = stripMarkdownFences(result.response.text());

    let parsed: unknown;

    try {
      parsed = JSON.parse(responseText);
    } catch (error) {
      console.error("Bail strategy parse error:", responseText, error);
      return NextResponse.json({ error: "Model returned invalid JSON." }, { status: 502 });
    }

    if (!isStrategy(parsed)) {
      console.error("Bail strategy validation error:", parsed);
      return NextResponse.json({ error: "Model returned an unexpected strategy format." }, { status: 502 });
    }

    return NextResponse.json({ strategy: parsed });
  } catch (error) {
    console.error("Bail strategy route error:", error);
    return NextResponse.json({ error: "Failed to generate bail strategy." }, { status: 500 });
  }
}
