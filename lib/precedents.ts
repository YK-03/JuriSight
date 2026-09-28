import { z } from "zod";

export type Precedent = {
  case: string;
  principle: string;
  searchLink?: string;
  appliedTo?: string;
  relevance?: string;
  id?: string;
  year?: number;
  category?: string[];
  tags?: string[];
  bailPosture?: string;
  proceduralStage?: string[];
  provenance?: "curated" | "ai_suggested";
};

export const PrecedentSchema = z.object({
  case: z.string().trim().min(1, "Missing case"),
  principle: z.string().trim().min(1, "Missing principle"),
  searchLink: z.string().trim().optional(),
  appliedTo: z.string().trim().optional(),
  relevance: z.string().trim().optional(),
  id: z.string().trim().optional(),
  year: z.number().int().optional(),
  category: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  bailPosture: z.string().trim().optional(),
  proceduralStage: z.array(z.string()).optional(),
  provenance: z.enum(["curated", "ai_suggested"]).optional(),
});

export const PrecedentsSchema = z.array(PrecedentSchema);

export function buildSearchLink(caseName: string) {
  return `https://indiankanoon.org/search/?formInput=${encodeURIComponent(caseName)}`;
}

function coerceCaseName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coercePrinciple(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceAppliedTo(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function withAppliedTo(entry: Precedent, appliedTo: string): Precedent {
  if (!appliedTo) {
    return entry;
  }
  return { ...entry, appliedTo };
}

export function normalizePrecedentEntry(input: unknown): Precedent | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const caseName = coerceCaseName(record.case ?? record.caseName ?? record.title);
  const principle = coercePrinciple(record.principle ?? record.reason ?? record.summary ?? record.relevance);

  if (!caseName || !principle) {
    return null;
  }

  const searchLink = coerceCaseName(record.searchLink);
  const appliedTo = coerceAppliedTo(record.appliedTo);
  const relevance = coercePrinciple(record.relevance);
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const year = typeof record.year === "number" && Number.isInteger(record.year) ? record.year : undefined;
  const category = Array.isArray(record.category) ? record.category.filter((item): item is string => typeof item === "string") : undefined;
  const tags = Array.isArray(record.tags) ? record.tags.filter((item): item is string => typeof item === "string") : undefined;
  const bailPosture = typeof record.bailPosture === "string" ? record.bailPosture.trim() : "";
  const proceduralStage = Array.isArray(record.proceduralStage)
    ? record.proceduralStage.filter((item): item is string => typeof item === "string")
    : undefined;
  const provenance = record.provenance === "curated" || record.provenance === "ai_suggested"
    ? record.provenance
    : undefined;

  return withAppliedTo(
    {
      case: caseName,
      principle,
      ...(searchLink.includes("indiankanoon") ? { searchLink } : {}),
      ...(relevance ? { relevance } : {}),
      ...(provenance ? { provenance } : {}),
      ...(id ? { id } : {}),
      ...(year !== undefined ? { year } : {}),
      ...(category ? { category } : {}),
      ...(tags ? { tags } : {}),
      ...(bailPosture ? { bailPosture } : {}),
      ...(proceduralStage ? { proceduralStage } : {}),
    },
    appliedTo,
  );
}

export function normalizePrecedents(input: unknown): Precedent[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map(normalizePrecedentEntry)
    .filter((entry): entry is Precedent => Boolean(entry))
    .map((p) =>
      withAppliedTo(
        {
          case: p.case,
          principle: p.principle,
          ...(p.searchLink ? { searchLink: p.searchLink } : {}),
          ...(p.relevance ? { relevance: p.relevance } : {}),
          ...(p.provenance ? { provenance: p.provenance } : {}),
          ...(p.id ? { id: p.id } : {}),
          ...(p.year !== undefined ? { year: p.year } : {}),
          ...(p.category ? { category: p.category } : {}),
          ...(p.tags ? { tags: p.tags } : {}),
          ...(p.bailPosture ? { bailPosture: p.bailPosture } : {}),
          ...(p.proceduralStage ? { proceduralStage: p.proceduralStage } : {}),
        },
        p.appliedTo ?? "",
      ),
    );
}

export function buildFallbackPrecedents(input: unknown): Precedent[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const caseName = coerceCaseName(record.case ?? record.caseName ?? record.title);
      const principle = coercePrinciple(record.principle ?? record.reason ?? record.summary ?? record.relevance);

      if (!caseName) {
        return null;
      }

      return withAppliedTo(
        {
          case: caseName,
          principle: principle || "Verify the ratio directly from the linked Indian Kanoon search result.",
          searchLink: buildSearchLink(caseName),
        },
        coerceAppliedTo(record.appliedTo),
      );
    })
    .filter((entry): entry is Precedent => Boolean(entry));
}
