export type Severity = "minor" | "moderate" | "serious" | "severe";
export type QuantityCategory = "small" | "commercial" | "unknown";
export type JuvenileRoute = "JJB" | "SessionsCourt" | "Magistrate";

export interface DefaultBailResult {
  eligible: boolean;
  daysRequired: number;
  daysServed: number;
  daysRemaining: number;
  note: string;
}

export interface OffenseClassification {
  bailable: boolean;
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
  sections: string[];
  custodyDays: number;
  chargesheetFiled: boolean;
  age: number;
  ndpsQuantity?: QuantityCategory;
  pmlaAmount?: number;
}

export interface LegalRuleOutput {
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

const SERIOUS_DEFAULT_BAIL_SECTIONS = ["302", "307", "376", "376A", "376D", "396", "364A", "121", "132"] as const;
const NDPS_TRIGGER_SECTIONS = ["8", "21", "22", "23", "27A"] as const;
const PMLA_TRIGGER_SECTIONS = ["3", "4"] as const;

const SECTION_RULES: Record<string, SectionRule> = {
  "302": { bailable: false, severity: "severe" },
  "307": { bailable: false, severity: "serious" },
  "376": { bailable: false, severity: "severe" },
  "420": { bailable: false, severity: "moderate" },
  "406": { bailable: false, severity: "moderate" },
  "498A": { bailable: false, severity: "moderate" },
  "379": { bailable: true, severity: "minor" },
  "323": { bailable: true, severity: "minor" },
  "324": { bailable: true, severity: "minor" },
  "504": { bailable: true, severity: "minor" },
  "506": { bailable: true, severity: "minor" },
  "8": { bailable: false, severity: "serious" },
  "21": { bailable: false, severity: "serious" },
  "22": { bailable: false, severity: "serious" },
  "3": { bailable: false, severity: "serious" },
  "4": { bailable: false, severity: "serious" },
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

function containsSectionNumber(section: string, code: string): boolean {
  const normalizedSection = normalizeSection(section);
  const normalizedCode = code.toUpperCase();

  if (normalizedSection === normalizedCode) {
    return true;
  }

  const escapedCode = normalizedCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`(^|[^A-Z0-9])${escapedCode}([^A-Z0-9]|$)`),
    new RegExp(`(^|[^A-Z0-9])${escapedCode}/`),
    new RegExp(`/${escapedCode}([^A-Z0-9]|$)`),
  ];

  return patterns.some((pattern) => pattern.test(normalizedSection));
}

function includesAnySection(sections: string[], targetCodes: readonly string[]): boolean {
  return sections.some((section) => targetCodes.some((code) => containsSectionNumber(section, code)));
}

function findPrimarySection(sections: string[]): string {
  for (const section of sections) {
    const normalized = normalizeSection(section);
    if (!containsSectionNumber(normalized, "34")) {
      return section.trim();
    }
  }

  return sections[0]?.trim() ?? "";
}

function findRuleForSection(section: string): SectionRule | null {
  const entries = Object.entries(SECTION_RULES).sort((left, right) => right[0].length - left[0].length);

  for (const [code, rule] of entries) {
    if (containsSectionNumber(section, code)) {
      return rule;
    }
  }

  return null;
}

function formatYesNo(value: boolean): string {
  return value ? "yes" : "no";
}

/**
 * Checks whether the accused is eligible for default bail under CrPC 167(2)
 * using a deterministic 60-day / 90-day threshold based on the listed sections.
 */
export function checkDefaultBail(
  sections: string[],
  custodyDays: number,
  chargesheetFiled: boolean,
): DefaultBailResult {
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

  const hasSeriousSection = includesAnySection(sections, SERIOUS_DEFAULT_BAIL_SECTIONS);
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
export function classifyOffense(sections: string[]): OffenseClassification {
  const primarySection = findPrimarySection(sections);
  const primaryRule = findRuleForSection(primarySection);
  const hasNDPS = includesAnySection(sections, NDPS_TRIGGER_SECTIONS);
  const hasPMLA = includesAnySection(sections, PMLA_TRIGGER_SECTIONS);

  let selectedSeverity: Severity = primaryRule?.severity ?? "moderate";
  let bailable = primaryRule?.bailable ?? false;

  for (const section of sections) {
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
  sections: string[],
  quantity: QuantityCategory,
): NDPSBarResult {
  const appliesToStatute = includesAnySection(sections, NDPS_TRIGGER_SECTIONS);

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
  sections: string[],
  pmlaAmount?: number,
): PMLAResult {
  const applies = includesAnySection(sections, PMLA_TRIGGER_SECTIONS);

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
  defaultBail: DefaultBailResult;
  offenseClass: OffenseClassification;
  ndpsBar: NDPSBarResult | null;
  pmlaConditions: PMLAResult | null;
  juvenile: JuvenileResult;
}): string {
  const lines: string[] = [
    "DETERMINISTIC LEGAL FINDINGS (BACKEND COMPUTED — YOU MUST NOT CONTRADICT THESE):",
    "",
    `Offense Classification: [${output.offenseClass.bailable ? "bailable" : "non-bailable"}], Severity: [${output.offenseClass.severity}]`,
    `Primary Section: [${output.offenseClass.primarySection}]`,
    "",
    "Default Bail (CrPC 167(2)):",
    `- Eligible: [${formatYesNo(output.defaultBail.eligible)}]`,
    `- Days served: [${output.defaultBail.daysServed}] / [${output.defaultBail.daysRequired}] required`,
    `- ${output.defaultBail.note}`,
  ];

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
  const defaultBail = checkDefaultBail(input.sections, input.custodyDays, input.chargesheetFiled);
  const offenseClass = classifyOffense(input.sections);
  const juvenile = checkJuvenileFlag(input.age);
  const ndpsBar = offenseClass.hasNDPS ? checkNDPSBar(input.sections, input.ndpsQuantity ?? "unknown") : null;
  const pmlaConditions = offenseClass.hasPMLA ? checkPMLAConditions(input.sections, input.pmlaAmount) : null;

  const output: LegalRuleOutput = {
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
