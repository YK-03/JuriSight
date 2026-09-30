import type { LegalRuleOutput, Severity } from "./legal-rules";
import type { LegalFramework } from "./legal-framework";
import type { BailStrategyCourtStage } from "./section-preservation";

export type OffenseType = "non-bailable" | "bailable" | "ndps" | "uapa" | "pmla" | "unknown";
export type CustodyDuration = "under-30" | "1-6mo" | "6-12mo" | "1-2yr" | "over-2yr";
export type PreviousBail = "none" | "1-rejected" | "2plus-rejected" | "granted-cancelled";
export type Eligibility = "Likely eligible" | "Uncertain" | "Unlikely eligible";

export type AuthoritativeAuthority =
  | "DETERMINISTIC"
  | "DETERMINISTIC_UNRESOLVED"
  | "DISCRETIONARY";

export interface DeterministicFindingsMetadata {
  framework: LegalFramework;
  primarySection: string;
  bailable: boolean | null;
  supported: boolean;
  severity: Severity | null;
  defaultBailEligible: boolean | null;
  defaultBailDaysServed: number | null;
  defaultBailDaysRequired: number;
  defaultBailProvision: string | null;
  chargesheetFiled: boolean;
  specialActBar: boolean;
  isJuvenile: boolean;
}

export interface AuthoritativeEligibilityResult {
  eligibility: Eligibility;
  authority: AuthoritativeAuthority;
  ruleSummary: string;
  deterministicFindings: DeterministicFindingsMetadata;
  discretionaryFactors?: string[];
}

export interface BailStrategyInput {
  sections: string;
  legalFramework?: LegalFramework;
  offenseType: OffenseType;
  custodyDuration: CustodyDuration;
  courtStage: BailStrategyCourtStage;
  previousBail: PreviousBail;
  accusedTags: string[];
  age: string;
  firOrCnr: string;
  additionalContext: string;
  ndpsQuantity?: any;
  pmlaAmount?: number;
}

export function labelForCustodyDuration(value: CustodyDuration): string {
  switch (value) {
    case "under-30":
      return "Under 30 days";
    case "1-6mo":
      return "1 to 6 months";
    case "6-12mo":
      return "6 to 12 months";
    case "1-2yr":
      return "1 to 2 years";
    case "over-2yr":
      return "Over 2 years";
  }
}

export function labelForOffenseType(value: OffenseType): string {
  switch (value) {
    case "non-bailable":
      return "Non-bailable offense";
    case "bailable":
      return "Bailable offense";
    case "ndps":
      return "NDPS matter";
    case "uapa":
      return "UAPA matter";
    case "pmla":
      return "PMLA matter";
    case "unknown":
      return "Unclear offense classification";
  }
}

export function labelForCourtStage(value: BailStrategyCourtStage): string {
  switch (value) {
    case "SESSIONS":
      return "Sessions Court stage";
    case "MAGISTRATE":
      return "Magistrate stage";
    case "no-chargesheet":
      return "Charge sheet not filed";
    case "HIGH_COURT":
      return "High Court stage";
    case "UNSPECIFIED":
      return "Court stage unspecified";
  }
}

export function labelForPreviousBail(value: PreviousBail): string {
  switch (value) {
    case "none":
      return "No prior bail rejection";
    case "1-rejected":
      return "One prior rejection";
    case "2plus-rejected":
      return "Two or more prior rejections";
    case "granted-cancelled":
      return "Bail previously granted and later cancelled";
  }
}

function buildDiscretionaryFactors(
  legalRules: LegalRuleOutput,
  body: BailStrategyInput,
  custodyDays: number,
  chargesheetFiled: boolean,
): string[] {
  const factors: string[] = [];

  const section = legalRules.offenseClass.primarySection || body.sections.trim();
  const severity = legalRules.offenseClass.severity;
  factors.push(
    `Offense: Non-bailable${section ? ` (${section})` : ""}${severity ? `, Severity: ${severity}` : ""}`
  );

  factors.push(`Custody served: ${custodyDays} days (${labelForCustodyDuration(body.custodyDuration)})`);

  factors.push(
    chargesheetFiled
      ? "Investigation status: Chargesheet filed"
      : "Investigation status: Investigation ongoing (chargesheet not filed)"
  );

  factors.push(`Prior bail history: ${labelForPreviousBail(body.previousBail)}`);

  factors.push(`Procedural forum: ${labelForCourtStage(body.courtStage)}`);

  if (body.accusedTags && body.accusedTags.length > 0) {
    const cleanTags = body.accusedTags.map((t) => t.trim()).filter(Boolean);
    if (cleanTags.length > 0) {
      factors.push(`Accused profile factors: ${cleanTags.join(", ")}`);
    }
  }

  if (body.offenseType === "uapa") {
    factors.push("Matter flagged as UAPA (statutory bar under Section 43D(5) requires individual court verification)");
  }

  return factors;
}

