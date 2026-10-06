import "dotenv/config";

import {
  retrieveAuthoritiesSafely,
  retrieveVerifiedAuthorities,
  selectVerifiedOrCuratedAuthorities,
  validateVerifiedAuthority,
  type VerifiedAuthoritySource,
} from "../authority-retrieval";
import {
  MAX_BAIL_AUTHORITY_CASE_DETAIL_REQUESTS_PER_SCENARIO,
  MAX_BAIL_AUTHORITY_QUERY_VARIANTS,
  buildOptimizedProgressiveBailAuthorityQueries,
} from "../authority-retrieval";
import { EcourtsIndiaAuthorityProvider } from "../ecourtsindia-authority-provider";
import { curatedAuthorityRetriever } from "../curated-authority-retriever";
import {
  buildBailRetrievalEvaluationQuery,
} from "./bail-retrieval-evaluation";
import { bailStrategyScenarios } from "./bail-scenarios";
import type { BailStrategyEvaluationScenario } from "./bail-scenarios";

export const CONTROLLED_ECOURTS_SCENARIO_IDS = [
  "standard-non-bailable",
  "default-bail",
  "ndps-commercial-quantity",
] as const;

export type EcourtsEvaluationMode = "offline" | "live";

export type EcourtsScenarioReport = {
  scenarioId: string;
  queryAttempts: number;
  zeroResultQueries: number;
  usableCandidates: number;
  verifiedAuthorities: number;
  successfulQueryVariant?: number;
  fallbackUsed: boolean;
};

export type EcourtsProviderEvaluationMetrics = {
  mode: EcourtsEvaluationMode;
  scenarioCount: number;
  searchRequestCount: number;
  caseDetailRequestCount: number;
  totalProviderCalls: number;
  usableCandidateCount: number;
  verifiedAuthorityCount: number;
  validationRejectionCount: number;
  validationFailureCategories: string[];
  fallbackUsed: boolean;
  providerFailure: boolean;
  timeoutDetected: boolean;
  latencyMs: number;
  networkCalls: number;
  scenarioReports: EcourtsScenarioReport[];
};

type RequestCounters = {
  searchRequestCount: number;
  caseDetailRequestCount: number;
  totalProviderCalls: number;
};

function controlledScenarios(): BailStrategyEvaluationScenario[] {
  return CONTROLLED_ECOURTS_SCENARIO_IDS.map((id) => {
    const scenario = bailStrategyScenarios.find((candidate) => candidate.id === id);
    if (!scenario) throw new Error(`Missing controlled scenario: ${id}`);
    return scenario;
  });
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  return [candidate.name, candidate.code, candidate.message]
    .some((value) => typeof value === "string" && /timeout|timed out|abort/i.test(value));
}

function validationCategory(errors: string[]): string {
  if (errors.some((error) => /judgmentUrl|URL/i.test(error))) return "invalid-url";
  if (errors.some((error) => /required/i.test(error))) return "missing-required-metadata";
  return "invalid-authority-record";
}

function instrumentedFetch(counters: RequestCounters): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const pathname = new URL(url).pathname;
    counters.totalProviderCalls += 1;
    if (pathname === "/api/partner/search") counters.searchRequestCount += 1;
    if (/^\/api\/partner\/case\/[^/]+$/.test(pathname)) counters.caseDetailRequestCount += 1;
    return fetch(input, init);
  };
}

function offlineMetrics(): EcourtsProviderEvaluationMetrics {
  return {
    mode: "offline",
    scenarioCount: CONTROLLED_ECOURTS_SCENARIO_IDS.length,
    searchRequestCount: 0,
    caseDetailRequestCount: 0,
    totalProviderCalls: 0,
    usableCandidateCount: 0,
    verifiedAuthorityCount: 0,
    validationRejectionCount: 0,
    validationFailureCategories: [],
    fallbackUsed: false,
    providerFailure: false,
    timeoutDetected: false,
    latencyMs: 0,
    networkCalls: 0,
    scenarioReports: [],
  };
}

/**
 * Measures a bounded real-provider subset. Offline is the default and performs
 * no provider invocation; live mode is intentionally explicit and API-key gated.
 */
