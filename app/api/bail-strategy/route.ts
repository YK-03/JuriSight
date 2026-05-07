import { generateAIResponse } from "@/lib/groq";
import { getSuretyRange } from "@/lib/surety-engine";
import { NextResponse } from "next/server";
import { runLegalRules } from "@/lib/legal-rules";

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
  ndpsQuantity?: any;
  pmlaAmount?: number;
}

interface BailStrategyResponse {
  eligibility: string;
  reasoning: string[];
  keyFactors: string[];
}

const OFFENSE_TYPES: OffenseType[] = ["non-bailable", "bailable", "ndps", "uapa", "pmla", "unknown"];
const CUSTODY_DURATIONS: CustodyDuration[] = ["under-30", "1-6mo", "6-12mo", "1-2yr", "over-2yr"];
const COURT_STAGES: CourtStage[] = ["sessions", "magistrate", "no-chargesheet", "high-court"];
const PREVIOUS_BAIL_OPTIONS: PreviousBail[] = ["none", "1-rejected", "2plus-rejected", "granted-cancelled"];

const systemPrompt = `You are a legal reasoning assistant.

Your task is to analyze bail eligibility based on given case facts.

Return ONLY valid JSON. Do not include explanations, markdown, or extra text.

{
  "eligibility": "Likely Eligible" | "Moderate Chance" | "Low Probability",
  "reasoning": ["short point 1", "short point 2"],
  "keyFactors": ["factor 1", "factor 2"]
}

Rules:
* Keep responses concise
* No paragraphs
* No bail application drafting
* No placeholders
* Focus on legal factors (chargesheet, custody, parity, offence severity)`;

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
    ndpsQuantity: candidate.ndpsQuantity,
    pmlaAmount: typeof candidate.pmlaAmount === "number" ? candidate.pmlaAmount : undefined,
  };
}

function parseCustodyDays(custodyDuration: string): number {
  const val = custodyDuration.toLowerCase();
  if (val.includes("under") || val.includes("30")) return 25;
  if (val.includes("1 to 6") || val.includes("1-6")) return 90;
  if (val.includes("6 to 12") || val.includes("6-12")) return 180;
  if (val.includes("1 to 2") || val.includes("1-2")) return 365;
  if (val.includes("over 2") || val.includes("2+")) return 730;
  return 30; // safe default
}