export function determineAuthoritativeEligibility(
  legalRules: LegalRuleOutput,
  body: BailStrategyInput,
  custodyDays: number,
  chargesheetFiled: boolean,
): AuthoritativeEligibilityResult {
  const findings: DeterministicFindingsMetadata = {
    framework: legalRules.framework,
    primarySection: legalRules.offenseClass.primarySection,
    bailable: legalRules.offenseClass.bailable,
    supported: legalRules.offenseClass.supported,
    severity: legalRules.offenseClass.severity,
    defaultBailEligible: legalRules.defaultBail.eligible,
    defaultBailDaysServed: legalRules.defaultBail.daysServed,
    defaultBailDaysRequired: legalRules.defaultBail.daysRequired,
    defaultBailProvision: legalRules.defaultBailProvision,
    chargesheetFiled,
    specialActBar: Boolean(
      legalRules.ndpsBar?.twinConditionsRequired ||
      legalRules.pmlaConditions?.twinConditionsRequired
    ),
    isJuvenile: legalRules.juvenile.isJuvenile,
  };

  // 1. JUVENILE ROUTING (JJ Act Section 12)
  if (legalRules.juvenile.isJuvenile) {
    return {
      eligibility: "Likely eligible",
      authority: "DETERMINISTIC",
      ruleSummary: "Accused is a minor (<18); jurisdiction lies exclusively before the Juvenile Justice Board under Section 12 of the Juvenile Justice Act.",
      deterministicFindings: findings,
    };
  }

  // 2. STATUTORY DEFAULT BAIL (CrPC 167(2) / BNSS 187)
  if (legalRules.defaultBail.eligible === true) {
    const provision = legalRules.defaultBailProvision || "CrPC 167(2)";
    return {
      eligibility: "Likely eligible",
      authority: "DETERMINISTIC",
      ruleSummary: `Statutory default bail threshold of ${legalRules.defaultBail.daysRequired} days satisfied without chargesheet (indefeasible right under ${provision}).`,
      deterministicFindings: findings,
    };
  }

  // 3. BAILABLE OFFENSE (CrPC 436 / BNSS 478)
  if (legalRules.offenseClass.supported && legalRules.offenseClass.bailable === true) {
    const provision = legalRules.framework === "CURRENT_BNS_BNSS" ? "BNSS 478" : "CrPC 436";
    return {
      eligibility: "Likely eligible",
      authority: "DETERMINISTIC",
      ruleSummary: `Offense is classified as bailable; bail is an absolute statutory right under ${provision} upon furnishing surety.`,
      deterministicFindings: findings,
    };
  }

  // 4. SPECIAL-ACT STATUTORY BAR (NDPS Commercial / PMLA Section 45)
  // Only where already supported and established by runLegalRules()
  if (
    legalRules.ndpsBar?.twinConditionsRequired === true ||
    legalRules.pmlaConditions?.twinConditionsRequired === true
  ) {
    const actName = legalRules.pmlaConditions?.twinConditionsRequired
      ? "PMLA Section 45"
      : "NDPS Section 37";
    return {
      eligibility: "Unlikely eligible",
      authority: "DETERMINISTIC",
      ruleSummary: `Statutory twin-condition bar applies under ${actName}; bail restricted absent demonstrated satisfaction of twin conditions.`,
      deterministicFindings: findings,
    };
  }

  // 5. NDPS UNKNOWN QUANTITY
  if (legalRules.offenseClass.hasNDPS && legalRules.ndpsBar?.quantityCategory === "unknown") {
    return {
      eligibility: "Uncertain",
      authority: "DETERMINISTIC_UNRESOLVED",
      ruleSummary: "NDPS seizure quantity category is unknown; Section 37 statutory bar cannot be resolved without verified recovery quantity.",
      deterministicFindings: findings,
    };
  }

  // 6. UNSUPPORTED SECTIONS OR UNRESOLVED FRAMEWORK
  if (
    !legalRules.offenseClass.supported ||
    legalRules.offenseClass.bailable === null ||
    (legalRules.framework === "UNSPECIFIED" && !legalRules.offenseClass.primarySection)
  ) {
    const isUapa = body.offenseType === "uapa";
    return {
      eligibility: "Uncertain",
      authority: "DETERMINISTIC_UNRESOLVED",
      ruleSummary: isUapa
        ? "UAPA Section 43D(5) statutory threshold is not modeled in the deterministic rule table; statutory classification unresolved."
        : "Offense sections or legal framework are not recognized by the deterministic rule table; statutory classification unresolved.",
      deterministicFindings: findings,
    };
  }

  // 7. SUPPORTED NON-BAILABLE OFFENSE (DISCRETIONARY)
  // Ordinary supported non-bailable offences where no hard statutory entitlement or bar applies:
  // Bail is an exercise of judicial discretion under CrPC 437/439 (or BNSS 480/483).
  // The backend does NOT decide this with heuristics.
  const proceduralProvision =
    legalRules.framework === "CURRENT_BNS_BNSS" ? "BNSS 480/483" : "CrPC 437/439";
  const primarySection = legalRules.offenseClass.primarySection || "Non-bailable offense";

  return {
    eligibility: "Uncertain",
    authority: "DISCRETIONARY",
    ruleSummary: `Regular bail for ${primarySection} is discretionary under ${proceduralProvision}; determined by judicial assessment of case facts rather than an absolute statutory rule.`,
    deterministicFindings: findings,
    discretionaryFactors: buildDiscretionaryFactors(legalRules, body, custodyDays, chargesheetFiled),
  };
}
