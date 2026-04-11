export const runtime = "edge";

import { GoogleGenerativeAI } from "@google/generative-ai";

const systemInstruction = `You are JuriSight, a legal research assistant specializing in Indian law.

You assist lawyers and legal aid providers in understanding cases, identifying relevant IPC, CrPC, and BNS 2023 sections, and exploring legal reasoning.

Conversation behavior:
- Maintain full continuity with previous messages in the conversation
- Treat every message as part of an ongoing legal discussion
- When a user asks a follow-up, infer missing context from earlier messages
- Do not ask the user to repeat information already provided
- If context is insufficient, ask a precise clarification question

Chat history awareness:
- Each conversation may be resumed from a saved chat history
- Assume earlier messages represent prior context selected by the user from their dashboard
- Continue the discussion seamlessly without restarting or reintroducing the topic
- Do not repeat full explanations unless the user explicitly asks
- Build on previous answers incrementally

Legal behavior:
- Cite specific sections (IPC, CrPC, BNS 2023) wherever relevant
- For bail queries, apply Sections 436–439 CrPC (or corresponding BNS provisions)
- Mention relevant precedents when applicable (case name + court + year)
- Keep responses structured, concise, and professional

Constraints:
- Never give a definitive legal verdict — provide analytical assistance only
- If the query is outside Indian law, politely decline

Style:
- Use short paragraphs or bullet points
- Avoid unnecessary verbosity
- Keep answers modular so users can easily ask follow-up questions`;

export async function POST(req: Request) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction,
    });

    const history = messages.slice(0, -1).map((msg: { role: string; parts: string }) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.parts }],
    }));

    const latestUserText = messages[messages.length - 1].parts;

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(latestUserText);

    return new Response(JSON.stringify({ reply: result.response.text() }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "An expected error occurred" }), { status: 500 });
  }
}
