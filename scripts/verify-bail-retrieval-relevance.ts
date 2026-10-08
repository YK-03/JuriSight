import { evaluateAllBailRetrievalRelevance } from "../lib/evaluation/bail-retrieval-relevance-evaluation";
import { bailStrategyScenarios } from "../lib/evaluation/bail-scenarios";

function assertInvariant(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main() {
  const summary = await evaluateAllBailRetrievalRelevance();
  const relevant = summary.results.find((result) => result.scenarioId === "standard-non-bailable");
  const invalid = summary.results.find((result) => result.scenarioId === "unsupported-offence-framework");

  assertInvariant(summary.total === bailStrategyScenarios.length, "expected all shared bail scenarios");
  assertInvariant(summary.overallPassed, "relevance evaluation contains failed scenarios");
  assertInvariant(Boolean(relevant && relevant.groundedAuthorityCount === 1), "relevant authority was not grounded");
  assertInvariant(Boolean(relevant && relevant.irrelevantAuthorityCount === 1), "irrelevant authority was not classified as ungrounded");
  assertInvariant(Boolean(invalid && invalid.invalidAuthorityRejected), "invalid authority was not rejected before grounding");
  assertInvariant(summary.results.every((result) => result.actualEligibility === result.expectedEligibility), "relevance evaluation altered deterministic eligibility");
  assertInvariant(summary.results.every((result) => result.actualAuthority === result.expectedAuthority), "relevance evaluation altered deterministic authority");
  assertInvariant(summary.results.every((result) => result.provenanceValid), "provenance boundary was not preserved");

  console.log("Bail retrieval relevance verification: PASS");
}

void main().catch((error: unknown) => {
  console.error(`Bail retrieval relevance verification: FAIL (${error instanceof Error ? error.message : "unknown error"})`);
  process.exitCode = 1;
});
