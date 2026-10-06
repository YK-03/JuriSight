import {
  buildOptimizedProgressiveBailAuthorityQueries,
  retrieveAuthoritiesSafely,
  retrieveVerifiedAuthorities,
  selectVerifiedOrCuratedAuthorities,
  type AuthorityRetrievalQuery,
  type RetrievedAuthority,
  type VerifiedAuthority,
  type VerifiedAuthoritySource,
} from "../authority-retrieval";
import {
  buildBailRetrievalEvaluationQuery,
} from "./bail-retrieval-evaluation";
import { runBailScenarioDeterministicPipeline } from "./bail-evaluation";
import {
  bailStrategyScenarios,
  type BailStrategyEvaluationScenario,
} from "./bail-scenarios";

export type BailRetrievalRelevanceScenarioResult = {
  scenarioId: string;
  queryIssueOverlap: number;
  authorityIssueOverlap: number;
  verifiedAuthorityCount: number;
  irrelevantAuthorityCount: number;
  groundedAuthorityCount: number;
  fallbackUsed: boolean;
  invalidAuthorityRejected: boolean;
  provenanceValid: boolean;
  expectedEligibility: string;
  actualEligibility: string;
  expectedAuthority: string;
  actualAuthority: string;
  passed: boolean;
  failureReasons: string[];
};

export type BailRetrievalRelevanceSummary = {
  results: BailRetrievalRelevanceScenarioResult[];
  total: number;
  verifiedAuthorityCount: number;
  irrelevantAuthorityCount: number;
  groundedAuthorityCount: number;
  fallbackScenarios: number;
  queryIssueOverlap: number;
  authorityIssueOverlap: number;
  groundingRate: number;
  overallPassed: boolean;
};

type SyntheticAuthorityFixture = {
  candidate: unknown;
  issueHints: readonly string[];
};