function parseSections(sections: string): string[] {
  return sections
    .split(/[,\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function parseAge(age: string | number | undefined): number {
  if (typeof age === "number") return age;
  if (!age) return 25;
  const match = String(age).match(/\d+/);
  return match ? parseInt(match[0], 10) : 25;
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

function isStrategy(value: unknown): value is BailStrategyResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const strategy = value as BailStrategyResponse;

  return (
    typeof strategy.eligibility === "string" &&
    Array.isArray(strategy.reasoning) &&
    Array.isArray(strategy.keyFactors) &&
    strategy.reasoning.every(r => typeof r === "string") &&
    strategy.keyFactors.every(f => typeof f === "string")
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

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function buildPrompt(body: BailStrategyRequestBody, promptInjection: string): string {
  const lines = [
    promptInjection,
    "",
    "Prepare a structured bail strategy brief from the following Indian criminal matter inputs."
  ];

  const sections = clean(body.sections);
  if (sections) lines.push(`Sections: ${sections}`);

  const offense = labelForOffenseType(body.offenseType);
  if (offense) lines.push(`Offense type: ${offense}`);

  const custody = labelForCustodyDuration(body.custodyDuration);
  if (custody) lines.push(`Custody duration: ${custody}`);

  const court = labelForCourtStage(body.courtStage);
  if (court) lines.push(`Court stage: ${court}`);

  const bailStatus = labelForPreviousBail(body.previousBail);
  if (bailStatus) lines.push(`Previous bail status: ${bailStatus}`);

  if (body.accusedTags && body.accusedTags.length > 0) {
    const tags = body.accusedTags.map(clean).filter(Boolean).join(", ");
    if (tags) lines.push(`Accused tags: ${tags}`);
  }

  const age = clean(body.age);
  if (age) lines.push(`Age: ${age}`);

  const fir = clean(body.firOrCnr);
  if (fir) lines.push(`FIR or CNR: ${fir}`);

  const ctx = clean(body.additionalContext);
  if (ctx) lines.push(`Additional context: ${ctx}`);

  lines.push(
    "",
    "Important reasoning rules:",
    "- Derive the grounds directly from accused tags and the procedural posture.",
    "- Default bail eligibility under CrPC 167(2) has already been computed deterministically by the backend. Follow the DETERMINISTIC LEGAL FINDINGS above. Do NOT independently assess 167(2) eligibility.",
    "- If offense type involves NDPS, UAPA, or PMLA, address the stricter statutory bail threshold and explain how it affects strategy.",
    "- Recommend the most suitable court and escalation path based on current stage and prior bail history."
  );

  return lines.join("\n");
}


export async function POST(request: Request) {
  let rawBody;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const body = normalizeBody(rawBody);

    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (!body.offenseType) {
      return NextResponse.json({ error: "offenseType is required." }, { status: 400 });
    }

    const custodyDays = parseCustodyDays(body.custodyDuration ?? "");
    const parsedSections = parseSections(body.sections ?? "");
    const parsedAge = parseAge(body.age);
    const chargesheetFiled = (body.courtStage ?? "").toLowerCase().includes("no-chargesheet") === false
      && (body.courtStage ?? "").toLowerCase() !== "no-chargesheet";

    const legalRules = runLegalRules({
      sections: parsedSections,
      custodyDays,
      chargesheetFiled,
      age: parsedAge,
      ndpsQuantity: body.ndpsQuantity,
      pmlaAmount: body.pmlaAmount,
    });

    console.log("[LegalRules] Custody days:", custodyDays);
    console.log("[LegalRules] Sections:", parsedSections);
    console.log("[LegalRules] promptInjection:\n", legalRules.promptInjection);

    const cacheKey = JSON.stringify(body);

    let aiResponse;
    try {
      const prompt = `${systemPrompt}\n\n${buildPrompt(body, legalRules.promptInjection)}\n\nReturn ONLY valid JSON. Do not include explanations, markdown, or extra text.`;
      console.log("[Final Prompt String]", prompt);

      const rawText = await generateAIResponse(prompt);
      
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

      if (
        !parsed.eligibility ||
        !Array.isArray(parsed.reasoning) ||
        !Array.isArray(parsed.keyFactors)
      ) {
        throw new Error("Invalid JSON structure from model");
      }

      aiResponse = { success: true, text: safeText };
    } catch (error) {
      console.error("[Groq Error]", error);
      aiResponse = { success: false, fallback: true };
    }

    if (!aiResponse.success || aiResponse.fallback) {
      // Deterministic Safe Fallback inside pipeline
      const suretyResult = getSuretyRange(body);
      return NextResponse.json({
        success: true,
        strategy: {
          eligibility: "Moderate Chance",
          reasoning: [
            "Case involves non-bailable offence",
            "Investigation status and custody duration are relevant",
            "Court will consider overall circumstances"
          ],
          keyFactors: [],
          suretyRangeMin: suretyResult.min,
          suretyRangeMax: suretyResult.max,
          suretyLabel: suretyResult.label,
        }
      });
    }

    const responseText = aiResponse.text as string;

    let parsed: unknown;

    try {
      parsed = JSON.parse(responseText);
    } catch (err) {
      throw new Error("Invalid JSON response from model");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid JSON structure");
    }

    const suretyResult = getSuretyRange(body);
    const finalStrategy = {
      ...(parsed as BailStrategyResponse),
      success: true,
      suretyRangeMin: suretyResult.min,
      suretyRangeMax: suretyResult.max,
      suretyLabel: suretyResult.label,
    };

    return NextResponse.json({ success: true, strategy: finalStrategy });
  } catch (e: any) {
    console.error("[API ERROR]", e);

    // Hard fallback trigger when top level execution fails completely
    return NextResponse.json(
      { 
        success: true, 
        strategy: {
          eligibility: "Moderate Chance",
          reasoning: [
            "Case involves non-bailable offence",
            "Investigation status and custody duration are relevant",
            "Court will consider overall circumstances"
          ],
          keyFactors: [],
          suretyRangeMin: 5000,
          suretyRangeMax: 50000,
          suretyLabel: "Dependent on judicial discretion",
        }
      },
      { status: 200 }
    );
  }
}
