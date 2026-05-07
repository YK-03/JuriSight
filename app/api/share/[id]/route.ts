import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const found = await db.case.findFirst({
    where: { id, isPublic: true },
    include: { analysis: true },
  });

  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: found.id,
    title: found.title,
    createdAt: found.createdAt.toISOString(),
    analysis: found.analysis,
  });
}
