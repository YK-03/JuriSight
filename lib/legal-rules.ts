import { defaultBailProvisionForFramework, type LegalFramework } from "./legal-framework";

export type Severity = "minor" | "moderate" | "serious" | "severe";
export type QuantityCategory = "small" | "commercial" | "unknown";
export type JuvenileRoute = "JJB" | "SessionsCourt" | "Magistrate";
export type LegalStatute = "IPC" | "BNS" | "CRPC" | "BNSS" | "NDPS" | "PMLA" | "UNKNOWN";

export type LegalRuleIdentity = {
  statute: LegalStatute;
  section: string;
  subsection?: string;
};

export interface DefaultBailResult {
  eligible: boolean | null;
  daysRequired: number;
  daysServed: number | null;
  daysRemaining: number | null;
  note: string;
}

export interface OffenseClassification {
  bailable: boolean;
  supported: boolean;
  severity: Severity;
  primarySection: string;
  hasNDPS: boolean;
  hasPMLA: boolean;
}

export interface NDPSBarResult {
  barApplies: boolean;
  twinConditionsRequired: boolean;
  quantityCategory: QuantityCategory;
  note: string;
}

export interface PMLAResult {
  applies: boolean;
  twinConditionsRequired: boolean;
  scheduledOffenseAmount?: number;
  note: string;
}

export interface JuvenileResult {
  isJuvenile: boolean;
  routeTo: JuvenileRoute;
  note: string;
}

export interface LegalRuleInput {
  sections: Array<string | LegalRuleIdentity>;
  custodyDays: number | null;
  chargesheetFiled: boolean;
  age: number;
  framework?: LegalFramework;
  ndpsQuantity?: QuantityCategory;
  pmlaAmount?: number;
}

export interface LegalRuleOutput {
  framework: LegalFramework;
  defaultBailProvision: string | null;
  defaultBail: DefaultBailResult;
  offenseClass: OffenseClassification;
  ndpsBar: NDPSBarResult | null;
  pmlaConditions: PMLAResult | null;
  juvenile: JuvenileResult;
  promptInjection: string;
}

interface SectionRule {
  bailable: boolean;
  severity: Severity;
}

const SERIOUS_DEFAULT_BAIL_RULES = [
  "IPC:302", "IPC:307", "IPC:376", "IPC:376A", "IPC:376D", "IPC:396", "IPC:364A", "IPC:121", "IPC:132",
  "NDPS:21", "NDPS:22",
] as const;
const CURRENT_BNS_SERIOUS_DEFAULT_BAIL_RULES = ["BNS:103", "BNS:109", "BNS:64"] as const;
const NDPS_TRIGGER_SECTIONS = ["8", "21", "22", "23", "27A"] as const;
const PMLA_TRIGGER_SECTIONS = ["3", "4"] as const;

const SECTION_RULES: Record<string, SectionRule> = {
  "IPC:302": { bailable: false, severity: "severe" },
  "IPC:307": { bailable: false, severity: "serious" },
  "IPC:376": { bailable: false, severity: "severe" },
  "IPC:420": { bailable: false, severity: "moderate" },
  "IPC:406": { bailable: false, severity: "moderate" },
  "IPC:498A": { bailable: false, severity: "moderate" },
  "IPC:379": { bailable: true, severity: "minor" },
  "IPC:323": { bailable: true, severity: "minor" },
  "IPC:324": { bailable: true, severity: "minor" },
  "IPC:504": { bailable: true, severity: "minor" },
  "IPC:506": { bailable: true, severity: "minor" },
  "BNS:103": { bailable: false, severity: "severe" },
  "BNS:109": { bailable: false, severity: "serious" },
  "BNS:64": { bailable: false, severity: "severe" },
  "BNS:318:4": { bailable: false, severity: "moderate" },
  "BNS:316:2": { bailable: false, severity: "moderate" },
  "BNS:85": { bailable: false, severity: "moderate" },
  "NDPS:8": { bailable: false, severity: "serious" },
  "NDPS:21": { bailable: false, severity: "serious" },
  "NDPS:22": { bailable: false, severity: "serious" },
  "PMLA:3": { bailable: false, severity: "serious" },
  "PMLA:4": { bailable: false, severity: "serious" },
};

const SEVERITY_ORDER: Record<Severity, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  severe: 4,
};

function normalizeSection(section: string): string {
  return section.trim().toUpperCase();
}

