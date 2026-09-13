import { z } from "zod";
import { generateAIResponse, extractJsonBlock } from "./groq";

export const DOCUMENT_TYPES = [
  "FIR",
  "Charge Sheet",
  "Bail Order",
  "Complaint",
  "Witness Statement",
  "Unknown",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

const CHUNK_TARGET_LENGTH = 42000;
const EXTRACTION_MODEL_LIMIT_HINT = 52000;
const NORMAL_DOCUMENT_LIMIT = EXTRACTION_MODEL_LIMIT_HINT;

export const StructuredExtractionSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  accused: z.array(z.string()),
  complainant: z.array(z.string()),
  sections: z.array(z.string()),
  allegations: z.array(z.string()),
  evidence: z.array(z.string()),
  courtStage: z.string(),
  custodyFacts: z.string(),
  proceduralConcerns: z.array(z.string()),
  timeline: z.array(z.string()),
  keyEntities: z.array(z.string()),
  firNumber: z.string().optional().default(""),
  policeStation: z.string().optional().default(""),
  district: z.string().optional().default(""),
  state: z.string().optional().default(""),
  arrestDate: z.string().optional().default(""),
  accusedAge: z.number().int().nullable().optional().default(null),
});

export type StructuredExtraction = z.infer<typeof StructuredExtractionSchema>;

export type ExtractionMeta = {
  rawTextLength: number;
  cleanedTextLength: number;
  detectedDocumentType: DocumentType;
  chunkingTriggered: boolean;
  chunkCount: number;
  aiCalls: number;
  aiDurationMs: number;
};

export type LegacyExtractedCase = {
  title: string;
  accusedName: string;
  accusedAge: number | null;
  firNumber: string;
  policeStation: string;
  district: string;
  state: string;
  sections: string;
  allegations: string;
  arrestDate: string;
  custodyDuration: string;
  previousConvictions: boolean;
  notes: string;
};

function sanitizeChunkCandidate(raw: any, fallbackType: DocumentType): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const asArray = (val: any) =>
    Array.isArray(val)
      ? val.map((v) => (typeof v === "string" ? v.trim() : String(v || ""))).filter(Boolean)
      : typeof val === "string" && val.trim()
      ? [val.trim()]
      : [];
  const asString = (val: any) => (typeof val === "string" ? val.trim() : typeof val === "number" ? String(val) : "");
  const asAge = (val: any): number | null => {
    if (typeof val === "number" && Number.isFinite(val) && val > 0 && val < 150) {
      return Math.round(val);
    }
    if (typeof val === "string") {
      const parsed = parseInt(val.trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 150) {
        return parsed;
      }
    }
    return null;
  };

  let docType: DocumentType = fallbackType;
  if (typeof raw.documentType === "string") {
    const matched = DOCUMENT_TYPES.find((t) => t.toLowerCase() === raw.documentType.trim().toLowerCase());
    if (matched) docType = matched;
  }

  return {
    documentType: docType,
    accused: asArray(raw.accused),
    complainant: asArray(raw.complainant),
    sections: asArray(raw.sections),
    allegations: asArray(raw.allegations),
    evidence: asArray(raw.evidence),
    courtStage: asString(raw.courtStage),
    custodyFacts: asString(raw.custodyFacts),
    proceduralConcerns: asArray(raw.proceduralConcerns),
    timeline: asArray(raw.timeline),
    keyEntities: asArray(raw.keyEntities),
    firNumber: asString(raw.firNumber),
    policeStation: asString(raw.policeStation),
    district: asString(raw.district),
    state: asString(raw.state),
    arrestDate: asString(raw.arrestDate),
    accusedAge: asAge(raw.accusedAge),
  };
}

function uniqStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function normalizeStructuredExtraction(candidate: StructuredExtraction): StructuredExtraction {
  return {
    documentType: candidate.documentType,
    accused: uniqStrings(candidate.accused),
    complainant: uniqStrings(candidate.complainant),
    sections: uniqStrings(candidate.sections),
    allegations: uniqStrings(candidate.allegations),
    evidence: uniqStrings(candidate.evidence),
    courtStage: candidate.courtStage.trim(),
    custodyFacts: candidate.custodyFacts.trim(),
    proceduralConcerns: uniqStrings(candidate.proceduralConcerns),
    timeline: uniqStrings(candidate.timeline),
    keyEntities: uniqStrings(candidate.keyEntities),
    firNumber: (candidate.firNumber ?? "").trim(),
    policeStation: (candidate.policeStation ?? "").trim(),
    district: (candidate.district ?? "").trim(),
    state: (candidate.state ?? "").trim(),
    arrestDate: (candidate.arrestDate ?? "").trim(),
    accusedAge: typeof candidate.accusedAge === "number" && Number.isFinite(candidate.accusedAge) ? candidate.accusedAge : null,
  };
}

