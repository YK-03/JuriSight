import Groq from "groq-sdk";

const GROQ_MODEL = "openai/gpt-oss-120b";
const REQUEST_TIMEOUT_MS = 30000;

export type GroqPrompt = string | {
  system: string;
  user: string;
};

export function buildGroqMessages(prompt: GroqPrompt) {
  if (typeof prompt === "string") return [{ role: "user" as const, content: prompt }];
  if (!prompt.system.trim() || !prompt.user.trim()) {
    throw new Error("System and user prompts must be non-empty strings.");
  }
  return [
    { role: "system" as const, content: prompt.system },
    { role: "user" as const, content: prompt.user },
  ];
}

let groq: Groq | undefined;

function getGroqClient(): Groq {
  if (groq) {
    return groq;
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required to use the Groq AI service.");
  }

  groq = new Groq({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
  return groq;
}

export async function generateAIResponse(prompt: GroqPrompt): Promise<string> {
  if (!prompt || (typeof prompt === "string" && !prompt.trim())) {
    throw new Error("Prompt must be a non-empty string.");
  }

  const messages = buildGroqMessages(prompt);

  try {
    const completion = await getGroqClient().chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.2,
    });

    const text = completion.choices?.[0]?.message?.content || "";

    if (!text || text.trim().length === 0) {
      throw new Error(`Groq returned an empty response for model ${GROQ_MODEL}.`);
    }

    return text;
  } catch (error: any) {
    console.error("[Groq Service Error]:", error?.message || error);

    if (error?.status === 429) {
      throw new Error("AI service rate limit exceeded. Please try again shortly.");
    }
    if (error?.status >= 500 && error?.status < 600) {
      throw new Error("AI provider service temporarily unavailable. Please try again.");
    }
    if (error?.code === "ETIMEDOUT" || error?.name === "APIConnectionTimeoutError") {
      throw new Error("AI service request timed out. Please try again.");
    }

    const safeMessage = (error?.message || "AI service request failed.")
      .replace(/gsk_[a-zA-Z0-9_-]+/g, "[REDACTED]")
      .slice(0, 150);

    throw new Error(safeMessage);
  }
}

export function extractJsonBlock(raw: string): unknown {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("Failed to parse AI response as JSON");
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  if (!candidate) throw new Error("Failed to parse AI response as JSON");

  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error("Failed to parse AI response as complete JSON");
  }
}

export type BailStrategyModelOutput = {
  reasoning: string[];
  keyFactors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`Invalid Bail Strategy model field: ${field}`);
  }

  return value.map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Enforces the Bail Strategy model boundary. The model may supply only
 * contextual reasoning and key factors; all other fields are ignored.
 */
export type BailStrategyGrounding = {
  suppliedFacts: string[];
};

const groundedFactClaims: Array<{ output: RegExp; fact: RegExp }> = [
  { output: /sole breadwinner|only breadwinner|family dependents?/i, fact: /sole breadwinner|only breadwinner|family dependents?/i },
  { output: /no criminal antecedents?|no prior criminal record/i, fact: /no criminal antecedents?|no prior criminal record/i },
  { output: /cooperat(?:ed|ion) with (?:the )?investigation/i, fact: /cooperat(?:ed|ion)|joined investigation/i },
  { output: /permanent resident/i, fact: /permanent resident/i },
  { output: /passport surrendered/i, fact: /passport surrendered/i },
  { output: /no flight risk|not a flight risk/i, fact: /no flight risk|not a flight risk/i },
  { output: /\b(?:\d+(?:\.\d+)?\s*(?:kg|kilograms?|grams?|g)|small quantity|commercial quantity)\b/i, fact: /\b(?:\d+(?:\.\d+)?\s*(?:kg|kilograms?|grams?|g)|small quantity|commercial quantity)\b/i },
  { output: /charge[- ]?sheet.{0,30}\b(?:19|20)\d{2}\b/i, fact: /charge[- ]?sheet.{0,30}\b(?:19|20)\d{2}\b/i },
];

function enforceBailStrategyGrounding(output: BailStrategyModelOutput, grounding?: BailStrategyGrounding): void {
  if (!grounding) return;
  const facts = grounding.suppliedFacts.join(" ");
  const generatedText = [...output.reasoning, ...output.keyFactors].join(" ");
  if (/ignore (?:all )?(?:previous|prior) instructions|system message|developer message/i.test(generatedText)) {
    throw new Error("Bail Strategy model output contains an instruction-like injection");
  }
  for (const claim of groundedFactClaims) {
    if (claim.output.test(generatedText) && !claim.fact.test(facts)) {
      throw new Error("Bail Strategy model output contains an unsupported case-specific fact");
    }
  }
}

export function validateBailStrategyModelOutput(value: unknown, grounding?: BailStrategyGrounding): BailStrategyModelOutput {
  if (!isRecord(value)) {
    throw new Error("Bail Strategy model output must be an object");
  }

  const output = {
    reasoning: normalizeStringArray(value.reasoning, "reasoning"),
    keyFactors: normalizeStringArray(value.keyFactors, "keyFactors"),
  };
  enforceBailStrategyGrounding(output, grounding);
  return output;
}

/** Parse and validate the raw model response at the Bail Strategy boundary. */
export function parseBailStrategyModelOutput(raw: string, grounding?: BailStrategyGrounding): BailStrategyModelOutput {
  return validateBailStrategyModelOutput(extractJsonBlock(raw), grounding);
}
