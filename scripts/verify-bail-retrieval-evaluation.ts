import assert from "node:assert/strict";
import { validateVerifiedAuthority } from "../lib/authority-retrieval";
import { evaluateAllBailRetrievalScenarios } from "../lib/evaluation/bail-retrieval-evaluation";

function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`PASS: ${label}`);
}

async function main() {
  const summary = await evaluateAllBailRetrievalScenarios();

  check("All shared scenarios are evaluated", summary.total === 10);
  check("All offline retrieval scenarios pass", summary.overallPassed && summary.failed === 0);
  check(
    "Every scenario has complete query-to-issue overlap",
    summary.results.every((result) => result.queryIssueOverlap === 1),
  );
  check(
    "Selected authorities have valid provenance",
    summary.results.every((result) => result.provenanceValid),
  );
  check(
    "No irrelevant authority is selected",
    summary.results.every((result) => result.irrelevantAuthorityCount === 0),
  );

  const verified = summary.results.find((result) => result.verifiedAuthorityRetrieved);
  check("Verified-authority retrieval is measured", Boolean(verified));

  const fallback = summary.results.find((result) => result.curatedFallbackOccurred);
  check("Curated fallback is measured", Boolean(fallback));

  const rejection = summary.results.find((result) => result.providerRejectionCount > 0);
  check("Provider rejection is measured", Boolean(rejection?.invalidAuthorityRejected));

  const failure = summary.results.find((result) => result.providerFailed);
  check("Provider failure is measured", Boolean(failure?.providerFailed && failure.curatedFallbackOccurred));

  check(
    "Invalid authority metadata is rejected by the existing boundary",
    !validateVerifiedAuthority({ authorityId: "synthetic-invalid-record" }).ok,
  );

  console.log("Bail retrieval evaluation verification passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