function parseRuleIdentity(value: string | LegalRuleIdentity, framework: LegalFramework = "LEGACY_IPC_CRPC"): LegalRuleIdentity {
  if (typeof value !== "string") {
    return { statute: value.statute, section: normalizeSection(value.section), subsection: value.subsection?.trim() };
  }

  const normalized = normalizeSection(value);
  const match = normalized.match(/^(IPC|BNS|CRPC|BNSS|NDPS|PMLA)\s+(?:SECTION[S]?\s+)?([0-9]+[A-Z]*)(?:\s*\(([^)]+)\))?$/i);
  if (match) {
    const statute = match[1].toUpperCase() as LegalStatute;
    return { statute, section: match[2].toUpperCase(), subsection: match[3]?.trim() };
  }

  const codeMatch = normalized.match(/([0-9]+[A-Z]*)/);
  return {
    statute: framework === "LEGACY_IPC_CRPC" || framework === "MIXED_LEGACY" ? "IPC" : "UNKNOWN",
    section: codeMatch?.[1]?.toUpperCase() ?? "",
  };
}

function ruleKey(identity: LegalRuleIdentity): string {
  return `${identity.statute}:${identity.section}${identity.subsection ? `:${normalizeSection(identity.subsection)}` : ""}`;
}

function isSeriousDefaultBailRule(identity: LegalRuleIdentity): boolean {
  const key = ruleKey(identity);
  return SERIOUS_DEFAULT_BAIL_RULES.includes(key as typeof SERIOUS_DEFAULT_BAIL_RULES[number]) ||
    CURRENT_BNS_SERIOUS_DEFAULT_BAIL_RULES.includes(key as typeof CURRENT_BNS_SERIOUS_DEFAULT_BAIL_RULES[number]);
}

function normalizeRuleIdentities(sections: Array<string | LegalRuleIdentity>, framework: LegalFramework = "LEGACY_IPC_CRPC"): LegalRuleIdentity[] {
  return sections.map((section) => parseRuleIdentity(section, framework)).filter((section) => section.section);
}

function includesAnySection(sections: LegalRuleIdentity[], statute: LegalStatute, targetCodes: readonly string[]): boolean {
  return sections.some((section) => section.statute === statute && targetCodes.includes(section.section));
}

function findPrimarySection(sections: LegalRuleIdentity[]): string {
  for (const section of sections) {
    if (section.section !== "34" && section.statute !== "UNKNOWN") {
      const suffix = section.subsection ? `(${normalizeSection(section.subsection)})` : "";
      return section.statute === "IPC" ? `${section.section}${suffix}` : `${section.statute} ${section.section}${suffix}`;
    }
  }

  return "";
}

function findRuleForSection(section: string | LegalRuleIdentity, framework: LegalFramework = "LEGACY_IPC_CRPC"): SectionRule | null {
  return SECTION_RULES[ruleKey(parseRuleIdentity(section, framework))] ?? null;
}

/** True only when the deterministic engine has an explicit rule for this token. */
export function hasDeterministicSectionRule(section: string | LegalRuleIdentity): boolean {
  return findRuleForSection(section) !== null;
}

function formatYesNo(value: boolean): string {
  return value ? "yes" : "no";
}

/**
 * Checks whether the accused is eligible for default bail under CrPC 167(2)
 * using a deterministic 60-day / 90-day threshold based on the listed sections.
 */
export function checkDefaultBail(
  sections: Array<string | LegalRuleIdentity>,
  custodyDays: number | null,
  chargesheetFiled: boolean,
): DefaultBailResult {
  const identities = normalizeRuleIdentities(sections);
  if (custodyDays === null) {
    if (chargesheetFiled) {
      return {
        eligible: false,
        daysRequired: 0,
        daysServed: null,
        daysRemaining: null,
        note: "Chargesheet already filed",
      };
    }

    const hasSeriousSection = identities.some(isSeriousDefaultBailRule);
    const daysRequired = hasSeriousSection ? 90 : 60;
    return {
      eligible: null,
      daysRequired,
      daysServed: null,
      daysRemaining: null,
      note: "Custody duration unspecified; default bail eligibility not computed",
    };
  }

  const daysServed = Math.max(0, Math.floor(custodyDays));

  if (chargesheetFiled) {
    return {
      eligible: false,
      daysRequired: 0,
      daysServed,
      daysRemaining: 0,
      note: "Chargesheet already filed",
    };
  }

  const hasSeriousSection = identities.some(isSeriousDefaultBailRule);
  const daysRequired = hasSeriousSection ? 90 : 60;
  const eligible = daysServed >= daysRequired;
  const daysRemaining = eligible ? 0 : daysRequired - daysServed;

  return {
    eligible,
    daysRequired,
    daysServed,
    daysRemaining,
    note: eligible
      ? `Statutory default bail threshold of ${daysRequired} days satisfied`
      : `Statutory default bail threshold is ${daysRequired} days`,
  };
}

