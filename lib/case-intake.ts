export type CaseHistoryStatus =
  | "Intake"
  | "Analyzing"
  | "Action needed"
  | "In progress"
  | "Educated";

import type { LegalFramework } from "./legal-framework";
import type { BailCourtLevel } from "./section-preservation";

export type IntakeFormState = {
  caseTitle: string;
  sections: string;
  offenseType: string;
  accusedName: string;
  accusedProfile: string;
  priorRecord: boolean | null;
  bailType: string;
  proceduralStage: string;
  custodyStatus: string;
  previousBail: string;
  cooperationLevel: string;
  legalFramework?: LegalFramework;
  bailCourtLevel?: BailCourtLevel | "";
  whatHappened: string;
  incidentDate: string;
  incidentLocation: string;
  partiesInvolved: string;
  evidenceDetails: string;
  legalQuestions: string;
};

export const INITIAL_FORM_STATE: IntakeFormState = {
  caseTitle: "",
  sections: "",
  offenseType: "",
  accusedName: "",
  accusedProfile: "",
  priorRecord: null,
  bailType: "",
  proceduralStage: "Investigation pending",
  custodyStatus: "",
  previousBail: "",
  cooperationLevel: "",
  bailCourtLevel: "",
  whatHappened: "",
  incidentDate: "",
  incidentLocation: "",
  partiesInvolved: "",
  evidenceDetails: "",
  legalQuestions: "",
};

export function buildCaseDescription(values: IntakeFormState): string {
  const sections = [
    values.caseTitle.trim() ? `Case title: ${values.caseTitle.trim()}` : "",
    values.accusedName.trim() ? `Accused name: ${values.accusedName.trim()}` : "",
    values.sections.trim() ? `Statutory sections / offences: ${values.sections.trim()}` : "",
    values.offenseType.trim() ? `Offense type: ${values.offenseType.trim()}` : "",
    values.bailType.trim() ? `Bail framework: ${values.bailType.trim()}` : "",
    values.priorRecord === null
      ? ""
      : `Prior criminal record: ${values.priorRecord ? "Yes (Has previous record / convictions)" : "No (First-time offender)"}`,
    values.custodyStatus.trim() ? `Custody status: ${values.custodyStatus.trim()}` : "",
    values.previousBail.trim() ? `Prior bail applications: ${values.previousBail.trim()}` : "",
    values.cooperationLevel.trim() ? `Cooperation with investigation: ${values.cooperationLevel.trim()}` : "",
    `What happened: ${values.whatHappened.trim()}`,
    values.incidentDate.trim() ? `When it happened: ${values.incidentDate.trim()}` : "",
    values.incidentLocation.trim() ? `Where it happened: ${values.incidentLocation.trim()}` : "",
    values.partiesInvolved.trim() ? `People involved: ${values.partiesInvolved.trim()}` : "",
    values.proceduralStage.trim() ? `Current procedural stage: ${values.proceduralStage.trim()}` : "",
    values.evidenceDetails.trim() ? `Evidence or documents: ${values.evidenceDetails.trim()}` : "",
    values.legalQuestions.trim() ? `Primary questions or concerns: ${values.legalQuestions.trim()}` : "",
  ];

  return sections.filter(Boolean).join("\n\n");
}

export function buildCasePayload(values: IntakeFormState) {
  const normalizedTitle =
    values.caseTitle.trim() ||
    (values.accusedName.trim()
      ? `Matter involving ${values.accusedName.trim()}`
      : values.whatHappened.trim().slice(0, 60) || "Untitled case");

  const normalizedAccused = values.accusedName.trim() || "Not specified";
  const normalizedSection = values.sections.trim() || "Not specified / Under investigation";
  const normalizedOffenseType = values.offenseType.trim();
  const normalizedProfile = values.accusedProfile.trim() || "Not specified";
  const normalizedCooperation =
    values.cooperationLevel.trim() || "Not specified";
  const normalizedJurisdiction =
    values.incidentLocation.trim() || "Jurisdiction not specified";

  return {
    title: normalizedTitle,
    accusedName: normalizedAccused,
    section: normalizedSection,
    offenseType: normalizedOffenseType,
    accusedProfile: normalizedProfile,
    priorRecord: values.priorRecord,
    offenseDescription: values.whatHappened.trim(),
    cooperationLevel: normalizedCooperation,
    jurisdiction: normalizedJurisdiction,
    bailType: values.bailType.trim() || undefined,
    proceduralStage: values.proceduralStage.trim() || undefined,
    custodyStatus: values.custodyStatus.trim() || undefined,
    previousBail: values.previousBail.trim() || undefined,
    legalFramework: values.legalFramework,
    bailCourtLevel: values.bailType.startsWith("Regular Bail") ? values.bailCourtLevel || undefined : undefined,
    specialAct: undefined,
  };
}

/**
 * Maps an intake custody string to days served for CrPC 167(2).
 * Returns null when duration is unspecified so callers do not assume a count.
 */
export function parseCustodyDaysForRules(custodyDuration: string): number | null {
  const val = custodyDuration.toLowerCase().trim();
  if (!val || /^not specified/.test(val) || val === "unknown") {
    return null;
  }
  if (val.includes("not arrested") || val.includes("pre-arrest")) {
    return 0;
  }
  if (val.includes("under") || val.includes("30")) return 25;
  if (val.includes("1 to 6") || val.includes("1-6")) return 90;
  if (val.includes("6 to 12") || val.includes("6-12")) return 180;
  if (val.includes("1 to 2") || val.includes("1-2")) return 365;
  if (val.includes("over 2") || val.includes("2+")) return 730;
  const dayMatch = val.match(/(\d+)\s*day/);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  const monthMatch = val.match(/(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30;
  return null;
}