export function detectDocumentType(text: string): DocumentType {
  const sample = text.slice(0, 12000).toLowerCase();
  const scores: Record<DocumentType, number> = {
    FIR: 0,
    "Charge Sheet": 0,
    "Bail Order": 0,
    Complaint: 0,
    "Witness Statement": 0,
    Unknown: 0,
  };

  const addScore = (type: DocumentType, pattern: RegExp, weight = 1) => {
    if (pattern.test(sample)) {
      scores[type] += weight;
    }
  };

  addScore("FIR", /\bfirst information report\b/, 4);
  addScore("FIR", /\bfir\s*(?:no\.?|number)?\b/, 3);
  addScore("FIR", /\bpolice station\b/, 2);
  addScore("FIR", /\bdate of occurrence\b/, 2);
  addScore("FIR", /\binformant\b|\bcomplainant\b/, 1);

  addScore("Charge Sheet", /\bcharge\s*sheet\b|\bchargesheet\b/, 4);
  addScore("Charge Sheet", /\bfinal report\b/, 2);
  addScore("Charge Sheet", /\bsection\s+173\b|\bu\/s\s*173\b/, 2);
  addScore("Charge Sheet", /\blist of witnesses\b|\bwitnesses examined\b/, 2);
  addScore("Charge Sheet", /\blist of documents\b/, 2);

  addScore("Bail Order", /\bbail application\b|\bbail petition\b/, 4);
  addScore("Bail Order", /\bapplicant\/accused\b|\bpetitioner\b/, 2);
  addScore("Bail Order", /\breleased on bail\b|\bgrant of bail\b/, 3);
  addScore("Bail Order", /\blearned counsel\b|\bheard\b/, 1);
  addScore("Bail Order", /\border\b/, 1);

  addScore("Complaint", /\bcomplaint case\b|\bprivate complaint\b/, 4);
  addScore("Complaint", /\bprayer\b/, 2);
  addScore("Complaint", /\bfiled under section\b/, 2);
  addScore("Complaint", /\bcomplainant\b/, 2);

  addScore("Witness Statement", /\bstatement of witness\b/, 4);
  addScore("Witness Statement", /\bsection\s+161\b|\bu\/s\s*161\b/, 3);
  addScore("Witness Statement", /\bsection\s+164\b|\bu\/s\s*164\b/, 3);
  addScore("Witness Statement", /\bdeponent\b|\bstatement recorded\b/, 2);

  let bestType: DocumentType = "Unknown";
  let bestScore = 0;

  for (const type of DOCUMENT_TYPES) {
    if (type === "Unknown") {
      continue;
    }

    if (scores[type] > bestScore) {
      bestType = type;
      bestScore = scores[type];
    }
  }

  return bestScore > 0 ? bestType : "Unknown";
}

function isHeadingParagraph(paragraph: string): boolean {
  const trimmed = paragraph.trim();
  if (!trimmed || trimmed.length > 160) {
    return false;
  }

  if (/^(section|u\/s|under section|annexure|facts of the case|brief facts|prayer|order|grounds|list of)\b/i.test(trimmed)) {
    return true;
  }

  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

function splitLongParagraph(paragraph: string, maxLength: number): string[] {
  if (paragraph.length <= maxLength) {
    return [paragraph];
  }

  const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= maxLength) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current.trim());
      current = sentence;
      continue;
    }

    chunks.push(sentence.trim());
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export function createSmartChunks(text: string, maxChunkLength = CHUNK_TARGET_LENGTH): string[] {
  const rawParagraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const paragraphs = rawParagraphs.flatMap((paragraph) => splitLongParagraph(paragraph, Math.floor(maxChunkLength * 0.8)));
  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const nextParagraph = paragraphs[index + 1] ?? "";
    const needsHeadingPair = isHeadingParagraph(paragraph) && nextParagraph;
    const headingBundle = needsHeadingPair ? `${paragraph}\n\n${nextParagraph}` : paragraph;
    const nextLength = currentLength === 0 ? headingBundle.length : currentLength + 2 + headingBundle.length;

    if (currentLength > 0 && nextLength > maxChunkLength) {
      chunks.push(current.join("\n\n").trim());
      current = [];
      currentLength = 0;
    }

    current.push(paragraph);
    currentLength = currentLength === 0 ? paragraph.length : currentLength + 2 + paragraph.length;

    if (needsHeadingPair) {
      index += 1;
      current.push(nextParagraph);
      currentLength += 2 + nextParagraph.length;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join("\n\n").trim());
  }

  return chunks.filter(Boolean);
}

