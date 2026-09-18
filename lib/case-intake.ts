export type CaseHistoryStatus =
  | "Intake"
  | "Analyzing"
  | "Action needed"
  | "In progress"
  | "Educated";

export type IntakeFormState = {
  caseTitle: string;
  sections: string;
  offenseType: string;
  accusedName: string;
  accusedProfile: string;
  priorRecord: boolean;
  bailType: string;
  proceduralStage: string;
  custodyStatus: string;
  previousBail: string;
  cooperationLevel: string;
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
  offenseType: "Non-bailable",
  accusedName: "",
  accusedProfile: "",
  priorRecord: false,
  bailType: "Anticipatory Bail (CrPC 438)",
  proceduralStage: "Investigation pending",
  custodyStatus: "Not arrested / Pre-arrest",
  previousBail: "No prior bail application",
  cooperationLevel: "Cooperated in investigation",
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
    `Prior criminal record: ${values.priorRecord ? "Yes (Has previous record / convictions)" : "No (First-time offender)"}`,
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
  const normalizedOffenseType = values.offenseType.trim() || "Non-bailable";
  const normalizedProfile =
    values.accusedProfile.trim() ||
    (values.priorRecord
      ? "Accused with prior criminal record"
      : "First-time offender with community ties");
  const normalizedCooperation =
    values.cooperationLevel.trim() || "Cooperated in investigation";
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
    legalFramework: values.bailType.trim() || undefined,
    specialAct: undefined,
  };
}
