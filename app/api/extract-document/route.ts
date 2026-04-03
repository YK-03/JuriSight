import { NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { getOrCreateUser } from "@/lib/user-sync";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ExtractedCaseSchema = z.object({
  title: z.string(),
  accusedName: z.string(),
  accusedAge: z.number().int().nullable(),
  firNumber: z.string(),
  policeStation: z.string(),
  district: z.string(),
  state: z.string(),
  sections: z.string(),
  allegations: z.string(),
  arrestDate: z.string(),
  custodyDuration: z.string(),
  previousConvictions: z.boolean(),
  notes: z.string(),
});

function extractJsonBlock(raw: string): unknown {
  return JSON.parse(raw.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

export async function POST(req: Request) {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is missing" }, { status: 500 });
    }

    const formData = await req.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    if (fileEntry.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    if (fileEntry.size === 0 || fileEntry.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "PDF must be between 1 byte and 10MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const base64 = buffer.toString("base64");

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system:
        "You are a legal document parser for Indian criminal law. Extract structured case information from the uploaded FIR, charge sheet, or remand order. Return ONLY valid JSON.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the structured case information from this PDF. If a field is missing, use an empty string for string fields and null only for accusedAge.",
            },
            {
              type: "file",
              data: base64,
              mediaType: "application/pdf",
              filename: fileEntry.name,
            },
          ],
        },
      ],
    });

    const parsed = ExtractedCaseSchema.parse(extractJsonBlock(text));

    return NextResponse.json({
      ...parsed,
      arrestDate: normalizeDate(parsed.arrestDate),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