function buildExtractionPrompt(text: string, detectedType: DocumentType, isChunk: boolean, chunkIndex?: number, totalChunks?: number): string {
  const chunkContext = isChunk && chunkIndex != null && totalChunks != null
    ? `This is chunk ${chunkIndex + 1} of ${totalChunks}. Extract only facts present in this chunk and do not invent cross-chunk context.\n`
    : "";

  return [
    "You are JuriSight's legal document extraction engine for Indian criminal-law workflows.",
    "Return ONLY valid JSON. No markdown. No prose.",
    "Be factual, concise, and non-hallucinatory.",
    "Use only facts explicitly present in the document text.",
    "If a field is missing or unclear, use an empty string for strings and [] for arrays.",
    "Keep arrays deduplicated and brief.",
    "Preserve legal structure and chronology where available.",
    `Likely document type from heuristics: ${detectedType}. Confirm or override only if the document clearly supports another type.`,
    chunkContext,
    "Use EXACTLY this schema:",
    "{",
    '  "documentType": "FIR" | "Charge Sheet" | "Bail Order" | "Complaint" | "Witness Statement" | "Unknown",',
    '  "accused": string[],',
    '  "complainant": string[],',
    '  "sections": string[],',
    '  "allegations": string[],',
    '  "evidence": string[],',
    '  "courtStage": string,',
    '  "custodyFacts": string,',
    '  "proceduralConcerns": string[],',
    '  "timeline": string[],',
    '  "keyEntities": string[],',
    '  "firNumber": string,',
    '  "policeStation": string,',
    '  "district": string,',
    '  "state": string,',
    '  "arrestDate": string,',
    '  "accusedAge": number | null',
    "}",
    "",
    "Document text:",
    text.slice(0, EXTRACTION_MODEL_LIMIT_HINT),
  ].join("\n");
}

async function extractChunk(text: string, detectedType: DocumentType, isChunk: boolean, chunkIndex?: number, totalChunks?: number): Promise<StructuredExtraction> {
  const response = await generateAIResponse(buildExtractionPrompt(text, detectedType, isChunk, chunkIndex, totalChunks));
  const parsed = extractJsonBlock(response);
  const sanitized = sanitizeChunkCandidate(parsed, detectedType);
  return normalizeStructuredExtraction(StructuredExtractionSchema.parse(sanitized));
}