export async function evaluateControlledEcourtsIndiaRetrieval(
  mode: EcourtsEvaluationMode = "offline",
): Promise<EcourtsProviderEvaluationMetrics> {
  if (mode === "offline") return offlineMetrics();
  if (!process.env.ECOURTSINDIA_API_KEY?.trim()) {
    throw new Error("Live eCourtsIndia evaluation requires explicit API-key configuration.");
  }

  const counters: RequestCounters = {
    searchRequestCount: 0,
    caseDetailRequestCount: 0,
    totalProviderCalls: 0,
  };
  const rejectionCategories = new Set<string>();
  let usableCandidateCount = 0;
  let verifiedAuthorityCount = 0;
  let validationRejectionCount = 0;
  let fallbackUsed = false;
  let providerFailure = false;
  let timeoutDetected = false;
  const scenarioReports: EcourtsScenarioReport[] = [];
  const startedAt = Date.now();

  const provider = new EcourtsIndiaAuthorityProvider(instrumentedFetch(counters));

  for (const scenario of controlledScenarios()) {
    const baseQuery = buildBailRetrievalEvaluationQuery(scenario);
    const queries = buildOptimizedProgressiveBailAuthorityQueries(baseQuery);
    const report: EcourtsScenarioReport = {
      scenarioId: scenario.id,
      queryAttempts: 0,
      zeroResultQueries: 0,
      usableCandidates: 0,
      verifiedAuthorities: 0,
      fallbackUsed: false,
    };
    let verified: Awaited<ReturnType<typeof retrieveVerifiedAuthorities>> = [];

    for (const query of queries.slice(0, MAX_BAIL_AUTHORITY_QUERY_VARIANTS)) {
      report.queryAttempts += 1;
      let rawCandidates: unknown[] = [];
      try {
        rawCandidates = await provider.retrieve(query);
        report.usableCandidates += rawCandidates.length;
        usableCandidateCount += rawCandidates.length;
      } catch (error) {
        providerFailure = true;
        timeoutDetected ||= isTimeout(error);
        break;
      }

      if (rawCandidates.length === 0) report.zeroResultQueries += 1;
      const source: VerifiedAuthoritySource = { async retrieve() { return rawCandidates; } };
      verified = await retrieveVerifiedAuthorities(
        source,
        query,
        (errors) => {
          validationRejectionCount += 1;
          rejectionCategories.add(validationCategory(errors));
        },
        () => { providerFailure = true; },
      );
      if (verified.length > 0) break;
    }

    verifiedAuthorityCount += verified.length;
    report.verifiedAuthorities = verified.length;
    if (verified.length > 0) report.successfulQueryVariant = report.queryAttempts;
    const curated = verified.length === 0
      ? await retrieveAuthoritiesSafely(curatedAuthorityRetriever, baseQuery)
      : [];
    const selected = selectVerifiedOrCuratedAuthorities(verified, curated);
    report.fallbackUsed = verified.length === 0 && selected.some((authority) => authority.provenance === "curated");
    fallbackUsed ||= report.fallbackUsed;
    scenarioReports.push(report);
  }

  return {
    mode: "live",
    scenarioCount: CONTROLLED_ECOURTS_SCENARIO_IDS.length,
    searchRequestCount: counters.searchRequestCount,
    caseDetailRequestCount: counters.caseDetailRequestCount,
    totalProviderCalls: counters.totalProviderCalls,
    usableCandidateCount,
    verifiedAuthorityCount,
    validationRejectionCount,
    validationFailureCategories: [...rejectionCategories].sort(),
    fallbackUsed,
    providerFailure,
    timeoutDetected,
    latencyMs: Date.now() - startedAt,
    networkCalls: counters.totalProviderCalls,
    scenarioReports,
  };
}

export function assertBoundedEcourtsMetrics(metrics: EcourtsProviderEvaluationMetrics): void {
  if (metrics.searchRequestCount > metrics.scenarioCount * MAX_BAIL_AUTHORITY_QUERY_VARIANTS) {
    throw new Error("eCourtsIndia search request bound exceeded");
  }
  if (metrics.caseDetailRequestCount > metrics.scenarioCount * MAX_BAIL_AUTHORITY_CASE_DETAIL_REQUESTS_PER_SCENARIO) {
    throw new Error("eCourtsIndia detail request bound exceeded");
  }
  if (metrics.totalProviderCalls !== metrics.searchRequestCount + metrics.caseDetailRequestCount) {
    throw new Error("eCourtsIndia provider call accounting mismatch");
  }
}

export function validateSyntheticProvenanceBoundary(): boolean {
  const invalid = validateVerifiedAuthority({ authorityId: "synthetic-invalid-record" });
  return !invalid.ok;
}
