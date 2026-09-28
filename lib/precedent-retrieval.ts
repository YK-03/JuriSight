import { PRECEDENT_DATASET, type CuratedPrecedent } from "./precedent-dataset";

export type PrecedentCaseData = {
  bailType?: string | null;
  offenseType?: string | null;
  section?: string | null;
  accusedProfile?: string | null;
  priorRecord?: boolean | null;
  cooperationLevel?: string | null;
  custodyDuration?: string | null;
  custodyStatus?: string | null;
  proceduralStage?: string | null;
  previousBail?: string | null;
  offenseDescription?: string | null;
  caseDescription?: string | null;
};

export type PrecedentQuery = {
  bailPosture: string;
  proceduralStage: string;
  signals: Set<string>;
  text: string;
};

export type RetrievedPrecedent = CuratedPrecedent & {
  score: number;
};

const compact = (value: unknown) => String(value ?? "").toLowerCase().trim();

function includesAny(text: string, values: readonly string[]) {
  return values.some((value) => text.includes(value));
}

export function buildPrecedentQuery(
  caseData: PrecedentCaseData,
  analysisContext: string = "",
): PrecedentQuery {
  const text = [
    caseData.bailType,
    caseData.offenseType,
    caseData.section,
    caseData.accusedProfile,
    caseData.cooperationLevel,
    caseData.custodyDuration,
    caseData.custodyStatus,
    caseData.proceduralStage,
    caseData.previousBail,
    caseData.offenseDescription,
    caseData.caseDescription,
    analysisContext,
  ]
    .map(compact)
    .filter(Boolean)
    .join(" ");

  const bailPosture = includesAny(text, ["anticipatory", "pre-arrest", "apprehension of arrest"])
    ? "anticipatory bail"
    : includesAny(text, ["default bail", "statutory bail", "167(2)", "90 days", "60 days"])
    ? "default/statutory bail"
    : "regular bail";

  const proceduralStage = includesAny(text, ["pre-arrest", "anticipatory", "apprehension"])
    ? "pre-arrest"
    : includesAny(text, ["trial", "hearing", "chargesheet", "charge sheet", "charge-sheet"])
    ? "trial"
    : "investigation";

  const signals = new Set<string>();
  const add = (signal: string, condition: boolean) => {
    if (condition) signals.add(signal);
  };

  add("economic offence", includesAny(text, ["economic", "financial", "fraud", "money laundering", "cheating", "corruption", "embezzlement"]));
  add("prolonged custody", includesAny(text, ["prolonged custody", "long custody", "months in custody", "years in custody", "undertrial"]));
  add("speedy trial", includesAny(text, ["delay", "delayed trial", "speedy trial", "trial will take", "pending trial"]));
  add("first-time offender", caseData.priorRecord === false || includesAny(text, ["first-time", "first time", "no prior", "no criminal record"]));
  add("cooperation", includesAny(text, ["cooperat", "joined investigation", "available for investigation"]));
  add("arrest concerns", includesAny(text, ["arrest", "detention", "custody", "remand"]));
  add("seriousness of offence", includesAny(text, ["serious", "grave", "severe", "heinous", "non-bailable"]));
  add("criminal intent", includesAny(text, ["civil dispute", "commercial dispute", "criminal intent"]));
  add("default/statutory bail", bailPosture === "default/statutory bail");

  return { bailPosture, proceduralStage, signals, text };
}

function scorePrecedent(precedent: CuratedPrecedent, query: PrecedentQuery): number {
  const bailMatch = precedent.bailPosture?.includes(query.bailPosture) ||
    (query.bailPosture === "regular bail" && precedent.bailPosture === "regular bail");
  const stageMatch = precedent.proceduralStage?.includes(query.proceduralStage) ?? false;
  const precedentTerms = new Set([...precedent.category, ...precedent.tags].map(compact));
  const strongTagMatches = [...query.signals].filter((signal) => precedentTerms.has(signal)).length;
  const categoryMatch = precedent.category.some((category) => query.text.includes(compact(category)));
  const generalBailMatch = precedent.category.includes("general bail") && query.bailPosture !== "default/statutory bail";

  return (bailMatch ? 5 : 0) + (stageMatch ? 3 : 0) + strongTagMatches * 3 + (categoryMatch ? 2 : 0) + (generalBailMatch ? 1 : 0);
}

export function retrievePrecedents(
  caseData: PrecedentCaseData,
  analysisContext: string = "",
): RetrievedPrecedent[] {
  const query = buildPrecedentQuery(caseData, analysisContext);
  return PRECEDENT_DATASET
    .map((precedent, index) => ({ precedent, score: scorePrecedent(precedent, query), index }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4)
    .map(({ precedent, score }) => ({ ...precedent, score }));
}

