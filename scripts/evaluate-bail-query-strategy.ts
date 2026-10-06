import { evaluateBailQueryStrategy } from "../lib/evaluation/bail-query-strategy-evaluation";

async function main() {
  const [baseline, progressive, optimized] = await Promise.all([
    evaluateBailQueryStrategy("baseline"),
    evaluateBailQueryStrategy("progressive"),
    evaluateBailQueryStrategy("optimized"),
  ]);

  console.log("JuriSight Bail Retrieval Query Strategy Evaluation");
  for (const metrics of [baseline, progressive, optimized]) {
    console.log(`\n${metrics.strategy.toUpperCase()}`);
    console.log(`Scenarios: ${metrics.totalScenarios}`);
    console.log(`Search requests: ${metrics.searchRequests}`);
    console.log(`Zero-result scenarios: ${metrics.zeroResultScenarios}`);
    console.log(`Total results: ${metrics.totalResults}`);
    console.log(`Usable candidates: ${metrics.usableCandidates}`);
    console.log(`Verified authorities: ${metrics.verifiedAuthorities}`);
    console.log(`Fallback rate: ${(metrics.fallbackRate * 100).toFixed(1)}%`);
    console.log(`Provider failures: ${metrics.providerFailures}`);
    console.log(`Timeout rate: ${(metrics.timeoutRate * 100).toFixed(1)}%`);
    console.log(`Query-to-issue overlap: ${(metrics.queryIssueOverlap * 100).toFixed(1)}%`);
    console.log(`Authority issue overlap: ${(metrics.authorityIssueOverlap * 100).toFixed(1)}%`);
    console.log(`Grounded authorities: ${metrics.groundedAuthorityCount}`);
    console.log(`Irrelevant authorities: ${metrics.irrelevantAuthorityCount}`);
    console.log(`Grounding rate: ${(metrics.groundingRate * 100).toFixed(1)}%`);
    console.log(`Retrieval latency: ${metrics.retrievalLatencyMs} ms`);
    console.log(`Network calls: ${metrics.totalNetworkCalls}`);
    console.log(`Max queries per scenario: ${metrics.maxQueriesObserved}`);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
