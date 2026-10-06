import {
  assertBoundedEcourtsMetrics,
  evaluateControlledEcourtsIndiaRetrieval,
} from "../lib/evaluation/ecourtsindia-retrieval-evaluation";

const live = process.argv.includes("--live");

async function main() {
  const metrics = await evaluateControlledEcourtsIndiaRetrieval(live ? "live" : "offline");
  assertBoundedEcourtsMetrics(metrics);

  console.log("JuriSight eCourtsIndia Retrieval Evaluation");
  console.log(`Mode: ${metrics.mode}`);
  console.log(`Scenarios: ${metrics.scenarioCount}`);
  console.log(`Search requests: ${metrics.searchRequestCount}`);
  console.log(`Case-detail requests: ${metrics.caseDetailRequestCount}`);
  console.log(`Total provider calls: ${metrics.totalProviderCalls}`);
  console.log(`Usable candidates: ${metrics.usableCandidateCount}`);
  console.log(`Verified authorities: ${metrics.verifiedAuthorityCount}`);
  console.log(`Validation rejections: ${metrics.validationRejectionCount}`);
  console.log(`Fallback used: ${metrics.fallbackUsed ? "yes" : "no"}`);
  console.log(`Provider failure: ${metrics.providerFailure ? "yes" : "no"}`);
  console.log(`Timeout detected: ${metrics.timeoutDetected ? "yes" : "no"}`);
  console.log(`Retrieval latency: ${metrics.latencyMs} ms`);
  console.log(`Network/API calls: ${metrics.networkCalls}`);
  if (metrics.validationFailureCategories.length > 0) {
    console.log(`Validation failure categories: ${metrics.validationFailureCategories.join(", ")}`);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "eCourtsIndia evaluation failed");
  process.exitCode = 1;
});
