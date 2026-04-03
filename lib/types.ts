import type { Analysis, Case, Document } from "@prisma/client";

export type CaseWithAnalysis = Case & { analysis: Analysis | null };
export type CaseWithAll = Case & { analysis: Analysis | null; documents: Document[] };