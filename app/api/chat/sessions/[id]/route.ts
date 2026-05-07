import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-sync";
import db from "@/lib/db";

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
