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
  statutorySections: string[];
  offenseCategory: "heinous violent offence" | "economic offence" | "special statutory offence" | "minor bailable offence" | "bailable offence" | "general offence";
  specialStatutoryIssues: string[];
  signals: Set<string>;
  text: string;
};

export type RetrievedPrecedent = CuratedPrecedent & {
  score: number;
  scoreReasons: string[];
};

const compact = (value: unknown) => String(value ?? "").toLowerCase().trim();

function includesAny(text: string, values: readonly string[]) {
  return values.some((value) => text.includes(value));
}

function extractStatutorySections(value: string): string[] {
  const sections: string[] = [];
  const pattern = /\b(IPC|BNS|NDPS|PMLA|UAPA|CRPC|BNSS)\s*([0-9]+(?:\([^)]+\))?)/gi;
  for (const match of value.matchAll(pattern)) {
    sections.push(`${match[1].toUpperCase()}:${match[2]}`);
  }
  return [...new Set(sections)];
}

function hasExplicitDefaultBailUnavailable(text: string) {
  return /\b(?:default|statutory)\s+bail\s+(?:not available|unavailable|not satisfied|cannot be resolved)\b/i.test(text);
}

function hasPositiveDefaultBailSignal(text: string) {
  return !hasExplicitDefaultBailUnavailable(text) && (
    /\b(?:default|statutory)\s+bail\b/i.test(text)
    || /\b167\s*\(\s*2\s*\)/i.test(text)
  );
}

function offenseCategory(
  offenseType: string,
  statutorySections: readonly string[],
  text: string,
): PrecedentQuery["offenseCategory"] {
  if (statutorySections.some((section) => section.startsWith("NDPS:"))) return "special statutory offence";
  if (statutorySections.includes("IPC:302") || /\bmurder\b|\bheinous\b|\bviolent offence\b/i.test(text)) {
    return "heinous violent offence";
  }
  if (statutorySections.includes("IPC:420") || /\bcheating\b|\beconomic offence\b|\bfinancial offence\b/i.test(text)) {
    return "economic offence";
  }
  if (statutorySections.includes("IPC:323") || (offenseType === "bailable" && /\bminor\b|\bpetty\b|\bfirst[- ]time offender\b/i.test(text))) {
    return "minor bailable offence";
  }
  if (offenseType === "bailable") return "bailable offence";
  return "general offence";
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

  const statutorySections = extractStatutorySections(compact(caseData.section));
  const normalizedOffenseType = compact(caseData.offenseType);
  const defaultBailAvailable = hasPositiveDefaultBailSignal(text);

  const bailPosture = includesAny(compact(caseData.bailType), ["anticipatory", "pre-arrest", "apprehension of arrest"])
    || /\banticipatory\b|\bpre-arrest\b|\bapprehension of arrest\b/i.test(text)
    ? "anticipatory bail"
    : defaultBailAvailable
    ? "default/statutory bail"
    : "regular bail";

  const investigationStage = /\bpre[- ]?chargesheet\b|\bno[- ]?chargesheet\b|\bchargesheet\s+(?:not|has not|not yet)\s+filed\b|\bcharge[- ]?sheet\s+(?:not|has not|not yet)\s+filed\b|\binvestigation\s+(?:ongoing|pending)\b/i.test(text);
  const proceduralStage = /\bpre-arrest\b|\banticipatory\b|\bapprehension\b/i.test(text)
    ? "pre-arrest"
    : /\btrial\b|\bhearing\b/i.test(text) || (!investigationStage && /\bchargesheet\s+(?:filed|submitted|presented)\b|\bcharge[- ]?sheet\s+(?:filed|submitted|presented)\b/i.test(text))
    ? "trial"
    : "investigation";

  const category = offenseCategory(normalizedOffenseType, statutorySections, text);
  const specialStatutoryIssues = [
    statutorySections.some((section) => section.startsWith("NDPS:"))
      && (/section 37|commercial quantity|twin conditions/i.test(text))
      ? "NDPS Section 37"
      : "",
    statutorySections.some((section) => section.startsWith("PMLA:")) && /section 45|twin conditions/i.test(text)
      ? "PMLA Section 45"
      : "",
  ].filter(Boolean);

  const signals = new Set<string>();
  const add = (signal: string, condition: boolean) => {
    if (condition) signals.add(signal);
  };

  add("economic offence", category === "economic offence");
  add("prolonged custody", includesAny(text, ["prolonged custody", "long custody", "months in custody", "years in custody", "undertrial"]));
  add("speedy trial", includesAny(text, ["delay", "delayed trial", "speedy trial", "trial will take", "pending trial"]));
  add("first-time offender", caseData.priorRecord === false || /\bfirst[- ]time offender\b|\bno criminal record\b|\bclean antecedents?\b/i.test(text));
  add("cooperation", includesAny(text, ["cooperat", "joined investigation", "available for investigation"]));
  add("arrest concerns", includesAny(text, ["arrest", "detention", "custody", "remand"]));
  add("seriousness of offence", category === "heinous violent offence" || /\bserious\b|\bgrave\b|\bsevere\b|\bheinous\b/i.test(text));
  add("criminal intent", includesAny(text, ["civil dispute", "commercial dispute", "criminal intent"]));
  add("default/statutory bail", defaultBailAvailable);
  add("default bail not available", hasExplicitDefaultBailUnavailable(text));
  add("murder/heinous offence", category === "heinous violent offence");
  add("special statutory offence", category === "special statutory offence");
  add("minor bailable offence", category === "minor bailable offence");
  for (const issue of specialStatutoryIssues) signals.add(issue);

  return { bailPosture, proceduralStage, statutorySections, offenseCategory: category, specialStatutoryIssues, signals, text };
}

