import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-sync";
import { z } from "zod";
import db from "@/lib/db";

const CaseCreateSchema = z.object({
  title: z.string().min(2),
  accusedName: z.string().min(2),
  section: z.string().min(1),
  offenseType: z.string().min(2),
  accusedProfile: z.string().min(2),
  priorRecord: z.boolean(),
  offenseDescription: z.string().min(10),
  cooperationLevel: z.string().min(2),
  jurisdiction: z.string().min(2),
  legalFramework: z.string().optional(),
  specialAct: z.string().optional(),
  dateOfArrest: z.string().datetime().optional(),
  maximumSentenceYears: z.number().int().positive().optional(),
  timeServedDays: z.number().int().nonnegative().optional(),
});

export async function GET() {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  const cases = await db.case.findMany({
    where: { userId },
    include: { analysis: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(cases);
}

export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const json = await req.json();
    const body = CaseCreateSchema.parse(json);

    const created = await db.case.create({
      data: {
        title: body.title,
        accusedName: body.accusedName,
        section: body.section,
        offenseType: body.offenseType,
        accusedProfile: body.accusedProfile,
        priorRecord: body.priorRecord,
        offenseDescription: body.offenseDescription,
        cooperationLevel: body.cooperationLevel,
        jurisdiction: body.jurisdiction,
        legalFramework: body.legalFramework,
        specialAct: body.specialAct,
        dateOfArrest: body.dateOfArrest ? new Date(body.dateOfArrest) : null,
        maximumSentenceYears: body.maximumSentenceYears,
        timeServedDays: body.timeServedDays,
        user: {
          connect: { id: userId },
        },
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create case" }, { status: 500 });
  }
}