/**
 * Classifies the offense as bailable or non-bailable using a hardcoded section map,
 * while also surfacing severity, primary section, and special-statute flags.
 */
export function classifyOffense(sections: Array<string | LegalRuleIdentity>, framework: LegalFramework = "LEGACY_IPC_CRPC"): OffenseClassification {
  const identities = normalizeRuleIdentities(sections, framework);
  const primarySection = findPrimarySection(identities);
  const primaryRule = identities.map((section) => findRuleForSection(section)).find(Boolean) ?? null;
  const hasNDPS = includesAnySection(identities, "NDPS", NDPS_TRIGGER_SECTIONS);
  const hasPMLA = includesAnySection(identities, "PMLA", PMLA_TRIGGER_SECTIONS);

  let selectedSeverity: Severity = primaryRule?.severity ?? "moderate";
  let bailable = primaryRule?.bailable ?? false;

  for (const section of identities) {
    const rule = findRuleForSection(section);
    if (!rule) {
      continue;
    }

    if (SEVERITY_ORDER[rule.severity] > SEVERITY_ORDER[selectedSeverity]) {
      selectedSeverity = rule.severity;
    }

    if (!rule.bailable) {
      bailable = false;
    }
  }

  return {
    bailable,
    supported: identities.some((section) => findRuleForSection(section) !== null),
    severity: selectedSeverity,
    primarySection,
    hasNDPS,
    hasPMLA,
  };
}

/**
 * Checks whether the NDPS Act Section 37 bar applies and whether the twin
 * conditions must be satisfied based on quantity category.
 */
export function checkNDPSBar(
  sections: Array<string | LegalRuleIdentity>,
  quantity: QuantityCategory,
): NDPSBarResult {
  const appliesToStatute = includesAnySection(normalizeRuleIdentities(sections, "UNSPECIFIED"), "NDPS", NDPS_TRIGGER_SECTIONS);

  if (!appliesToStatute) {
    return {
      barApplies: false,
      twinConditionsRequired: false,
      quantityCategory: quantity,
      note: "NDPS Act Section 37 not triggered by the listed sections",
    };
  }

  if (quantity === "small") {
    return {
      barApplies: false,
      twinConditionsRequired: false,
      quantityCategory: quantity,
      note: "Small quantity indicated; NDPS Section 37 bar does not apply",
    };
  }

  if (quantity === "commercial") {
    return {
      barApplies: true,
      twinConditionsRequired: true,
      quantityCategory: quantity,
      note: "Commercial quantity indicated; NDPS Section 37 twin conditions apply",
    };
  }

  return {
    barApplies: true,
    twinConditionsRequired: false,
    quantityCategory: quantity,
    note: "NDPS quantity is unknown; verify quantity before final bail analysis",
  };
}

/**
 * Checks whether PMLA twin conditions apply based on the presence of PMLA
 * sections 3 or 4 and carries forward the scheduled offense amount if provided.
 */
export function checkPMLAConditions(
  sections: Array<string | LegalRuleIdentity>,
  pmlaAmount?: number,
): PMLAResult {
  const applies = includesAnySection(normalizeRuleIdentities(sections, "UNSPECIFIED"), "PMLA", PMLA_TRIGGER_SECTIONS);

  if (!applies) {
    return {
      applies: false,
      twinConditionsRequired: false,
      scheduledOffenseAmount: pmlaAmount,
      note: "PMLA twin conditions not triggered by the listed sections",
    };
  }

  return {
    applies: true,
    twinConditionsRequired: true,
    scheduledOffenseAmount: pmlaAmount,
    note: "PMLA twin conditions apply: reasonable grounds of no guilt and no likelihood of reoffending must both be satisfied",
  };
}

/**
 * Flags whether the accused must be routed through the Juvenile Justice Board
 * based solely on age.
 */
export function checkJuvenileFlag(age: number): JuvenileResult {
  if (age < 18) {
    return {
      isJuvenile: true,
      routeTo: "JJB",
      note: "Accused is below 18; route to Juvenile Justice Board and not the Sessions Court",
    };
  }

  return {
    isJuvenile: false,
    routeTo: "SessionsCourt",
    note: "Accused is 18 or above; normal criminal court process applies",
  };
}

