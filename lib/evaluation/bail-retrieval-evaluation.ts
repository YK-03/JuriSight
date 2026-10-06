import {
  buildBailAuthorityQuery,
  retrieveAuthoritiesSafely,
  retrieveVerifiedAuthorities,
  selectVerifiedOrCuratedAuthorities,
  type AuthorityRetrievalQuery,
  type RetrievedAuthority,
  type VerifiedAuthoritySource,
} from "../authority-retrieval";
import {
  runBailScenarioDeterministicPipeline,
} from "./bail-evaluation";
import {
  bailStrategyScenarios,
  type BailStrategyEvaluationScenario,
} from "./bail-scenarios";

export type BailRetrievalEvaluationTrace = {
  verifiedAuthorities: RetrievedAuthority[];
  curatedAuthorities: RetrievedAuthority[];
  selectedAuthorities: RetrievedAuthority[];
  rejectedProviderCandidates: unknown[];
  providerFailed: boolean;
};

export type BailRetrievalEvaluationResult = {
  scenarioId: string;
  expectedIssues: string[];
  matchedIssues: string[];
  missingIssues: string[];
  queryIssueOverlap: number;
  verifiedAuthorityRetrieved: boolean;
  curatedFallbackOccurred: boolean;
  providerRejectionCount: number;
  providerFailed: boolean;
  provenanceValid: boolean;
  irrelevantAuthorityCount: number;
  invalidAuthorityRejected: boolean;
  passed: boolean;
  failureReasons: string[];
};

export type BailRetrievalEvaluationSummary = {
  results: BailRetrievalEvaluationResult[];
  total: number;
  passed: number;
  failed: number;
  overallPassed: boolean;
};

function normalizeIssue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasIssueOverlap(query: AuthorityRetrievalQuery, expectedIssue: string): boolean {
  const expected = normalizeIssue(expectedIssue);
  return query.issues.some((issue) => normalizeIssue(issue) === expected);
}

function authorityMatchesExpectedIssue(
  authority: RetrievedAuthority,
  expectedIssues: readonly string[],
): boolean {
  const searchable = [
    ...(authority.derived?.matchedIssues ?? []),
    ...(authority.relevantSections ?? []),
  ].map(normalizeIssue);

  return expectedIssues.some((issue) => searchable.includes(normalizeIssue(issue)));
}

function provenanceIsValid(authorities: RetrievedAuthority[]): boolean {
  return authorities.every((authority) =>
    authority.provenance === "verified" || authority.provenance === "curated",
  );
}

function syntheticVerifiedCandidate(scenario: BailStrategyEvaluationScenario) {
  return {
    authorityId: `synthetic-authority-${scenario.id}`,
    caseName: "SYNTHETIC AUTHORITY RECORD",
    court: "SYNTHETIC COURT",
    officialIdentifier: `synthetic-identifier-${scenario.id}`,
    date: "synthetic-date",
    source: "synthetic-provider",
    judgmentUrl: `https://example.invalid/synthetic/${scenario.id}`,
    relevantPassage: "Synthetic provider passage for retrieval-metric testing only.",
    relevantSections: scenario.expectedRetrievalIssues.slice(0, 1),
  };
}

function syntheticCuratedAuthority(
  scenario: BailStrategyEvaluationScenario,
): RetrievedAuthority {
  return {
    authorityId: `synthetic-curated-${scenario.id}`,
    caseName: "SYNTHETIC CURATED RECORD",
    derived: {
      matchedIssues: scenario.expectedRetrievalIssues.slice(0, 1),
    },
    provenance: "curated",
  };
}

function createOfflineSource(
  scenario: BailStrategyEvaluationScenario,
): VerifiedAuthoritySource {
  return {
    async retrieve() {
      switch (scenario.offlineRetrievalMode) {
        case "verified":
          return [syntheticVerifiedCandidate(scenario)];
        case "curated-fallback":
          return [];
        case "provider-rejection":
          return [{ authorityId: `invalid-${scenario.id}` }];
        case "provider-failure":
          throw new Error("Synthetic provider failure");
      }
    },
  };
}

