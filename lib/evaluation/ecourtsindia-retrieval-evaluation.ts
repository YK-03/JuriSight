import {
  retrieveAuthoritiesSafely,
  retrieveVerifiedAuthorities,
  selectVerifiedOrCuratedAuthorities,
  validateVerifiedAuthority,
  type VerifiedAuthoritySource,
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
  const startedAt = Date.now();

  const provider = new EcourtsIndiaAuthorityProvider(instrumentedFetch(counters));

  for (const scenario of controlledScenarios()) {
    const query = buildBailRetrievalEvaluationQuery(scenario);
    let rawCandidates: unknown[] = [];

    try {
      rawCandidates = await provider.retrieve(query);
      usableCandidateCount += rawCandidates.length;
    } catch (error) {
      providerFailure = true;
      timeoutDetected ||= isTimeout(error);
    }

    const source: VerifiedAuthoritySource = {
      async retrieve() {
        return rawCandidates;
      },
    };
    const verified = await retrieveVerifiedAuthorities(
      source,
      query,
      (errors) => {
        validationRejectionCount += 1;
        rejectionCategories.add(validationCategory(errors));
      },
      () => {
        providerFailure = true;
      },
    );
    verifiedAuthorityCount += verified.length;
    const curated = verified.length === 0
      ? await retrieveAuthoritiesSafely(curatedAuthorityRetriever, query)
      : [];
    const selected = selectVerifiedOrCuratedAuthorities(verified, curated);
    fallbackUsed ||= verified.length === 0 && selected.some((authority) => authority.provenance === "curated");
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
  };
}

export function assertBoundedEcourtsMetrics(metrics: EcourtsProviderEvaluationMetrics): void {
  if (metrics.searchRequestCount > metrics.scenarioCount) {
    throw new Error("eCourtsIndia search request bound exceeded");
  }
  if (metrics.caseDetailRequestCount > metrics.scenarioCount) {
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