function scorePrecedent(precedent: CuratedPrecedent, query: PrecedentQuery): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const precedentTerms = new Set([...precedent.category, ...precedent.tags].map(compact));
  const precedentPosture = compact(precedent.bailPosture);
  const bailMatch = query.bailPosture === "regular bail"
    ? precedentPosture.includes("regular bail")
    : precedentPosture.includes(query.bailPosture);
  const stageMatch = precedent.proceduralStage?.some((stage) => compact(stage) === query.proceduralStage) ?? false;
  let score = 0;

  if (bailMatch) {
    score += 6;
    reasons.push(`bail posture: ${query.bailPosture}`);
  }
  if (stageMatch) {
    score += 3;
    reasons.push(`procedural stage: ${query.proceduralStage}`);
  }

  const hasTerm = (term: string) => precedentTerms.has(term);
  const statutoryContext = query.statutorySections.join(", ");
  if (query.offenseCategory === "economic offence" && (hasTerm("economic offences") || hasTerm("economic offence"))) {
    score += 12;
    reasons.push(`statutory context: ${statutoryContext}; economic-offence relevance`);
  }
  if (query.offenseCategory === "heinous violent offence" && (
    hasTerm("heinous offences")
    || hasTerm("violent offences")
    || hasTerm("murder bail")
    || hasTerm("serious offences")
  )) {
    score += 10;
    reasons.push(`statutory context: ${statutoryContext}; heinous-offence relevance`);
  }
  if (query.offenseCategory === "minor bailable offence" && hasTerm("first-time offenders")) {
    score += 12;
    reasons.push(`statutory context: ${statutoryContext}; minor/bailable-offence relevance`);
  }
  if (query.offenseCategory === "bailable offence" && hasTerm("general bail")) {
    score += 5;
    reasons.push(`statutory context: ${statutoryContext}; bailable-offence relevance`);
  }
  if (query.specialStatutoryIssues.some((issue) => issue === "NDPS Section 37") && hasTerm("ndps section 37")) {
    score += 14;
    reasons.push("NDPS Section 37 relevance");
  }
  if (query.specialStatutoryIssues.some((issue) => issue === "PMLA Section 45") && hasTerm("pmla section 45")) {
    score += 14;
    reasons.push("PMLA Section 45 relevance");
  }
  if (query.bailPosture === "default/statutory bail" && (
    hasTerm("default bail")
    || hasTerm("statutory bail")
    || hasTerm("section 167(2)")
  )) {
    score += 14;
    reasons.push("default/statutory bail relevance");
  }

  const specificSignals = new Set([
    "economic offence",
    "murder/heinous offence",
    "special statutory offence",
    "minor bailable offence",
    "default/statutory bail",
    "NDPS Section 37",
    "PMLA Section 45",
  ]);
  const matchingSignals = [...query.signals].filter((signal) => hasTerm(signal));
  for (const signal of matchingSignals) {
    const weight = specificSignals.has(signal) ? 4 : 1;
    score += weight;
    reasons.push(`signal: ${signal}`);
  }

  if (query.bailPosture !== "default/statutory bail" && hasTerm("general bail")) {
    score += 1;
    reasons.push("general bail context");
  }

  return { score, reasons };
}

export function retrievePrecedents(
  caseData: PrecedentCaseData,
  analysisContext: string = "",
): RetrievedPrecedent[] {
  const query = buildPrecedentQuery(caseData, analysisContext);
  return PRECEDENT_DATASET
    .map((precedent) => ({ precedent, ...scorePrecedent(precedent, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.precedent.id.localeCompare(b.precedent.id))
    .slice(0, 4)
    .map(({ precedent, score, reasons }) => ({ ...precedent, score, scoreReasons: reasons }));
}
