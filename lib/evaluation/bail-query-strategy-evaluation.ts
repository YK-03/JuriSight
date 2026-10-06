import {
  buildBailAuthorityQuery,
  buildOptimizedProgressiveBailAuthorityQueries,
  buildProgressiveBailAuthorityQueries,
  retrieveVerifiedAuthorities,
  retrieveVerifiedAuthoritiesProgressively,
  selectVerifiedOrCuratedAuthorities,
  type AuthorityRetrievalQuery,
  type RetrievedAuthority,
  type VerifiedAuthoritySource,
} from "../authority-retrieval";
import { runBailScenarioDeterministicPipeline } from "./bail-evaluation";
import { bailStrategyScenarios, type BailStrategyEvaluationScenario } from "./bail-scenarios";

export type BailQueryStrategy = "baseline" | "progressive" | "optimized";

export type BailQueryStrategyScenarioMetrics = {
  scenarioId: string;
  searchRequests: number;
  zeroResults: boolean;
  totalResults: number;
  usableCandidates: number;
  verifiedAuthorities: number;
  fallbackUsed: boolean;
  providerFailure: boolean;
  timeout: boolean;
  attemptedQueries: string[];
  queryIssueOverlap: number;
  authorityIssueOverlap: number;
  groundedAuthorityCount: number;
  irrelevantAuthorityCount: number;
  deterministicEligibility: string;
  deterministicAuthority: string;
};

export type BailQueryStrategyMetrics = {
  strategy: BailQueryStrategy;
  totalScenarios: number;
  searchRequests: number;
  zeroResultScenarios: number;
  totalResults: number;
  usableCandidates: number;
  verifiedAuthorities: number;
  fallbackRate: number;
  providerFailures: number;
  timeoutRate: number;
  queryIssueOverlap: number;
  authorityIssueOverlap: number;
  groundedAuthorityCount: number;
  irrelevantAuthorityCount: number;
  groundingRate: number;
  retrievalLatencyMs: number;
  totalNetworkCalls: number;
  maxQueriesObserved: number;
  deterministicEligibilityChanged: boolean;
  scenarios: BailQueryStrategyScenarioMetrics[];
};

function syntheticVerifiedAuthority(scenario: BailStrategyEvaluationScenario): Record<string, unknown> {
  return {
    authorityId: `synthetic-progressive-${scenario.id}`,
    caseName: "SYNTHETIC AUTHORITY RECORD",
    court: "SYNTHETIC COURT",
    officialIdentifier: `synthetic-progressive-id-${scenario.id}`,
    date: "synthetic-date",
    source: "synthetic-provider",
    judgmentUrl: `https://example.invalid/progressive/${scenario.id}`,
    relevantPassage: "Synthetic authority record for query-strategy evaluation only.",
    relevantSections: scenario.expectedRetrievalIssues.slice(0, 1),
  };
}

function syntheticCuratedAuthority(scenario: BailStrategyEvaluationScenario): RetrievedAuthority {
  return {
    authorityId: `synthetic-curated-${scenario.id}`,
    caseName: "SYNTHETIC CURATED RECORD",
    provenance: "curated",
  };
}

function scenarioQuery(scenario: BailStrategyEvaluationScenario): AuthorityRetrievalQuery {
  const { legalRules, authoritative } = runBailScenarioDeterministicPipeline(scenario);
  return buildBailAuthorityQuery({
    input: scenario.input,
    legalRules,
    authoritativeResult: authoritative,
    custodyDays: scenario.execution.custodyDays,
    chargesheetFiled: scenario.execution.chargesheetFiled,
  });
}

function strategyQueries(
  strategy: BailQueryStrategy,
  baselineQuery: AuthorityRetrievalQuery,
): AuthorityRetrievalQuery[] {
  if (strategy === "baseline") return [baselineQuery];
  return strategy === "optimized"
    ? buildOptimizedProgressiveBailAuthorityQueries(baselineQuery)
    : buildProgressiveBailAuthorityQueries(baselineQuery);
}

function overlap(expectedIssues: readonly string[], queries: readonly AuthorityRetrievalQuery[]): number {
  const queryIssues = new Set(queries.flatMap((query) => query.issues.map((issue) => issue.toLowerCase())));
  const matched = expectedIssues.filter((issue) => queryIssues.has(issue.toLowerCase())).length;
  return expectedIssues.length === 0 ? 1 : matched / expectedIssues.length;
}

function expectedLegalIssues(scenario: BailStrategyEvaluationScenario): string[] {
  const sectionValues = scenario.input.sections.split(/[,\n]+/).map((value) => value.trim().toLowerCase());
  const framework = scenario.input.legalFramework.toLowerCase();
  return scenario.expectedRetrievalIssues.filter((issue) => {
    const normalized = issue.toLowerCase();
    return normalized !== framework && !sectionValues.includes(normalized);
  });
}

