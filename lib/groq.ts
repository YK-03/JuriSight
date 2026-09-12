import Groq from "groq-sdk";

const GROQ_MODEL = "openai/gpt-oss-120b";
const REQUEST_TIMEOUT_MS = 30000;

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

export async function generateAIResponse(prompt: string): Promise<string> {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Prompt must be a non-empty string.");
  }

  try {
    const completion = await getGroqClient().chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
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
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  for (const candidate of [trimmed, unfenced]) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const cleaned = candidate.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(cleaned);
      } catch {
        // Continue to search
      }
    }
  }

  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = unfenced.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const cleaned = candidate.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(cleaned);
      } catch {
        // Continue
      }
    }
  }

  const firstBracket = unfenced.indexOf("[");
  const lastBracket = unfenced.lastIndexOf("]");

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const candidate = unfenced.slice(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        const cleaned = candidate.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(cleaned);
      } catch {
        // Continue
      }
    }
  }

  throw new Error("Failed to parse AI response as JSON");
}
