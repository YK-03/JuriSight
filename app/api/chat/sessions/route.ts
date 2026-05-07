import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getOrCreateUser } from "@/lib/user-sync";

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await db.chatSession.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 5,
    include: {
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  return NextResponse.json(
    sessions.map((session) => {
      let displayTitle = session.title;
      if (displayTitle.includes("You are JuriSight's legal awareness") || displayTitle.includes("You are JuriSight awareness")) {
        displayTitle = "Document Analysis Session";
      }

      return {
        id: session.id,
        title: displayTitle,
        updatedAt: session.updatedAt.toISOString(),
        caseId: session.caseId,
        lastMessage: session.messages[0]
          ? {
              id: session.messages[0].id,
              role: session.messages[0].role,
              content: session.messages[0].content,
              createdAt: session.messages[0].createdAt.toISOString(),
            }
          : null,
      };
    }),
  );
}