function queryForScenario(scenario: BailStrategyEvaluationScenario): AuthorityRetrievalQuery {
  const { legalRules, authoritative } = runBailScenarioDeterministicPipeline(scenario);
  return buildBailAuthorityQuery({
    input: scenario.input,
    legalRules,
    authoritativeResult: authoritative,
    custodyDays: scenario.execution.custodyDays,
    chargesheetFiled: scenario.execution.chargesheetFiled,
  });
}

async function retrieveOffline(
  scenario: BailStrategyEvaluationScenario,
  query: AuthorityRetrievalQuery,
): Promise<BailRetrievalEvaluationTrace> {
  const rejectedProviderCandidates: unknown[] = [];
  let providerFailed = false;
  const verifiedAuthorities = await retrieveVerifiedAuthorities(
    createOfflineSource(scenario),
    query,
    (_errors, candidate) => rejectedProviderCandidates.push(candidate),
    () => {
      providerFailed = true;
    },
  );
  const curatedAuthorities = verifiedAuthorities.length > 0
    ? []
    : await retrieveAuthoritiesSafely({
      async retrieve() {
        return [syntheticCuratedAuthority(scenario)];
      },
    }, query);

  return {
    verifiedAuthorities,
    curatedAuthorities,
    selectedAuthorities: selectVerifiedOrCuratedAuthorities(verifiedAuthorities, curatedAuthorities),
    rejectedProviderCandidates,
    providerFailed,
  };
}

/** Evaluate one scenario using only synthetic offline retrieval doubles. */
export async function evaluateBailRetrievalScenario(
  scenario: BailStrategyEvaluationScenario,
): Promise<BailRetrievalEvaluationResult> {
  const query = queryForScenario(scenario);
  const trace = await retrieveOffline(scenario, query);
  const expectedIssues = [...scenario.expectedRetrievalIssues];
  const matchedIssues = expectedIssues.filter((issue) => hasIssueOverlap(query, issue));
  const missingIssues = expectedIssues.filter((issue) => !matchedIssues.includes(issue));
  const selectedAuthorities = trace.selectedAuthorities;
  const irrelevantAuthorityCount = selectedAuthorities.filter(
    (authority) => !authorityMatchesExpectedIssue(authority, expectedIssues),
  ).length;
  const failureReasons: string[] = [];
  const expectedFallback = scenario.offlineRetrievalMode !== "verified";
  const fallbackOccurred = trace.verifiedAuthorities.length === 0 && trace.curatedAuthorities.length > 0;

  if (missingIssues.length > 0) failureReasons.push("query is missing expected retrieval issues");
  const provenanceValid = provenanceIsValid(selectedAuthorities);
  if (!provenanceValid) {
    failureReasons.push("verified result has invalid provenance");
  }
  if (expectedFallback !== fallbackOccurred) failureReasons.push("fallback state did not match offline retrieval mode");
  if (scenario.offlineRetrievalMode === "provider-rejection" && trace.rejectedProviderCandidates.length === 0) {
    failureReasons.push("invalid provider candidate was not rejected");
  }
  if (scenario.offlineRetrievalMode === "provider-failure" && !trace.providerFailed) {
    failureReasons.push("provider failure was not recorded");
  }
  if (irrelevantAuthorityCount > 0) failureReasons.push("irrelevant authority was selected");

  return {
    scenarioId: scenario.id,
    expectedIssues,
    matchedIssues,
    missingIssues,
    queryIssueOverlap: expectedIssues.length === 0 ? 1 : matchedIssues.length / expectedIssues.length,
    verifiedAuthorityRetrieved: trace.verifiedAuthorities.length > 0,
    curatedFallbackOccurred: fallbackOccurred,
    providerRejectionCount: trace.rejectedProviderCandidates.length,
    providerFailed: trace.providerFailed,
    provenanceValid,
    irrelevantAuthorityCount,
    invalidAuthorityRejected: trace.rejectedProviderCandidates.length > 0,
    passed: failureReasons.length === 0,
    failureReasons,
  };
}

/** Run the offline retrieval-quality foundation across all shared scenarios. */
export async function evaluateAllBailRetrievalScenarios(
  scenarios: readonly BailStrategyEvaluationScenario[] = bailStrategyScenarios,
): Promise<BailRetrievalEvaluationSummary> {
  const results = await Promise.all(scenarios.map(evaluateBailRetrievalScenario));
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
