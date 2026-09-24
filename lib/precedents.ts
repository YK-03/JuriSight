import { z } from "zod";

export type Precedent = {
  case: string;
  principle: string;
  searchLink: string;
  appliedTo?: string;
};

export const PrecedentSchema = z.object({
  case: z.string().trim().min(1, "Missing case"),
  principle: z.string().trim().min(1, "Missing principle"),
  searchLink: z.string().trim().optional().default(""),
  appliedTo: z.string().trim().optional(),
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

  return withAppliedTo(
    {
      case: caseName,
      principle,
      searchLink: searchLink.includes("indiankanoon") ? searchLink : buildSearchLink(caseName),
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
          searchLink: p.searchLink && p.searchLink.includes("indiankanoon")
            ? p.searchLink
            : buildSearchLink(p.case),
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
