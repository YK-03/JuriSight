import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export async function generateAIResponse(prompt: string) {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
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
    throw new Error("Empty response from model");
  }

  return text;
}
