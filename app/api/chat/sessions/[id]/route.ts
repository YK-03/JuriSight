import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-sync";
import db from "@/lib/db";

function mapMessageRole(role: string): "user" | "model" {
  return role === "assistant" || role === "model" ? "model" : "user";
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const session = await db.chatSession.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let displayTitle = session.title;
  if (
    displayTitle.includes("You are JuriSight's legal awareness") ||
    displayTitle.includes("You are JuriSight awareness")
  ) {
    displayTitle = "Document Analysis Session";
  }

  return NextResponse.json({
    id: session.id,
    title: displayTitle,
    caseId: session.caseId,
    messages: session.messages.map((message) => ({
      id: message.id,
      role: mapMessageRole(message.role),
      content: message.content,
      timestamp: message.createdAt.getTime(),
    })),
  });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const exists = await db.chatSession.findFirst({
      where: { id, userId: user.id },
    });

    if (!exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Cascade delete is likely not set up for messages, so we delete messages first if necessary.
    // Assuming schema handles cascade, but let's be safe.
    await db.$transaction([
      db.message.deleteMany({ where: { chatSessionId: id } }),
      db.chatSession.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/chat/sessions] Failed to delete session:", error);
    return NextResponse.json({ error: "Failed to delete chat session" }, { status: 500 });
  }
}
