import { generateAIResponse, parseBailStrategyModelOutput } from "@/lib/groq";
import { getSuretyRange } from "@/lib/surety-engine";
import { NextResponse } from "next/server";
import { runLegalRules } from "@/lib/legal-rules";
import { resolveLegalFramework } from "@/lib/legal-framework";
import {
  isChargesheetFiledForBailStrategyStage,
  normalizeBailStrategyCourtStage,
} from "@/lib/section-preservation";
import {
  determineAuthoritativeEligibility,
  labelForOffenseType,
  labelForCustodyDuration,
  labelForCourtStage,
  labelForPreviousBail,
  type AuthoritativeEligibilityResult,
  type DeterministicFindingsMetadata,
  type OffenseType,
  type CustodyDuration,
  type PreviousBail,
  type BailStrategyInput as BailStrategyRequestBody,
} from "@/lib/bail-strategy-engine";
import {
  buildBailAuthorityQuery,
  retrieveAuthoritiesSafely,
  retrieveVerifiedAuthorities,
  selectVerifiedOrCuratedAuthorities,
  type RetrievedAuthority,
} from "@/lib/authority-retrieval";
import { curatedAuthorityRetriever } from "@/lib/curated-authority-retriever";
import { ecourtsIndiaAuthorityProvider } from "@/lib/ecourtsindia-authority-provider";

export const runtime = "nodejs";

const OFFENSE_TYPES: OffenseType[] = ["non-bailable", "bailable", "ndps", "uapa", "pmla", "unknown"];
const CUSTODY_DURATIONS: CustodyDuration[] = ["under-30", "1-6mo", "6-12mo", "1-2yr", "over-2yr"];
const PREVIOUS_BAIL_OPTIONS: PreviousBail[] = ["none", "1-rejected", "2plus-rejected", "granted-cancelled"];

