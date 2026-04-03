import { NextResponse } from "next/server";
import { getOrCreateUser } from "@/lib/user-sync";
import { z } from "zod";
import db from "@/lib/db";
import { parsePdfText } from "@/lib/pdf";

const UploadSchema = z.object({
  caseId: z.string().cuid(),
});

export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const caseIdRaw = formData.get("caseId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing PDF file" }, { status: 400 });
    }

    const { caseId } = UploadSchema.parse({ caseId: String(caseIdRaw ?? "") });

    const caseData = await db.case.findFirst({ where: { id: caseId, userId } });
    if (!caseData) return NextResponse.json({ error: "Case not found" }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsedText = await parsePdfText(buffer);

    const created = await db.document.create({
      data: {
        caseId,
        filename: file.name,
        fileUrl: `uploaded://${file.name}`,
        parsedText,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 });
  }
}