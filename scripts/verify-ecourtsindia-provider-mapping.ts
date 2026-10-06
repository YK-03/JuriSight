import assert from "node:assert/strict";
import { EcourtsIndiaAuthorityProvider } from "../lib/ecourtsindia-authority-provider";
import type { AuthorityRetrievalQuery } from "../lib/authority-retrieval";

function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`PASS: ${label}`);
}

async function main() {
  const requestedPaths: string[] = [];
  const provider = new EcourtsIndiaAuthorityProvider(async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    requestedPaths.push(url.pathname);

    if (url.pathname === "/api/partner/search") {
      return new Response(JSON.stringify({
        data: {
          results: [{
            cnr: "SYNTHETIC-CNR",
            courtName: "SYNTHETIC COURT",
            petitioners: ["SYNTHETIC PETITIONER"],
            respondents: ["SYNTHETIC RESPONDENT"],
            decisionDate: "synthetic-date",
          }],
          totalHits: 1,
        },
        meta: { request_id: "synthetic-request" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/partner/case/SYNTHETIC-CNR") {
      return new Response(JSON.stringify({
        data: {
          courtCaseData: {
            courtName: "SYNTHETIC COURT",
            decisionDate: "synthetic-date",
            judgmentOrders: [{ orderUrl: "synthetic-order.pdf", orderDate: "synthetic-date" }],
            files: [{ markdownContent: "Synthetic provider passage for mapping verification." }],
          },
        },
        meta: { request_id: "synthetic-detail-request" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    throw new Error(`Unexpected synthetic provider path: ${url.pathname}`);
  });

  const query: AuthorityRetrievalQuery = {
    profile: "BAIL_ELIGIBILITY",
    sections: ["IPC 420"],
    issues: ["IPC 420"],
    queryText: "IPC 420",
  };
  process.env.ECOURTSINDIA_API_KEY = "synthetic-test-key";

  try {
    const authorities = await provider.retrieve(query);
    check("Documented data.results response is mapped", authorities.length === 1);
    check("Search result CNR drives exactly one detail request", requestedPaths.filter((path) => path.includes("/case/")).length === 1);
    check("Search request count is one", requestedPaths.filter((path) => path === "/api/partner/search").length === 1);
    check("Mapped record includes a bounded provider passage", JSON.stringify(authorities).includes("Synthetic provider passage"));
    check("No order-ai or refresh endpoint is called", requestedPaths.every((path) => !/order-ai|refresh|bulk/i.test(path)));
  } finally {
    delete process.env.ECOURTSINDIA_API_KEY;
  }

  console.log("eCourtsIndia provider mapping verification passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

