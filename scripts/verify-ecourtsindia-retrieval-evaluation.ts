import assert from "node:assert/strict";
import {
  retrieveVerifiedAuthorities,
  type AuthorityRetrievalQuery,
} from "../lib/authority-retrieval";
import {
  assertBoundedEcourtsMetrics,
  evaluateControlledEcourtsIndiaRetrieval,
  validateSyntheticProvenanceBoundary,
} from "../lib/evaluation/ecourtsindia-retrieval-evaluation";

function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`PASS: ${label}`);
}

async function main() {
  const offline = await evaluateControlledEcourtsIndiaRetrieval();
  assertBoundedEcourtsMetrics(offline);
  check("Default mode is offline", offline.mode === "offline");
  check("Default mode makes zero network calls", offline.networkCalls === 0 && offline.totalProviderCalls === 0);
  check("Live mode is not implicit", !process.argv.includes("--live"));
  check("Controlled scenario subset is bounded", offline.scenarioCount >= 1 && offline.scenarioCount <= 3);
  check("Synthetic provenance cannot become verified", validateSyntheticProvenanceBoundary());
  const serializedMetrics = JSON.stringify(offline);
  check(
    "Bounded report excludes sensitive provider fields",
    !/caseName|petitioners|respondents|cnr|fir|relevantPassage|markdownContent|apiKey/i.test(serializedMetrics),
  );

  let providerFailureReported = false;
  const failedAuthorities = await retrieveVerifiedAuthorities(
    {
      async retrieve() {
        throw new Error("synthetic provider failure");
      },
    },
    { profile: "BAIL_ELIGIBILITY", issues: [], queryText: "" } as AuthorityRetrievalQuery,
    undefined,
    () => {
      providerFailureReported = true;
    },
  );
  check("Provider failure is non-fatal", providerFailureReported && failedAuthorities.length === 0);

  const previousKey = process.env.ECOURTSINDIA_API_KEY;
  delete process.env.ECOURTSINDIA_API_KEY;
  try {
    await assert.rejects(
      () => evaluateControlledEcourtsIndiaRetrieval("live"),
      /requires explicit API-key configuration/,
      "Live mode must require explicit opt-in configuration",
    );
    console.log("PASS: Live mode requires explicit API-key configuration");
  } finally {
    if (previousKey === undefined) delete process.env.ECOURTSINDIA_API_KEY;
    else process.env.ECOURTSINDIA_API_KEY = previousKey;
  }

  console.log("eCourtsIndia retrieval evaluation verification passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
