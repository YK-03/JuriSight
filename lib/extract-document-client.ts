const MAX_FILE_SIZE = 10 * 1024 * 1024;

export type ExtractDocumentResult =
  | { ok: true; text: string; fileName: string }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validatePdfFile(file: File): string | null {
  const isPdfMime = file.type === "application/pdf";
  const isPdfExt = file.name.toLowerCase().endsWith(".pdf");
  const isGenericOrEmptyMime = !file.type || file.type === "application/octet-stream";

  if (!isPdfMime && !(isPdfExt && isGenericOrEmptyMime)) {
    return "Only PDF files are supported.";
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return "File size must be 10MB or smaller.";
  }

  return null;
}

export function formatExtractedDocumentText(data: unknown): string {
  if (!isRecord(data)) {
    return "Document processed but no content could be extracted.";
  }

  const parts = [
    asString(data.title) && `Title: ${asString(data.title)}`,
    asString(data.accusedName) && `Accused: ${asString(data.accusedName)}`,
    asString(data.firNumber) && `FIR: ${asString(data.firNumber)}`,
    asString(data.sections) && `Sections: ${asString(data.sections)}`,
    asString(data.allegations) && `Allegations: ${asString(data.allegations)}`,
    asString(data.policeStation) && `Police Station: ${asString(data.policeStation)}`,
    asString(data.district) && `District: ${asString(data.district)}`,
    asString(data.state) && `State: ${asString(data.state)}`,
    asString(data.arrestDate) && `Arrest Date: ${asString(data.arrestDate)}`,
    asString(data.custodyDuration) && `Custody Duration: ${asString(data.custodyDuration)}`,
    data.previousConvictions != null && `Previous Convictions: ${data.previousConvictions ? "Yes" : "No"}`,
    asString(data.notes) && `Notes: ${asString(data.notes)}`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("\n") : "Document processed but no content could be extracted.";
}

export async function extractDocumentFromPdf(file: File): Promise<ExtractDocumentResult> {
  const validationError = validatePdfFile(file);
  if (validationError) {
    return { ok: false, error: validationError };
  }

  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/extract-document", {
      method: "POST",
      body: formData,
    });

    const data: unknown = await res.json().catch(() => null);

    if (!res.ok || !data) {
      return {
        ok: false,
        error:
          "Unable to extract text from this PDF. Try another PDF or continue without the document.",
      };
    }

    return {
      ok: true,
      text: formatExtractedDocumentText(data),
      fileName: file.name,
    };
  } catch {
    return {
      ok: false,
      error:
        "Unable to extract text from this PDF. Try another PDF or continue without the document.",
    };
  }
}
