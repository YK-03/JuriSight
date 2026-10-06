import {
  determineAuthoritativeEligibility,
  type AuthoritativeEligibilityResult,
} from "../bail-strategy-engine";
import { runLegalRules, type LegalRuleOutput } from "../legal-rules";
import {
  bailStrategyScenarios,
  type BailScenarioExecution,
  type BailStrategyEvaluationScenario,
} from "./bail-scenarios";

export type BailEvaluationResult = {
  scenarioId: string;
  passed: boolean;
  expectedEligibility: BailStrategyEvaluationScenario["expected"]["eligibility"];
  actualEligibility: AuthoritativeEligibilityResult["eligibility"];
  expectedAuthority: BailStrategyEvaluationScenario["expected"]["authority"];
  actualAuthority: AuthoritativeEligibilityResult["authority"];
  failureReasons: string[];
  deterministicFindings: {
    framework: LegalRuleOutput["framework"];
    primarySection: string;
    supported: boolean;
    bailable: boolean | null;
    severity: LegalRuleOutput["offenseClass"]["severity"];
    defaultBailEligible: boolean | null;
    defaultBailDaysServed: number | null;
    defaultBailDaysRequired: number;
    chargesheetFiled: boolean;
    specialActBar: boolean;
    isJuvenile: boolean;
  };
};

export type BailEvaluationSummary = {
  results: BailEvaluationResult[];
  total: number;
  passed: number;
  failed: number;
  overallPassed: boolean;
};

function parseAge(value: string): number {
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 25;
}

function parseSections(value: string): string[] {
  return value
    .split(/[,\n]+/)
    .map((section) => section.trim())
    .filter(Boolean);
}

export function runBailScenarioDeterministicPipeline(
  scenario: BailStrategyEvaluationScenario,
): { legalRules: LegalRuleOutput; authoritative: AuthoritativeEligibilityResult } {
  const { input, execution } = scenario;
  const legalRules = runLegalRules({
    sections: parseSections(input.sections),
    custodyDays: execution.custodyDays,
    chargesheetFiled: execution.chargesheetFiled,
    age: parseAge(input.age),
    framework: input.legalFramework,
    ndpsQuantity: execution.ndpsQuantity ?? input.ndpsQuantity,
    pmlaAmount: execution.pmlaAmount ?? input.pmlaAmount,
  });

  const authoritative = determineAuthoritativeEligibility(
    legalRules,
    input,
    execution.custodyDays,
    execution.chargesheetFiled,
  );

  return { legalRules, authoritative };
}

function toDeterministicFindings(
  legalRules: LegalRuleOutput,
  execution: BailScenarioExecution,
): BailEvaluationResult["deterministicFindings"] {
  return {
    framework: legalRules.framework,
    primarySection: legalRules.offenseClass.primarySection,
    supported: legalRules.offenseClass.supported,
    bailable: legalRules.offenseClass.bailable,
    severity: legalRules.offenseClass.severity,
    defaultBailEligible: legalRules.defaultBail.eligible,
    defaultBailDaysServed: legalRules.defaultBail.daysServed,
    defaultBailDaysRequired: legalRules.defaultBail.daysRequired,
    chargesheetFiled: execution.chargesheetFiled,
    specialActBar: Boolean(
      legalRules.ndpsBar?.twinConditionsRequired ||
      legalRules.pmlaConditions?.twinConditionsRequired,
    ),
    isJuvenile: legalRules.juvenile.isJuvenile,
  };
}

/**
 * Evaluates deterministic baseline correctness for one synthetic scenario.
 * This deliberately excludes Groq, retrieval, persistence, and network calls.
 */
export function evaluateBailScenario(
  scenario: BailStrategyEvaluationScenario,
): BailEvaluationResult {
  const { legalRules, authoritative } = runBailScenarioDeterministicPipeline(scenario);
  const failureReasons: string[] = [];

  if (authoritative.eligibility !== scenario.expected.eligibility) {
    failureReasons.push(
      `eligibility expected ${scenario.expected.eligibility} but received ${authoritative.eligibility}`,
    );
  }

  if (authoritative.authority !== scenario.expected.authority) {
    failureReasons.push(
      `authority expected ${scenario.expected.authority} but received ${authoritative.authority}`,
    );
  }

  return {
    scenarioId: scenario.id,
    passed: failureReasons.length === 0,
    expectedEligibility: scenario.expected.eligibility,
    actualEligibility: authoritative.eligibility,
    expectedAuthority: scenario.expected.authority,
    actualAuthority: authoritative.authority,
    failureReasons,
    deterministicFindings: toDeterministicFindings(legalRules, scenario.execution),
  };
}

/**
 * Runs the complete deterministic baseline suite. It is intentionally
 * separate from LLM and legal-authority retrieval evaluation.
 */
export function evaluateAllBailScenarios(
  scenarios: readonly BailStrategyEvaluationScenario[] = bailStrategyScenarios,
): BailEvaluationSummary {
  const results = scenarios.map(evaluateBailScenario);
  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;

  return {
    results,
    total: results.length,
    passed,
    failed,
    overallPassed: failed === 0,
  };
}
