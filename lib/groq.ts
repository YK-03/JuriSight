import Groq from "groq-sdk";

const GROQ_MODEL =  "openai/gpt-oss-120b";

let groq: Groq | undefined;

function getGroqClient(): Groq {
  if (groq) {
    return groq;
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required to use the Groq AI service.");
  }

  groq = new Groq({ apiKey });
  return groq;
}

export async function generateAIResponse(prompt: string) {
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
}
