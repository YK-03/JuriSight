import type {
  AuthoritativeAuthority,
  BailStrategyInput,
  Eligibility,
} from "../bail-strategy-engine";
import type { QuantityCategory } from "../legal-rules";

export type BailScenarioExpectedOutcome = {
  eligibility: Eligibility;
  authority: AuthoritativeAuthority;
};

/**
 * Deterministic execution values that the API derives from BailStrategyInput
 * before calling runLegalRules(). Keeping them beside the fixture makes each
 * scenario directly executable without changing the production route.
 */
export type BailScenarioExecution = {
  custodyDays: number;
  chargesheetFiled: boolean;
  ndpsQuantity?: QuantityCategory;
  pmlaAmount?: number;
};

export type BailScenarioOfflineRetrievalMode =
  | "verified"
  | "curated-fallback"
  | "provider-rejection"
  | "provider-failure";

export type BailStrategyEvaluationScenario = {
  id: string;
  description: string;
  input: BailStrategyInput;
  execution: BailScenarioExecution;
  expected: BailScenarioExpectedOutcome;
  expectedRetrievalIssues: readonly string[];
  offlineRetrievalMode: BailScenarioOfflineRetrievalMode;
};

const syntheticCaseId = (id: string) => `synthetic-${id}`;

export const bailStrategyScenarios: readonly BailStrategyEvaluationScenario[] = [
  {
    id: "standard-non-bailable",
    description: "Supported legacy non-bailable offence with no statutory entitlement or bar.",
    input: {
      sections: "IPC 420",
      legalFramework: "LEGACY_IPC_CRPC",
      offenseType: "non-bailable",
      custodyDuration: "1-6mo",
      courtStage: "SESSIONS",
      previousBail: "none",
      accusedTags: [],
      age: "30",
      firOrCnr: syntheticCaseId("standard-non-bailable"),
      additionalContext: "Synthetic matter with chargesheet filed.",
    },
    execution: {
      custodyDays: 90,
      chargesheetFiled: true,
    },
    expected: {
      eligibility: "Uncertain",
      authority: "DISCRETIONARY",
    },
    expectedRetrievalIssues: [
      "LEGACY_IPC_CRPC",
      "IPC 420",
      "non-bailable offence",
      "Sessions Court",
      "chargesheet filed",
      "custody 90 days",
      "no prior bail rejection",
      "judicial discretion",
    ],
    offlineRetrievalMode: "verified",
  },
  {
    id: "bailable-offence",
    description: "Supported legacy bailable offence.",
    input: {
      sections: "IPC 379",
      legalFramework: "LEGACY_IPC_CRPC",
      offenseType: "bailable",
      custodyDuration: "under-30",
      courtStage: "MAGISTRATE",
      previousBail: "none",
      accusedTags: [],
      age: "30",
      firOrCnr: syntheticCaseId("bailable-offence"),
      additionalContext: "Synthetic bailable-offence scenario.",
    },
    execution: {
      custodyDays: 10,
      chargesheetFiled: true,
    },
    expected: {
      eligibility: "Likely eligible",
      authority: "DETERMINISTIC",
    },
    expectedRetrievalIssues: [
      "LEGACY_IPC_CRPC",
      "IPC 379",
      "bailable",
      "Magistrate Court",
      "chargesheet filed",
      "custody 10 days",
      "no prior bail rejection",
    ],
    offlineRetrievalMode: "curated-fallback",
  },
  {
    id: "default-bail",
    description: "Recognized offence exceeding the default-bail threshold before chargesheet filing.",
    input: {
      sections: "IPC 420",
      legalFramework: "LEGACY_IPC_CRPC",
      offenseType: "non-bailable",
      custodyDuration: "1-6mo",
      courtStage: "no-chargesheet",
      previousBail: "none",
      accusedTags: [],
      age: "30",
      firOrCnr: syntheticCaseId("default-bail"),
      additionalContext: "Synthetic matter with investigation ongoing.",
    },
    execution: {
      custodyDays: 90,
      chargesheetFiled: false,
    },
    expected: {
      eligibility: "Likely eligible",
      authority: "DETERMINISTIC",
    },
    expectedRetrievalIssues: [
      "LEGACY_IPC_CRPC",
      "IPC 420",
      "non-bailable offence",
      "pre-chargesheet",
      "investigation ongoing",
      "custody 90 days",
      "no prior bail rejection",
      "default bail",
    ],
    offlineRetrievalMode: "provider-rejection",
  },
  {
    id: "ndps-commercial-quantity",
    description: "NDPS matter with commercial quantity and the statutory twin-condition bar.",
    input: {
      sections: "NDPS 21",
      legalFramework: "LEGACY_IPC_CRPC",
      offenseType: "ndps",
      custodyDuration: "1-6mo",
      courtStage: "SESSIONS",
      previousBail: "none",
      accusedTags: [],
      age: "30",
      firOrCnr: syntheticCaseId("ndps-commercial-quantity"),
      additionalContext: "Synthetic commercial-quantity scenario.",
      ndpsQuantity: "commercial",
    },
    execution: {
      custodyDays: 90,
      chargesheetFiled: true,
      ndpsQuantity: "commercial",
    },
    expected: {
      eligibility: "Unlikely eligible",
      authority: "DETERMINISTIC",
    },
    expectedRetrievalIssues: [
      "LEGACY_IPC_CRPC",
      "NDPS 21",
      "ndps",
      "Sessions Court",
      "chargesheet filed",
      "custody 90 days",
      "no prior bail rejection",
      "NDPS Section 37 twin conditions",
    ],
    offlineRetrievalMode: "provider-failure",
  },
  {
    id: "ndps-unresolved-quantity",
    description: "NDPS matter where the recovery quantity is unresolved.",
    input: {
      sections: "NDPS 21",
      legalFramework: "LEGACY_IPC_CRPC",
      offenseType: "ndps",
      custodyDuration: "under-30",
      courtStage: "SESSIONS",
      previousBail: "none",
      accusedTags: [],
      age: "30",
      firOrCnr: syntheticCaseId("ndps-unresolved-quantity"),
      additionalContext: "Synthetic scenario with quantity not verified.",
      ndpsQuantity: "unknown",
    },
    execution: {
      custodyDays: 10,
      chargesheetFiled: true,
      ndpsQuantity: "unknown",
    },
    expected: {
      eligibility: "Uncertain",
      authority: "DETERMINISTIC_UNRESOLVED",
    },
    expectedRetrievalIssues: [
      "LEGACY_IPC_CRPC",
      "NDPS 21",
      "ndps",
      "Sessions Court",
      "chargesheet filed",
      "custody 10 days",
      "no prior bail rejection",
    ],
    offlineRetrievalMode: "verified",
  },
  {
    id: "juvenile-case",
    description: "Supported offence involving a person below 18, routed deterministically to the juvenile forum.",
    input: {
      sections: "IPC 420",
      legalFramework: "LEGACY_IPC_CRPC",
      offenseType: "non-bailable",
      custodyDuration: "under-30",
      courtStage: "MAGISTRATE",
      previousBail: "none",
      accusedTags: [],
      age: "17",
      firOrCnr: syntheticCaseId("juvenile-case"),
      additionalContext: "Synthetic juvenile-routing scenario.",
    },
    execution: {
      custodyDays: 10,
      chargesheetFiled: true,
    },
    expected: {
      eligibility: "Likely eligible",
      authority: "DETERMINISTIC",
    },
    expectedRetrievalIssues: [
      "LEGACY_IPC_CRPC",
      "IPC 420",
      "non-bailable offence",
      "Magistrate Court",
      "chargesheet filed",
      "custody 10 days",
      "no prior bail rejection",
    ],
    offlineRetrievalMode: "curated-fallback",
  },
  {
    id: "unsupported-offence-framework",
    description: "Unsupported BNS section under the current BNS/BNSS framework.",
    input: {
      sections: "BNS 420",
      legalFramework: "CURRENT_BNS_BNSS",
      offenseType: "unknown",
      custodyDuration: "1-6mo",
      courtStage: "SESSIONS",
      previousBail: "none",
      accusedTags: [],
      age: "30",
      firOrCnr: syntheticCaseId("unsupported-offence-framework"),
      additionalContext: "Synthetic unsupported-framework scenario.",
    },
    execution: {
      custodyDays: 90,
      chargesheetFiled: true,
    },
    expected: {
      eligibility: "Uncertain",
      authority: "DETERMINISTIC_UNRESOLVED",
    },
    expectedRetrievalIssues: [
      "CURRENT_BNS_BNSS",
      "BNS 420",
      "unknown",
      "Sessions Court",
      "chargesheet filed",
      "custody 90 days",
      "no prior bail rejection",
    ],
    offlineRetrievalMode: "verified",
  },
  {
    id: "severe-discretionary",
    description: "Supported severe non-bailable offence remaining within judicial discretion.",
    input: {
      sections: "IPC 302",
      legalFramework: "LEGACY_IPC_CRPC",
      offenseType: "non-bailable",
      custodyDuration: "under-30",
      courtStage: "SESSIONS",
      previousBail: "none",
      accusedTags: [],
      age: "35",
      firOrCnr: syntheticCaseId("severe-discretionary"),
      additionalContext: "Synthetic severe-offence scenario with chargesheet filed.",
    },
    execution: {
      custodyDays: 10,
      chargesheetFiled: true,
    },
    expected: {
      eligibility: "Uncertain",
      authority: "DISCRETIONARY",
    },
    expectedRetrievalIssues: [
      "LEGACY_IPC_CRPC",
      "IPC 302",
      "non-bailable offence",
      "Sessions Court",
      "chargesheet filed",
      "custody 10 days",
      "no prior bail rejection",
      "judicial discretion",
    ],
    offlineRetrievalMode: "verified",
  },
  {
    id: "favourable-discretionary",
    description: "Long custody and mitigating synthetic factors in an ordinary discretionary matter.",
    input: {
      sections: "IPC 420",
      legalFramework: "LEGACY_IPC_CRPC",
      offenseType: "non-bailable",
      custodyDuration: "over-2yr",
      courtStage: "HIGH_COURT",
      previousBail: "none",
      accusedTags: ["cooperated in investigation", "clean antecedents", "parity with co-accused"],
      age: "45",
      firOrCnr: syntheticCaseId("favourable-discretionary"),
      additionalContext: "Synthetic scenario involving prolonged custody and trial delay.",
    },
    execution: {
      custodyDays: 730,
      chargesheetFiled: true,
    },
    expected: {
      eligibility: "Uncertain",
      authority: "DISCRETIONARY",
    },
    expectedRetrievalIssues: [
      "LEGACY_IPC_CRPC",
      "IPC 420",
      "non-bailable offence",
      "High Court",
      "chargesheet filed",
      "custody 730 days",
      "no prior bail rejection",
      "judicial discretion",
      "cooperation",
      "parity",
      "first-time offender",
      "trial delay",
    ],
    offlineRetrievalMode: "curated-fallback",
  },
  {
    id: "previous-bail-rejection-parity",
    description: "Discretionary matter with a prior bail rejection and parity-related synthetic facts.",
    input: {
      sections: "IPC 307",
      legalFramework: "LEGACY_IPC_CRPC",
      offenseType: "non-bailable",
      custodyDuration: "6-12mo",
      courtStage: "SESSIONS",
      previousBail: "1-rejected",
      accusedTags: ["parity with co-accused"],
      age: "32",
      firOrCnr: syntheticCaseId("previous-bail-rejection-parity"),
      additionalContext: "Synthetic parity scenario with chargesheet filed.",
    },
    execution: {
      custodyDays: 180,
      chargesheetFiled: true,
    },
    expected: {
      eligibility: "Uncertain",
      authority: "DISCRETIONARY",
    },
    expectedRetrievalIssues: [
      "LEGACY_IPC_CRPC",
      "IPC 307",
      "non-bailable offence",
      "Sessions Court",
      "chargesheet filed",
      "custody 180 days",
      "previous bail history",
      "judicial discretion",
      "parity",
    ],
    offlineRetrievalMode: "provider-rejection",
  },
] as const;
