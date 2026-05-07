import { generateAIResponse } from "@/lib/groq";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-sync";

export const runtime = "nodejs";

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
- For bail queries, apply Sections 436-439 CrPC (or corresponding BNS provisions)
- Mention relevant precedents when applicable (case name + court + year)
- Keep responses structured, concise, and professional

Constraints:
- Never give a definitive legal verdict - provide analytical assistance only
- If the query is outside Indian law, politely decline

Style:
- Use short paragraphs or bullet points
- Avoid unnecessary verbosity
- Keep answers modular so users can easily ask follow-up questions`;

type IncomingMessage = {
  id?: string;
  role: string;
  parts: string;
};

type ChatRequestBody = {
  messages?: IncomingMessage[];
  sessionId?: string | null;
  caseId?: string | null;
};

function buildSessionTitle(messages: IncomingMessage[]) {
  const firstUserMessage = messages.find((message) => 
    message.role === "user" && message.id !== "jurisight-policy-context"
  )?.parts?.trim() || "";
  
  if (firstUserMessage.startsWith("📄")) {
    const lines = firstUserMessage.split("\n");
    const fileNameLine = lines[0].replace("📄", "").trim();
    const userQueryLine = lines.find(l => l.trim() && !l.startsWith("📄") && !l.startsWith("["));
    
    if (userQueryLine) {
      const title = `Document: ${fileNameLine} (${userQueryLine.slice(0, 20)}...)`;
      return title.length > 80 ? `${title.slice(0, 80).trim()}...` : title;
    }
    const title = `Document: ${fileNameLine}`;
    return title.length > 80 ? `${title.slice(0, 80).trim()}...` : title;
  }

  if (firstUserMessage.startsWith("[Uploaded Document:")) {
    const lines = firstUserMessage.split("\n");
    const docMatch = lines[0].match(/\[Uploaded Document:\s*(.*?)\]/);
    const fileName = docMatch ? docMatch[1].trim() : "document.pdf";
    const userQueryLine = lines.find(l => l.trim() && l.startsWith("User question:"));
    
    if (userQueryLine) {
      const query = userQueryLine.replace("User question:", "").trim();
      const title = `Document: ${fileName} (${query.slice(0, 20)}...)`;
      return title.length > 80 ? `${title.slice(0, 80).trim()}...` : title;
    }
    
    const title = `Document: ${fileName}`;
    return title.length > 80 ? `${title.slice(0, 80).trim()}...` : title;
  }

  const title = firstUserMessage || "Untitled conversation";
  return title.length > 80 ? `${title.slice(0, 80).trim()}...` : title;
}

function getLatestUserMessage(messages: IncomingMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user" && message.parts.trim());
}


export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }

  try {
    const { messages, sessionId, caseId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }

    const latestUserText = messages[messages.length - 1]?.parts;

    if (typeof latestUserText !== "string" || !latestUserText.trim()) {
      return new Response(JSON.stringify({ error: "Latest user message is required." }), { status: 400 });
    }

    const user = await getOrCreateUser();
    const persistedSessionId =
      typeof sessionId === "string" && sessionId.trim() ? sessionId : null;

    const cacheKey = JSON.stringify({ persistedSessionId, latestUserText });
    let aiResponse;
    try {
      let chatHistoryText = "";
      
      if (user && persistedSessionId) {
        const existingSession = await db.chatSession.findFirst({
          where: {
            id: persistedSessionId,
            userId: user.id,
          },
          include: {
            messages: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

        if (existingSession) {
          chatHistoryText = existingSession.messages
            .map((message) => `${message.role === "assistant" ? "AI" : "User"}: ${message.content}`)
            .join("\n\n");
        }
      } else {
        chatHistoryText = messages.slice(0, -1)
          .map((msg) => `${msg.role === "model" ? "AI" : "User"}: ${msg.parts}`)
          .join("\n\n");
      }

      const prompt = `${systemInstruction}\n\nChat History:\n${chatHistoryText}\n\nUser: ${latestUserText}\n\nAI:`;
      
      console.log("[Chat API] Sending prompt to Groq. Length:", prompt.length);
      const rawText = await generateAIResponse(prompt);
      console.log("[Chat API] Received response from Groq. Length:", rawText.length);

      aiResponse = { success: true, text: rawText.trim() };
    } catch (error) {
      console.error("[Chat API] Groq Error:", error);
      aiResponse = { success: false, fallback: true };
    }

    if (!aiResponse.success || aiResponse.fallback) {
      return new Response(
        JSON.stringify({ success: false, fallback: true, message: aiResponse.message || "AI is currently under heavy load. Please try again shortly." }), 
        { status: 200 }
      );
    }
    
    const reply = aiResponse.text as string;

    let nextSessionId: string | null = persistedSessionId;

    try {
      if (user) {
        let validCaseId: string | null = null;
        if (typeof caseId === "string" && caseId.trim()) {
          const caseRecord = await db.case.findFirst({
            where: {
              id: caseId,
              userId: user.id,
            },
            select: { id: true },
          });
          validCaseId = caseRecord?.id ?? null;
        }

        let chatSession =
          nextSessionId
            ? await db.chatSession.findFirst({
                where: {
                  id: nextSessionId,
                  userId: user.id,
                },
                select: {
                  id: true,
                },
              })
            : null;

        if (!chatSession) {
          chatSession = await db.chatSession.create({
            data: {
              userId: user.id,
              caseId: validCaseId,
              title: buildSessionTitle(messages),
            },
            select: {
              id: true,
            },
          });
        } else {
          await db.chatSession.update({
            where: { id: chatSession.id },
            data: {
              title: buildSessionTitle(messages),
              caseId: validCaseId ?? undefined,
            },
          });
        }

        const latestUserMessage = getLatestUserMessage(messages);

        if (latestUserMessage) {
          await db.message.createMany({
            data: [
              {
                chatSessionId: chatSession.id,
                role: "user",
                content: latestUserMessage.parts.trim(),
              },
              {
                chatSessionId: chatSession.id,
                role: "assistant",
                content: reply,
              },
            ],
          });

          await db.chatSession.update({
            where: { id: chatSession.id },
            data: {},
          });
        }

        nextSessionId = chatSession.id;
      }
    } catch (persistenceError) {
      console.error("Chat persistence failed:", persistenceError);
    }

    return new Response(JSON.stringify({ reply, sessionId: nextSessionId }), { status: 200 });
  } catch (e: any) {
    console.error("[API ERROR]", e);

    return new Response(
      JSON.stringify({
        success: false,
        fallback: true,
        message: "AI is currently under heavy load. Please try again shortly."
      }),
      { status: 200 }
    );
  }
}