function pickPreferredDocumentType(values: DocumentType[], fallback: DocumentType): DocumentType {
  const counts = new Map<DocumentType, number>();

  for (const value of values) {
    if (value === "Unknown") {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let bestType = fallback;
  let bestScore = 0;
  for (const [type, score] of counts.entries()) {
    if (score > bestScore) {
      bestType = type;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestType : fallback;
}

export function mergeStructuredExtractions(chunks: StructuredExtraction[], fallbackType: DocumentType): StructuredExtraction {
  if (chunks.length === 0) {
    return normalizeStructuredExtraction({
      documentType: fallbackType,
      accused: [],
      complainant: [],
      sections: [],
      allegations: [],
      evidence: [],
      courtStage: "",
      custodyFacts: "",
      proceduralConcerns: [],
      timeline: [],
      keyEntities: [],
      firNumber: "",
      policeStation: "",
      district: "",
      state: "",
      arrestDate: "",
      accusedAge: null,
    });
  }

  const longestString = (values: (string | undefined)[]): string =>
    values
      .map((value) => (value ?? "").trim())
      .sort((left, right) => right.length - left.length)[0] ?? "";

  const firstValidAge = (chunksList: StructuredExtraction[]): number | null => {
    for (const chunk of chunksList) {
      if (typeof chunk.accusedAge === "number" && Number.isFinite(chunk.accusedAge)) {
        return chunk.accusedAge;
      }
    }
    return null;
  };

  return normalizeStructuredExtraction({
    documentType: pickPreferredDocumentType(chunks.map((chunk) => chunk.documentType), fallbackType),
    accused: chunks.flatMap((chunk) => chunk.accused),
    complainant: chunks.flatMap((chunk) => chunk.complainant),
    sections: chunks.flatMap((chunk) => chunk.sections),
    allegations: chunks.flatMap((chunk) => chunk.allegations),
    evidence: chunks.flatMap((chunk) => chunk.evidence),
    courtStage: longestString(chunks.map((chunk) => chunk.courtStage)),
    custodyFacts: longestString(chunks.map((chunk) => chunk.custodyFacts)),
    proceduralConcerns: chunks.flatMap((chunk) => chunk.proceduralConcerns),
    timeline: chunks.flatMap((chunk) => chunk.timeline),
    keyEntities: chunks.flatMap((chunk) => chunk.keyEntities),
    firNumber: longestString(chunks.map((chunk) => chunk.firNumber)),
    policeStation: longestString(chunks.map((chunk) => chunk.policeStation)),
    district: longestString(chunks.map((chunk) => chunk.district)),
    state: longestString(chunks.map((chunk) => chunk.state)),
    arrestDate: longestString(chunks.map((chunk) => chunk.arrestDate)),
    accusedAge: firstValidAge(chunks),
  });
}

function extractRegex(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function inferTitle(structured: StructuredExtraction, firNumber: string): string {
  if (firNumber) {
    return `${structured.documentType || "Legal Document"} ${firNumber}`.trim();
  }

  const accused = structured.accused[0] ?? "";
  if (accused) {
    return `${structured.documentType || "Legal Document"} involving ${accused}`.trim();
  }

  return structured.documentType !== "Unknown" ? structured.documentType : "Legal Document";
}

export function buildLegacyExtractedCase(structured: StructuredExtraction, cleanedText: string): LegacyExtractedCase {
  const firNumberFallback = extractRegex(cleanedText, /\bFIR\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Za-z0-9./-]+)/i);
  const policeStationFallback = extractRegex(cleanedText, /\bPolice Station\s*[:\-]?\s*([^\n,]+)/i);
  const districtFallback = extractRegex(cleanedText, /\bDistrict\s*[:\-]?\s*([^\n,]+)/i);
  const stateFallback = extractRegex(cleanedText, /\bState\s*[:\-]?\s*([^\n,]+)/i);
  const arrestDateFallback = extractRegex(cleanedText, /\b(?:Date of Arrest|Arrest Date)\s*[:\-]?\s*([0-9./-]{6,20})/i);
  const accusedAgeTextFallback = extractRegex(cleanedText, /\bAge\s*[:\-]?\s*(\d{1,3})\b/i);
  const parsedAgeFallback = accusedAgeTextFallback ? Number(accusedAgeTextFallback) : null;
  const ageFallback = Number.isFinite(parsedAgeFallback) ? parsedAgeFallback : null;

  const firNumber = structured.firNumber?.trim() || firNumberFallback;
  const policeStationRaw = structured.policeStation?.trim() || policeStationFallback;
  const districtRaw = structured.district?.trim() || districtFallback;
  const stateRaw = structured.state?.trim() || stateFallback;
  const arrestDate = structured.arrestDate?.trim() || arrestDateFallback;
  const accusedAge = typeof structured.accusedAge === "number" && Number.isFinite(structured.accusedAge)
    ? structured.accusedAge
    : ageFallback;

  return {
    title: inferTitle(structured, firNumber),
    accusedName: structured.accused[0] ?? "",
    accusedAge,
    firNumber,
    policeStation: toTitleCase(policeStationRaw),
    district: toTitleCase(districtRaw),
    state: toTitleCase(stateRaw),
    sections: structured.sections.join(", "),
    allegations: structured.allegations.join(" "),
    arrestDate,
    custodyDuration: structured.custodyFacts,
    previousConvictions: /\bprevious convictions?\b|\bprior convictions?\b|\bhabitual offender\b/i.test(cleanedText),
    notes: uniqStrings([
      structured.courtStage,
      ...structured.proceduralConcerns,
      ...structured.evidence,
    ]).join(" | "),
  };
}

export async function extractStructuredDocument(text: string): Promise<{ structured: StructuredExtraction; meta: Omit<ExtractionMeta, "rawTextLength" | "cleanedTextLength">; }> {
  const detectedDocumentType = detectDocumentType(text);

  if (text.length <= NORMAL_DOCUMENT_LIMIT) {
    const startedAt = Date.now();
    const structured = await extractChunk(text, detectedDocumentType, false);
    return {
      structured,
      meta: {
        detectedDocumentType,
        chunkingTriggered: false,
        chunkCount: 1,
        aiCalls: 1,
        aiDurationMs: Date.now() - startedAt,
      },
    };
  }

  const chunks = createSmartChunks(text);
  const startedAt = Date.now();
  const extractedChunks: StructuredExtraction[] = [];
  let aiCalls = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    try {
      aiCalls += 1;
      const chunkExtraction = await extractChunk(chunks[index], detectedDocumentType, true, index, chunks.length);
      extractedChunks.push(chunkExtraction);
    } catch (chunkError) {
      console.warn(`[Document Parser] Chunk ${index + 1}/${chunks.length} extraction failed:`, chunkError instanceof Error ? chunkError.message : chunkError);
    }
  }

  if (extractedChunks.length === 0) {
    throw new Error(`Failed to extract structured data from any of the ${chunks.length} document chunks.`);
  }

  return {
    structured: mergeStructuredExtractions(extractedChunks, detectedDocumentType),
    meta: {
      detectedDocumentType,
      chunkingTriggered: true,
      chunkCount: chunks.length,
      aiCalls,
      aiDurationMs: Date.now() - startedAt,
    },
  };
}