function buildPromptInjection(output: {
  framework: LegalFramework;
  defaultBailProvision: string | null;
  defaultBail: DefaultBailResult;
  offenseClass: OffenseClassification;
  ndpsBar: NDPSBarResult | null;
  pmlaConditions: PMLAResult | null;
  juvenile: JuvenileResult;
}): string {
  const lines: string[] = [
    "DETERMINISTIC LEGAL FINDINGS (BACKEND COMPUTED — YOU MUST NOT CONTRADICT THESE):",
    "",
    `Legal Framework: [${output.framework}]`,
    output.offenseClass.supported
      ? `Offense Classification: [${output.offenseClass.bailable ? "bailable" : "non-bailable"}], Severity: [${output.offenseClass.severity}]`
      : "Offense Classification: [unsupported / not determined by the deterministic rule table]",
    `Primary Section: [${output.offenseClass.primarySection}]`,
    "",
    `Default Bail (${output.defaultBailProvision || "framework unresolved"}):`,
  ];

  if (output.defaultBail.daysServed === null) {
    const chargesheetBarsDefaultBail = output.defaultBail.note === "Chargesheet already filed";
    lines.push(
      `- Eligible: [${chargesheetBarsDefaultBail ? "no" : "not computed"}]`,
      "- Days served: [unspecified — not assumed]",
      `- ${output.defaultBail.note}`,
    );
  } else {
    lines.push(
      `- Eligible: [${formatYesNo(output.defaultBail.eligible === true)}]`,
      `- Days served: [${output.defaultBail.daysServed}] / [${output.defaultBail.daysRequired}] required`,
      `- ${output.defaultBail.note}`,
    );
  }

  if (output.ndpsBar) {
    lines.push(
      "",
      "NDPS Section 37 Bar:",
      `- Applies: [${formatYesNo(output.ndpsBar.barApplies)}]`,
      `- Twin conditions required: [${formatYesNo(output.ndpsBar.twinConditionsRequired)}]`,
      `- ${output.ndpsBar.note}`,
    );
  }

  if (output.pmlaConditions) {
    lines.push(
      "",
      "PMLA Twin Conditions:",
      `- Applies: [${formatYesNo(output.pmlaConditions.applies)}]`,
      `- ${output.pmlaConditions.note}`,
    );
  }

  if (output.juvenile.isJuvenile) {
    lines.push(
      "",
      "JUVENILE FLAG:",
      "- Accused is a minor — route to Juvenile Justice Board",
      "- Sessions Court has NO jurisdiction",
    );
  }

  lines.push(
    "",
    "INSTRUCTIONS:",
    "- Do NOT contradict any finding above",
    "- Do NOT mention default bail as a ground if it is marked NOT eligible",
    "- Do NOT analyze NDPS/PMLA bail without applying twin conditions if marked applicable",
    "- Do NOT proceed with Sessions Court analysis if juvenile flag is set",
    "- Your role is legal reasoning and nuance ONLY within these constraints",
  );

  return lines.join("\n");
}

/**
 * Runs all deterministic legal checks together and returns both the structured
 * results and the prompt injection string for downstream AI consumers.
 */
export function runLegalRules(input: LegalRuleInput): LegalRuleOutput {
  const framework = input.framework ?? "LEGACY_IPC_CRPC";
  const normalizedSections = normalizeRuleIdentities(input.sections, framework);
  const ruleSections = normalizedSections.filter((section) => {
    if (framework === "CURRENT_BNS_BNSS") {
      return section.statute === "BNS" || section.statute === "NDPS" || section.statute === "PMLA";
    }
    if (framework === "UNSPECIFIED") {
      return section.statute === "IPC" || section.statute === "NDPS" || section.statute === "PMLA";
    }
    return section.statute === "IPC" || section.statute === "NDPS" || section.statute === "PMLA";
  });
  const defaultBail = checkDefaultBail(ruleSections, input.custodyDays, input.chargesheetFiled);
  const offenseClass = classifyOffense(ruleSections, framework);
  const juvenile = checkJuvenileFlag(input.age);
  const ndpsBar = offenseClass.hasNDPS ? checkNDPSBar(ruleSections, input.ndpsQuantity ?? "unknown") : null;
  const pmlaConditions = offenseClass.hasPMLA ? checkPMLAConditions(ruleSections, input.pmlaAmount) : null;

  const output: LegalRuleOutput = {
    framework,
    defaultBailProvision: defaultBailProvisionForFramework(framework),
    defaultBail,
    offenseClass,
    ndpsBar,
    pmlaConditions,
    juvenile,
    promptInjection: "",
  };

  return {
    ...output,
    promptInjection: buildPromptInjection(output),
  };
}
