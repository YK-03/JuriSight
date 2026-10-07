import {
  buildPrecedentQuery,
  retrievePrecedents,
  type PrecedentCaseData,
} from "./precedent-retrieval";
import { buildSearchLink } from "./precedents";
import type { AuthorityRetriever, AuthorityRetrievalQuery, RetrievedAuthority } from "./authority-retrieval";

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function matchedIssues(query: AuthorityRetrievalQuery, precedent: {
  category: string[];
  tags: string[];
  bailPosture?: string;
  proceduralStage?: string[];
}): string[] {
  const recordText = compact([
    ...precedent.category,
    ...precedent.tags,
    precedent.bailPosture,
    ...(precedent.proceduralStage || []),
  ].filter(Boolean).join(" "));

  return query.issues.filter((issue) => {
    const normalized = compact(issue.replace(/^(custody|court level):?\s*/i, ""));
    return normalized.length > 0 && recordText.includes(normalized);
  });
}

/** Provisional adapter: exposes only metadata actually present in the curated dataset. */
export class CuratedAuthorityRetriever implements AuthorityRetriever {
  async retrieve(query: AuthorityRetrievalQuery): Promise<RetrievedAuthority[]> {
    const caseData: PrecedentCaseData = {
      offenseType: query.offenseType,
      section: query.sections.join(", "),
      bailType: query.bailType,
      custodyDuration: query.custodyDuration,
      proceduralStage: query.proceduralStage,
      previousBail: query.previousBail,
      cooperationLevel: query.accusedTags?.join(", "),
    };

    const querySignals = buildPrecedentQuery(caseData, query.queryText);
    return retrievePrecedents(caseData, query.queryText).map((precedent) => {
      const issues = matchedIssues(query, precedent);
      return {
        authorityId: precedent.id,
        caseName: precedent.caseName,
        derived: {
          legalPrinciple: precedent.principle,
          matchedIssues: issues.length > 0 ? issues : [...querySignals.signals],
        },
        judgmentUrl: precedent.sourceUrl || buildSearchLink(precedent.caseName),
        provenance: "curated" as const,
      };
    });
  }
}

export const curatedAuthorityRetriever = new CuratedAuthorityRetriever();
