import { evaluateAllBailRetrievalRelevance } from "../lib/evaluation/bail-retrieval-relevance-evaluation";

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function main() {
  const summary = await evaluateAllBailRetrievalRelevance();
  console.log("JuriSight Bail Retrieval Relevance Evaluation");
  console.log("");
  console.log(`Scenarios: ${summary.total}`);
  console.log(`Verified authorities: ${summary.verifiedAuthorityCount}`);
  console.log(`Grounded authorities: ${summary.groundedAuthorityCount}`);
  console.log(`Irrelevant authorities: ${summary.irrelevantAuthorityCount}`);
  console.log(`Fallback scenarios: ${summary.fallbackScenarios}`);
  console.log("");
  console.log(`Query issue overlap: ${percent(summary.queryIssueOverlap)}`);
  console.log(`Authority issue overlap: ${percent(summary.authorityIssueOverlap)}`);
  console.log(`Grounding rate: ${percent(summary.groundingRate)}`);
  console.log("");
  console.log(`Overall: ${summary.overallPassed ? "PASS" : "FAIL"}`);
  if (!summary.overallPassed) {
    for (const result of summary.results.filter((item) => !item.passed)) {
      console.log(`${result.scenarioId}: ${result.failureReasons.join("; ")}`);
    }
    process.exitCode = 1;
  }
}

void main();