const systemPrompt = `You are a legal reasoning assistant in Indian criminal bail law.

Your task is to provide structured legal explanation for a bail matter based on given case facts and backend legal posture.

RULES:
1. Do NOT decide, alter, or override statutory bail findings.
2. For discretionary non-bailable matters, regular bail is an exercise of judicial discretion. Analyze the competing factors (severity, custody duration, chargesheet filing, parity, criminal antecedents) without asserting statutory certainty.
3. Return ONLY valid JSON:
{
  "reasoning": ["point 1 on statutory posture / judicial discretion", "point 2 analyzing factual considerations", "point 3 on procedural steps and conditions"],
  "keyFactors": ["factor 1", "factor 2", "factor 3"]
}
4. Keep responses concise, objective, and legally grounded. No paragraphs, no drafting, no placeholders.`;

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

  const courtStage = normalizeBailStrategyCourtStage(candidate.courtStage);
  if (!courtStage) {
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
    legalFramework: resolveLegalFramework({
      explicit: candidate.legalFramework,
      suppliedSections: candidate.sections,
    }),
    offenseType: candidate.offenseType,
    custodyDuration: candidate.custodyDuration,
    courtStage,
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

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function buildPrompt(
  body: BailStrategyRequestBody,
  promptInjection: string,
  authoritativeResult: AuthoritativeEligibilityResult,
  retrievedAuthorities: RetrievedAuthority[],
): string {
  const lines = [promptInjection, ""];

  if (authoritativeResult.authority === "DETERMINISTIC") {
    lines.push(
      "AUTHORITATIVE STATUTORY FINDING (BACKEND ESTABLISHED — DO NOT ALTER):",
      `- Statutory Finding: [${authoritativeResult.eligibility}]`,
      `- Authority Classification: [Deterministic statutory finding]`,
      `- Legal Basis: ${authoritativeResult.ruleSummary}`,
      "",
      "INSTRUCTIONS FOR AI EXPLANATION:",
      "- Explain why this statutory finding applies under Indian criminal law.",
      "- Groq cannot override, contradict, or alter this statutory entitlement/bar.",
      "- Address relevant procedural posture and conditions the court may impose."
    );
  } else if (authoritativeResult.authority === "DISCRETIONARY") {
    lines.push(
      "LEGAL POSTURE: DISCRETIONARY BAIL ANALYSIS (NON-BAILABLE OFFENSE):",
      `- Machine-Readable Baseline: [Uncertain] (regular bail is discretionary; no statutory entitlement exists)`,
      `- Authority Classification: [Discretionary analysis]`,
      `- Legal Ground: ${authoritativeResult.ruleSummary}`,
      "",
      "STRUCTURED CASE FACTORS TO WEIGH:",
      ...(authoritativeResult.discretionaryFactors || []).map((f) => `- ${f}`),
      "",
      "INSTRUCTIONS FOR AI EXPLANATION:",
      "- Explicitly acknowledge that regular bail is an exercise of judicial discretion under CrPC 437/439 (or BNSS 480/483) rather than a statutory entitlement.",
      "- Analyze the competing factors that may support or weigh against bail based on the supplied facts and established legal principles.",
      "- Do NOT present your analysis as an absolute statutory entitlement or deterministic legal conclusion.",
      "- Do NOT convert the baseline status into a fabricated certainty."
    );
  } else {
    lines.push(
      "LEGAL POSTURE: UNRESOLVED STATUTORY CLASSIFICATION:",
      `- Machine-Readable Baseline: [Uncertain]`,
      `- Authority Classification: [Unresolved statutory finding]`,
      `- Note: ${authoritativeResult.ruleSummary}`,
      "",
      "INSTRUCTIONS FOR AI EXPLANATION:",
      "- Provide contextual legal reasoning based on general principles only.",
      "- Clearly acknowledge that statutory classification remains unverified by the deterministic engine."
    );
  }

  lines.push(
    "",
    "RETRIEVED LEGAL AUTHORITIES (REFERENCE MATERIAL ONLY):",
    retrievedAuthorities.length > 0
      ? JSON.stringify(retrievedAuthorities, null, 2)
      : "No curated authority matched the structured bail issues.",
    "",
    "AUTHORITY SAFETY RULES:",
    "- Deterministic backend findings are authoritative and cannot be changed by authorities or Groq.",
    "- Retrieved authorities are contextual reference material, not a bail decision rule.",
    "- Do not invent cases, citations, URLs, courts, quotations, or passages.",
    "- Do not call an authority binding unless supplied metadata supports that characterization.",
    "- Distinguish binding, persuasive, and unknown authority levels when metadata exists.",
    "- A retrieved authority may explain a listed issue but cannot create a new eligibility conclusion.",
    "- Never convert the number or frequency of authorities into an eligibility score or rule.",
    "- Acknowledge when the retrieved material is insufficient.",
    "",
    "CASE FACTS:",
  );
  const sections = clean(body.sections);
  if (sections) lines.push(`Sections: ${sections}`);
  if (body.legalFramework) lines.push(`Legal framework: ${body.legalFramework}`);

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
    const chargesheetFiled = isChargesheetFiledForBailStrategyStage(body.courtStage);

    const legalRules = runLegalRules({
      sections: parsedSections,
      custodyDays,
      chargesheetFiled,
      age: parsedAge,
      framework: body.legalFramework,
      ndpsQuantity: body.ndpsQuantity,
      pmlaAmount: body.pmlaAmount,
    });

    const authoritativeResult = determineAuthoritativeEligibility(
      legalRules,
      body,
      custodyDays,
      chargesheetFiled,
    );

    const authorityQuery = buildBailAuthorityQuery({
      input: body,
      legalRules,
      authoritativeResult,
      custodyDays,
      chargesheetFiled,
    });

    const verifiedAuthorities = await retrieveVerifiedAuthorities(
      ecourtsIndiaAuthorityProvider,
      authorityQuery,
      (errors) => console.error("[eCourtsIndia Authority Rejected]:", errors),
      () => console.error("[eCourtsIndia Authority Retrieval Error]"),
    );
    const curatedAuthorities: RetrievedAuthority[] = verifiedAuthorities.length > 0
      ? []
      : await retrieveAuthoritiesSafely(
        curatedAuthorityRetriever,
        authorityQuery,
        (retrievalError) => console.error("[Bail Strategy Authority Retrieval Error]:", retrievalError),
      );
    const retrievedAuthorities = selectVerifiedOrCuratedAuthorities(verifiedAuthorities, curatedAuthorities);

    console.log("[Bail Strategy] Retrieval summary", {
      eligibility: authoritativeResult.eligibility,
      authority: authoritativeResult.authority,
      verifiedCount: verifiedAuthorities.length,
      curatedCount: curatedAuthorities.length,
      fallbackUsed: verifiedAuthorities.length === 0,
    });

    let aiResponse;
    try {
      const prompt = `${systemPrompt}\n\n${buildPrompt(body, legalRules.promptInjection, authoritativeResult, retrievedAuthorities)}\n\nReturn ONLY valid JSON. Do not include explanations, markdown, or extra text.`;

      const rawText = await generateAIResponse(prompt);
      const modelOutput = parseBailStrategyModelOutput(rawText);
      const reasoning = modelOutput.reasoning;
      const keyFactors = modelOutput.keyFactors;

      aiResponse = {
        success: true,
        strategy: {
          eligibility: authoritativeResult.eligibility,
          authority: authoritativeResult.authority,
          ruleSummary: authoritativeResult.ruleSummary,
          deterministicFindings: authoritativeResult.deterministicFindings,
          discretionaryFactors: authoritativeResult.discretionaryFactors,
          retrievedAuthorities,
          reasoning: reasoning.length > 0 ? reasoning : [
            authoritativeResult.ruleSummary,
            "Investigation status and custody duration are relevant",
            "Court will consider overall circumstances"
          ],
          keyFactors: keyFactors.length > 0 ? keyFactors : [
            legalRules.offenseClass.primarySection || labelForOffenseType(body.offenseType),
            labelForCustodyDuration(body.custodyDuration),
            labelForCourtStage(body.courtStage),
          ],
        },
      };
    } catch (error: any) {
      console.error("[Bail Strategy AI Error]:", error instanceof Error ? error.name : typeof error);
      return NextResponse.json(
        { success: false, error: "AI service unavailable. Please try again." },
        { status: 503 }
      );
    }

    if (!aiResponse?.strategy) {
      return NextResponse.json(
        { success: false, error: "Unable to generate bail strategy. Please try again." },
        { status: 502 }
      );
    }

    const suretyResult = getSuretyRange(body);
    const finalStrategy = {
      ...aiResponse.strategy,
      success: true,
      suretyRangeMin: suretyResult.min,
      suretyRangeMax: suretyResult.max,
      suretyLabel: suretyResult.label,
    };

    return NextResponse.json({ success: true, strategy: finalStrategy });
  } catch (e: any) {
    console.error("[API ERROR]", e instanceof Error ? e.name : typeof e);

    return NextResponse.json(
      { success: false, error: "Unable to process bail strategy. Please try again." },
      { status: 500 }
    );
  }
}