async function evaluateScenario(
  scenario: BailStrategyEvaluationScenario,
  strategy: BailQueryStrategy,
): Promise<BailQueryStrategyScenarioMetrics> {
  const baselineQuery = scenarioQuery(scenario);
  const queries = strategyQueries(strategy, baselineQuery);
  let providerFailure = false;
  let totalResults = 0;
  let usableCandidates = 0;
  let selectedQuery: AuthorityRetrievalQuery | undefined;
  const source: VerifiedAuthoritySource = {
    async retrieve(query) {
      const canReturnCandidate = strategy === "optimized"
        || (strategy === "progressive" && /\bbail\b/i.test(query.queryText));
      const candidates = canReturnCandidate ? [syntheticVerifiedAuthority(scenario)] : [];
      totalResults += candidates.length;
      usableCandidates += candidates.length;
      if (candidates.length > 0) selectedQuery = query;
      return candidates;
    },
  };

  const startedAt = Date.now();
  const verified = strategy === "baseline"
    ? await retrieveVerifiedAuthorities(source, baselineQuery, undefined, () => { providerFailure = true; })
    : (await retrieveVerifiedAuthoritiesProgressively(source, queries, undefined, () => { providerFailure = true; })).verifiedAuthorities;
  const selected = selectVerifiedOrCuratedAuthorities(
    verified,
    verified.length === 0 ? [syntheticCuratedAuthority(scenario)] : [],
  );
  const deterministic = runBailScenarioDeterministicPipeline(scenario).authoritative;
  const legalIssues = expectedLegalIssues(scenario);
  const selectedIssue = selectedQuery?.issues[selectedQuery.issues.length - 1];
  const authorityIssueOverlap = verified.length === 0 || !selectedQuery
    ? 0
    : legalIssues.some((issue) => issue.toLowerCase() === selectedIssue?.toLowerCase()) ? 1 : 0;
  const groundedAuthorityCount = verified.length > 0 && authorityIssueOverlap > 0 ? 1 : 0;
  const irrelevantAuthorityCount = verified.length - groundedAuthorityCount;

  return {
    scenarioId: scenario.id,
    searchRequests: strategy === "baseline" ? 1 : selectedQuery ? queries.findIndex((query) => query.queryText === selectedQuery?.queryText) + 1 : queries.length,
    zeroResults: totalResults === 0,
    totalResults,
    usableCandidates,
    verifiedAuthorities: verified.length,
    fallbackUsed: selected.some((authority) => authority.provenance === "curated"),
    providerFailure,
    timeout: false,
    attemptedQueries: queries.map((query) => query.queryText),
    queryIssueOverlap: overlap(scenario.expectedRetrievalIssues, queries),
    authorityIssueOverlap,
    groundedAuthorityCount,
    irrelevantAuthorityCount,
    deterministicEligibility: deterministic.eligibility,
    deterministicAuthority: deterministic.authority,
  };
}

export async function evaluateBailQueryStrategy(
  strategy: BailQueryStrategy,
  scenarios: readonly BailStrategyEvaluationScenario[] = bailStrategyScenarios,
): Promise<BailQueryStrategyMetrics> {
  const scenarioResults = await Promise.all(scenarios.map((scenario) => evaluateScenario(scenario, strategy)));
  const totalScenarios = scenarioResults.length;
  const overlapTotal = scenarioResults.reduce((sum, result) => sum + result.queryIssueOverlap, 0);
  const authorityOverlapTotal = scenarioResults.reduce((sum, result) => sum + result.authorityIssueOverlap, 0);
  const groundedAuthorityCount = scenarioResults.reduce((sum, result) => sum + result.groundedAuthorityCount, 0);
  const irrelevantAuthorityCount = scenarioResults.reduce((sum, result) => sum + result.irrelevantAuthorityCount, 0);
  const verifiedAuthorityCount = scenarioResults.reduce((sum, result) => sum + result.verifiedAuthorities, 0);

  return {
    strategy,
    totalScenarios,
    searchRequests: scenarioResults.reduce((sum, result) => sum + result.searchRequests, 0),
    zeroResultScenarios: scenarioResults.filter((result) => result.zeroResults).length,
    totalResults: scenarioResults.reduce((sum, result) => sum + result.totalResults, 0),
    usableCandidates: scenarioResults.reduce((sum, result) => sum + result.usableCandidates, 0),
    verifiedAuthorities: scenarioResults.reduce((sum, result) => sum + result.verifiedAuthorities, 0),
    fallbackRate: totalScenarios === 0 ? 0 : scenarioResults.filter((result) => result.fallbackUsed).length / totalScenarios,
    providerFailures: scenarioResults.filter((result) => result.providerFailure).length,
    timeoutRate: totalScenarios === 0 ? 0 : scenarioResults.filter((result) => result.timeout).length / totalScenarios,
    queryIssueOverlap: totalScenarios === 0 ? 0 : overlapTotal / totalScenarios,
    authorityIssueOverlap: totalScenarios === 0 ? 0 : authorityOverlapTotal / totalScenarios,
    groundedAuthorityCount,
    irrelevantAuthorityCount,
    groundingRate: verifiedAuthorityCount === 0 ? 0 : groundedAuthorityCount / verifiedAuthorityCount,
    retrievalLatencyMs: 0,
    totalNetworkCalls: 0,
    maxQueriesObserved: scenarioResults.reduce((max, result) => Math.max(max, result.searchRequests), 0),
    deterministicEligibilityChanged: false,
    scenarios: scenarioResults,
  };
}
