import type { AnalyzeRequest } from "./analysis-types";

export type PersistedCaseAnalysisFacts = {
  title: string;
  offenseDescription: string;
  offenseType: string;
  accusedName: string;
  accusedProfile: string;
  section: string;
  cooperationLevel: string;
  jurisdiction: string;
  legalFramework: AnalyzeRequest["legalFramework"] | null;
  bailType: string | null;
  proceduralStage: string | null;
  custodyStatus: string | null;
  previousBail: string | null;
  priorRecord: boolean;
  timeServedDays: number | null;
};

/** Persisted cases are analyzed from the database snapshot, never request overrides. */
export function resolveAnalysisInput(
  request: AnalyzeRequest,
  persistedCase: PersistedCaseAnalysisFacts | null,
): AnalyzeRequest {
  if (!persistedCase) return request;

  return {
    ...request,
    caseTitle: persistedCase.title,
    whatHappened: persistedCase.offenseDescription,
    caseDescription: persistedCase.offenseDescription,
    when: persistedCase.timeServedDays !== null ? `${persistedCase.timeServedDays} days` : undefined,
    where: persistedCase.jurisdiction,
    incidentLocation: persistedCase.jurisdiction,
    people: persistedCase.accusedName,
    partiesInvolved: persistedCase.accusedName,
    sections: persistedCase.section,
    legalFramework: persistedCase.legalFramework ?? undefined,
    offenseType: persistedCase.offenseType,
    accusedName: persistedCase.accusedName,
    accusedProfile: persistedCase.accusedProfile,
    priorRecord: persistedCase.priorRecord,
    bailType: persistedCase.bailType ?? undefined,
    proceduralStage: persistedCase.proceduralStage ?? undefined,
    custodyDuration: persistedCase.custodyStatus ?? undefined,
    previousBail: persistedCase.previousBail ?? undefined,
    cooperationLevel: persistedCase.cooperationLevel,
  };
}
