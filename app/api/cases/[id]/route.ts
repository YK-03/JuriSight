import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-sync";
import { z } from "zod";
import  db  from "@/lib/db";

const CasePatchSchema = z.object({
  title: z.string().min(2).optional(),
  accusedName: z.string().min(2).optional(),
  section: z.string().min(1).optional(),
  offenseType: z.string().min(2).optional(),
  accusedProfile: z.string().min(2).optional(),
  priorRecord: z.boolean().optional(),
  offenseDescription: z.string().min(10).optional(),
  cooperationLevel: z.string().min(2).optional(),
  jurisdiction: z.string().min(2).optional(),
  legalFramework: z.string().optional(),
  specialAct: z.string().optional(),
  dateOfArrest: z.string().datetime().optional().nullable(),
  maximumSentenceYears: z.number().int().positive().optional().nullable(),
  timeServedDays: z.number().int().nonnegative().optional().nullable(),
  status: z.enum(["PENDING", "ANALYZED", "CLOSED"]).optional(),
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  const { id } = await context.params;

  const found = await db.case.findFirst({
    where: { id, userId },
    include: { analysis: true, documents: true },
  });

  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(found);
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const { id } = await context.params;
    const body = CasePatchSchema.parse(await req.json());

    const exists = await db.case.findFirst({ where: { id, userId } });
    if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await db.case.update({
      where: { id },
      data: {
        ...body,
        dateOfArrest: body.dateOfArrest ? new Date(body.dateOfArrest) : body.dateOfArrest,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update case" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id:string }> }) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  const { id } = await context.params;
  const exists = await db.case.findFirst({ where: { id, userId } });

  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.case.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
