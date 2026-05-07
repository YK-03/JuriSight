import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateUser } from "@/lib/user-sync";
import { parsePdfText } from "@/lib/pdf";
import { cleanPdfText } from "@/lib/text-cleaning";
import { buildLegacyExtractedCase, extractStructuredDocument } from "@/lib/document-parser";

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

    // 1. Extract raw text from the PDF
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const rawText = await parsePdfText(buffer);

    if (!rawText || rawText.trim().length < 10) {
      return NextResponse.json({ error: "Could not extract enough text from the PDF. Is it a scanned image?" }, { status: 422 });
    }

    const cleanedText = cleanPdfText(rawText);
    if (!cleanedText || cleanedText.trim().length < 10) {
      return NextResponse.json({ error: "Could not derive usable text from the PDF after cleaning." }, { status: 422 });
    }

    const { structured, meta } = await extractStructuredDocument(cleanedText);
    const legacyCandidate = buildLegacyExtractedCase(structured, cleanedText);
    const result = ExtractedCaseSchema.safeParse(legacyCandidate);

    if (!result.success) {
      console.error("[Extract Document] Zod Validation Failed:", result.error.format());
      return NextResponse.json({ 
        error: "Document structure was not recognized correctly.",
        details: result.error.format()
      }, { status: 422 });
    }

    const parsed = result.data;

    console.log("[Extract Document] Pipeline Metrics:", {
      filename: fileEntry.name,
      rawTextLength: rawText.length,
      cleanedTextLength: cleanedText.length,
      documentType: structured.documentType,
      detectedDocumentType: meta.detectedDocumentType,
      chunkingTriggered: meta.chunkingTriggered,
      chunkCount: meta.chunkCount,
      aiCalls: meta.aiCalls,
      aiDurationMs: meta.aiDurationMs,
    });

    return NextResponse.json({
      ...parsed,
      arrestDate: normalizeDate(parsed.arrestDate),
      documentType: structured.documentType,
      accused: structured.accused,
      complainant: structured.complainant,
      sectionsList: structured.sections,
      allegationsList: structured.allegations,
      evidence: structured.evidence,
      courtStage: structured.courtStage,
      custodyFacts: structured.custodyFacts,
      proceduralConcerns: structured.proceduralConcerns,
      timeline: structured.timeline,
      keyEntities: structured.keyEntities,
      extractionMeta: {
        rawTextLength: rawText.length,
        cleanedTextLength: cleanedText.length,
        ...meta,
      },
    });
  } catch (error) {
    console.error("[Extract Document] Error:", error);
    const message = error instanceof Error ? error.message : "Document extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
