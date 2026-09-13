export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateUser } from "@/lib/user-sync";
import { parsePdfDetails } from "@/lib/pdf";
import { cleanPdfText } from "@/lib/text-cleaning";
import {
  buildLegacyExtractedCase,
  extractStructuredDocument,
} from "@/lib/document-parser";
import { ocrScannedPdf } from "@/lib/ocr";

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
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const formData = await req.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "PDF file is required" },
        { status: 400 },
      );
    }

    const isPdfMime = fileEntry.type === "application/pdf";
    const isPdfExt = fileEntry.name.toLowerCase().endsWith(".pdf");
    const isGenericOrEmptyMime =
      !fileEntry.type ||
      fileEntry.type === "application/octet-stream";

    if (!isPdfMime && !(isPdfExt && isGenericOrEmptyMime)) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 },
      );
    }

    if (
      fileEntry.size === 0 ||
      fileEntry.size > MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        { error: "PDF must be between 1 byte and 10MB" },
        { status: 400 },
      );
    }

    // 1. Extract native PDF text first.
    const buffer = Buffer.from(
      await fileEntry.arrayBuffer(),
    );

    if (
      buffer.length < 5 ||
      buffer.toString("utf8", 0, 5) !== "%PDF-"
    ) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 },
      );
    }

    const {
      text: extractedText,
      numpages,
    } = await parsePdfDetails(buffer);

    let rawText = extractedText;
    let pageCount = numpages;
    let ocrUsed = false;

    // 2. Fall back to OCR when native extraction
    //    produces too little text.
    if (!extractedText || extractedText.trim().length < 100) {
      console.log(
        "[Extract Document] Native PDF text insufficient. Falling back to scanned-PDF OCR",
      );

      const ocrResult = await ocrScannedPdf(buffer);

      rawText = ocrResult.text;
      pageCount = ocrResult.pageCount;
      ocrUsed = true;

      console.log(
        "[Extract Document] OCR completed:",
        {
          filename: fileEntry.name,
          pageCount,
          rawTextLength: rawText.length,
        },
      );
    }

    if (!rawText || rawText.trim().length < 10) {
      console.warn(
        "[Extract Document Diagnostics - 422 Empty Text]:",
        {
          filename: fileEntry.name,
          mimeType: fileEntry.type,
          fileSize: fileEntry.size,
          pageCount,
          rawTextLength: rawText
            ? rawText.length
            : 0,
          ocrUsed,
        },
      );

      return NextResponse.json(
        {
          error:
            "Could not extract enough text from the PDF. Is it a scanned image?",
        },
        { status: 422 },
      );
    }

    // 3. Clean extracted/OCR text.
    const cleanedText = cleanPdfText(rawText);

    if (
      !cleanedText ||
      cleanedText.trim().length < 10
    ) {
      console.warn(
        "[Extract Document Diagnostics - 422 Cleaned Text Empty]:",
        {
          filename: fileEntry.name,
          mimeType: fileEntry.type,
          fileSize: fileEntry.size,
          pageCount,
          rawTextLength: rawText.length,
          cleanedTextLength: cleanedText
            ? cleanedText.length
            : 0,
          ocrUsed,
        },
      );

      return NextResponse.json(
        {
          error:
            "Could not derive usable text from the PDF after cleaning.",
        },
        { status: 422 },
      );
    }

    // 4. Extract structured document data.
    const {
      structured,
      meta,
    } = await extractStructuredDocument(
      cleanedText,
    );

    const legacyCandidate =
      buildLegacyExtractedCase(
        structured,
        cleanedText,
      );

    const result =
      ExtractedCaseSchema.safeParse(
        legacyCandidate,
      );

    if (!result.success) {
      console.warn(
        "[Extract Document Diagnostics - 422 Schema Validation Failed]:",
        {
          filename: fileEntry.name,
          mimeType: fileEntry.type,
          fileSize: fileEntry.size,
          pageCount,
          rawTextLength: rawText.length,
          validationError:
            result.error.format(),
        },
      );

      console.error(
        "[Extract Document] Zod Validation Failed:",
        result.error.format(),
      );

      return NextResponse.json(
        {
          error:
            "Document structure was not recognized correctly.",
          details:
            result.error.format(),
        },
        { status: 422 },
      );
    }

    const parsed = result.data;

    console.log(
      "[Extract Document] Pipeline Metrics:",
      {
        filename: fileEntry.name,
        pageCount,
        ocrUsed,
        rawTextLength: rawText.length,
        cleanedTextLength:
          cleanedText.length,
        documentType:
          structured.documentType,
        detectedDocumentType:
          meta.detectedDocumentType,
        chunkingTriggered:
          meta.chunkingTriggered,
        chunkCount:
          meta.chunkCount,
        aiCalls: meta.aiCalls,
        aiDurationMs:
          meta.aiDurationMs,
      },
    );

    return NextResponse.json({
      ...parsed,
      arrestDate: normalizeDate(
        parsed.arrestDate,
      ),
      documentType:
        structured.documentType,
      accused:
        structured.accused,
      complainant:
        structured.complainant,
      sectionsList:
        structured.sections,
      allegationsList:
        structured.allegations,
      evidence:
        structured.evidence,
      courtStage:
        structured.courtStage,
      custodyFacts:
        structured.custodyFacts,
      proceduralConcerns:
        structured.proceduralConcerns,
      timeline:
        structured.timeline,
      keyEntities:
        structured.keyEntities,
      extractionMeta: {
        pageCount,
        ocrUsed,
        rawTextLength:
          rawText.length,
        cleanedTextLength:
          cleanedText.length,
        ...meta,
      },
    });
  } catch (error) {
    console.error(
      "[Extract Document] Error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Document extraction failed";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}