type RelevanceTrace = {
  verifiedAuthorities: VerifiedAuthority[];
  selectedAuthorities: RetrievedAuthority[];
  rejectedCount: number;
  providerFailed: boolean;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function overlaps(values: readonly string[], expected: readonly string[]): boolean {
  const normalizedValues = new Set(values.map(normalize));
  return expected.some((value) => normalizedValues.has(normalize(value)));
}

function syntheticVerifiedCandidate(
  scenario: BailStrategyEvaluationScenario,
  suffix: string,
  relevantSections: string[],
): unknown {
  return {
    authorityId: `synthetic-relevance-${suffix}-${scenario.id}`,
    caseName: "SYNTHETIC AUTHORITY RECORD",
    court: "SYNTHETIC COURT",
    officialIdentifier: `synthetic-identifier-${suffix}-${scenario.id}`,
    date: "synthetic-date",
    source: "synthetic-provider",
    judgmentUrl: `https://example.invalid/relevance/${suffix}/${scenario.id}`,
    relevantPassage: "Synthetic relevance fixture only.",
    relevantSections,
  };
}

function syntheticFixtures(scenario: BailStrategyEvaluationScenario): {
  relevant: SyntheticAuthorityFixture;
  irrelevant: SyntheticAuthorityFixture;
  invalid: SyntheticAuthorityFixture;
} {
  const section = scenario.input.sections.split(/[,\n]+/).map((value) => value.trim()).filter(Boolean)[0] || "synthetic-section";
  const issue = scenario.expectedRetrievalIssues[scenario.expectedRetrievalIssues.length - 1] || "bail";

  return {
    relevant: {
      candidate: syntheticVerifiedCandidate(scenario, "relevant", [section]),
      issueHints: [issue],
    },
    irrelevant: {
      candidate: syntheticVerifiedCandidate(scenario, "irrelevant", ["UNRELATED SYNTHETIC SECTION"]),
      issueHints: ["unrelated synthetic issue"],
    },
    invalid: {
      candidate: { authorityId: `synthetic-invalid-${scenario.id}` },
      issueHints: [],
    },
  };
}

function createOfflineSource(
  scenario: BailStrategyEvaluationScenario,
): VerifiedAuthoritySource {
  const fixtures = syntheticFixtures(scenario);
  return {
    async retrieve() {
      switch (scenario.offlineRetrievalMode) {
        case "verified":
          return [fixtures.relevant.candidate, fixtures.irrelevant.candidate, fixtures.invalid.candidate];
        case "provider-rejection":
          return [fixtures.invalid.candidate];
        case "curated-fallback":
          return [];
        case "provider-failure":
          throw new Error("Synthetic provider failure");
      }
    },
  };
}

function syntheticCuratedAuthority(scenario: BailStrategyEvaluationScenario): RetrievedAuthority {
  return {
    authorityId: `synthetic-curated-${scenario.id}`,
    caseName: "SYNTHETIC CURATED RECORD",
    derived: { matchedIssues: [scenario.expectedRetrievalIssues[0] || "bail"] },
    provenance: "curated",
  };
}

async function retrieveOffline(
  scenario: BailStrategyEvaluationScenario,
  query: AuthorityRetrievalQuery,
): Promise<RelevanceTrace> {
  let rejectedCount = 0;
  let providerFailed = false;
  const verifiedAuthorities = await retrieveVerifiedAuthorities(
    createOfflineSource(scenario),
    query,
    () => { rejectedCount += 1; },
    () => { providerFailed = true; },
  );
  const curatedAuthorities = verifiedAuthorities.length > 0
    ? []
    : await retrieveAuthoritiesSafely({
      async retrieve() { return [syntheticCuratedAuthority(scenario)]; },
    }, query);

  return {
    verifiedAuthorities,
    selectedAuthorities: selectVerifiedOrCuratedAuthorities(verifiedAuthorities, curatedAuthorities),
    rejectedCount,
    providerFailed,
  };
}

function authorityIssueHints(authority: VerifiedAuthority, scenario: BailStrategyEvaluationScenario): string[] {
  if (authority.authorityId.includes("irrelevant")) return ["unrelated synthetic issue"];
  if (authority.authorityId.includes("relevant")) {
    return [scenario.expectedRetrievalIssues[scenario.expectedRetrievalIssues.length - 1] || "bail"];
  }
  return [];
}

/**
 * Offline relevance evaluation only. It measures the deterministic baseline
 * and the verified-provider boundary; it does not evaluate Groq or live RAG.
 */
export async function evaluateBailRetrievalRelevanceScenario(
  scenario: BailStrategyEvaluationScenario,
): Promise<BailRetrievalRelevanceScenarioResult> {
  const baseQuery = buildBailRetrievalEvaluationQuery(scenario);
  const queryVariants = buildOptimizedProgressiveBailAuthorityQueries(baseQuery);
  const expectedIssues = [...scenario.expectedRetrievalIssues];
  const queryIssueMatches = expectedIssues.filter((issue) =>
    queryVariants.some((query) => overlaps(query.issues, [issue])),
  );
  const trace = await retrieveOffline(scenario, baseQuery);
  const sectionValues = scenario.input.sections.split(/[,\n]+/).map((value) => value.trim()).filter(Boolean);
  const verifiedWithIssue = trace.verifiedAuthorities.filter((authority) =>
    overlaps(authorityIssueHints(authority, scenario), expectedIssues),
  );
  const groundedAuthorities = trace.verifiedAuthorities.filter((authority) =>
    overlaps(authority.relevantSections || [], sectionValues)
      && overlaps(authorityIssueHints(authority, scenario), expectedIssues),
  );
  const irrelevantAuthorityCount = trace.verifiedAuthorities.length - groundedAuthorities.length;
  const { authoritative } = runBailScenarioDeterministicPipeline(scenario);
  const failureReasons: string[] = [];
  if (scenario.offlineRetrievalMode === "verified" && groundedAuthorities.length !== 1) {
    failureReasons.push("relevant verified authority was not grounded exactly once");
  }
  if (scenario.offlineRetrievalMode === "verified" && irrelevantAuthorityCount !== 1) {
    failureReasons.push("irrelevant verified authority was not isolated");
  }
  if (scenario.offlineRetrievalMode !== "verified" && !trace.selectedAuthorities.some((authority) => authority.provenance === "curated")) {
    failureReasons.push("curated fallback was not selected");
  }
  if (trace.rejectedCount === 0 && scenario.offlineRetrievalMode !== "curated-fallback" && scenario.offlineRetrievalMode !== "provider-failure") {
    failureReasons.push("invalid provider authority was not rejected");
  }
  const provenanceValid = trace.selectedAuthorities.every((authority) =>
    authority.provenance === "verified" || authority.provenance === "curated",
  );
  if (!provenanceValid) failureReasons.push("selected authority provenance is invalid");
  if (authoritative.eligibility !== scenario.expected.eligibility) failureReasons.push("deterministic eligibility changed");
  if (authoritative.authority !== scenario.expected.authority) failureReasons.push("deterministic authority changed");

  return {
    scenarioId: scenario.id,
    queryIssueOverlap: expectedIssues.length === 0 ? 1 : queryIssueMatches.length / expectedIssues.length,
    authorityIssueOverlap: trace.verifiedAuthorities.length === 0 ? 0 : verifiedWithIssue.length / trace.verifiedAuthorities.length,
    verifiedAuthorityCount: trace.verifiedAuthorities.length,
    irrelevantAuthorityCount,
    groundedAuthorityCount: groundedAuthorities.length,
    fallbackUsed: trace.selectedAuthorities.some((authority) => authority.provenance === "curated"),
    invalidAuthorityRejected: trace.rejectedCount > 0,
    provenanceValid,
    expectedEligibility: scenario.expected.eligibility,
    actualEligibility: authoritative.eligibility,
    expectedAuthority: scenario.expected.authority,
    actualAuthority: authoritative.authority,
    passed: failureReasons.length === 0,
    failureReasons,
  };
}

export async function evaluateAllBailRetrievalRelevance(
  scenarios: readonly BailStrategyEvaluationScenario[] = bailStrategyScenarios,
): Promise<BailRetrievalRelevanceSummary> {
  const results = await Promise.all(scenarios.map(evaluateBailRetrievalRelevanceScenario));
  const verifiedAuthorityCount = results.reduce((sum, result) => sum + result.verifiedAuthorityCount, 0);
  const irrelevantAuthorityCount = results.reduce((sum, result) => sum + result.irrelevantAuthorityCount, 0);
  const groundedAuthorityCount = results.reduce((sum, result) => sum + result.groundedAuthorityCount, 0);
  const queryIssueOverlap = results.length === 0 ? 0 : results.reduce((sum, result) => sum + result.queryIssueOverlap, 0) / results.length;
  const authorityIssueOverlap = verifiedAuthorityCount === 0
    ? 0
    : results.reduce((sum, result) => sum + result.authorityIssueOverlap * result.verifiedAuthorityCount, 0) / verifiedAuthorityCount;

  return {
    results,
    total: results.length,
    verifiedAuthorityCount,
    irrelevantAuthorityCount,
    groundedAuthorityCount,
    fallbackScenarios: results.filter((result) => result.fallbackUsed).length,
    queryIssueOverlap,
    authorityIssueOverlap,
    groundingRate: verifiedAuthorityCount === 0 ? 0 : groundedAuthorityCount / verifiedAuthorityCount,
    overallPassed: results.every((result) => result.passed),
  };
}
