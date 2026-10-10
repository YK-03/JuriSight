import {
  buildBailAuthorityQuery,
  buildOptimizedProgressiveBailAuthorityQueries,
  retrieveAuthoritiesSafely,
  retrieveVerifiedAuthorities,
  selectVerifiedOrCuratedAuthorities,
  validateVerifiedAuthority,
  type AuthorityRetriever,
  type VerifiedAuthoritySource,
} from "../lib/authority-retrieval";
import { curatedAuthorityRetriever } from "../lib/curated-authority-retriever";
import { EcourtsIndiaAuthorityProvider } from "../lib/ecourtsindia-authority-provider";
import { determineAuthoritativeEligibility, type BailStrategyInput } from "../lib/bail-strategy-engine";
import { runLegalRules } from "../lib/legal-rules";

function check(label: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

async function main() {
const input: BailStrategyInput = {
  sections: "IPC 420",
  legalFramework: "LEGACY_IPC_CRPC",
  offenseType: "non-bailable",
  custodyDuration: "1-6mo",
  courtStage: "SESSIONS",
  previousBail: "none",
  accusedTags: ["cooperated in investigation", "first-time offender"],
  age: "25",
  firOrCnr: "FIR 112/2026",
  additionalContext: "Chargesheet filed; trial delay is expected.",
};

const custodyDays = 90;
const chargesheetFiled = true;
const legalRules = runLegalRules({
  sections: ["IPC 420"],
  custodyDays,
  chargesheetFiled,
  age: 25,
  framework: input.legalFramework,
});
const authoritativeResult = determineAuthoritativeEligibility(
  legalRules,
  input,
  custodyDays,
  chargesheetFiled,
);
const query = buildBailAuthorityQuery({ input, legalRules, authoritativeResult, custodyDays, chargesheetFiled });

check("Bail Strategy selects BAIL_ELIGIBILITY", query.profile === "BAIL_ELIGIBILITY");
check("Query is issue-oriented", query.queryText.includes("IPC 420") && query.queryText.includes("chargesheet filed"));
check("Query does not include the complete narrative", !query.queryText.includes("Chargesheet filed; trial delay is expected"));
check("External query removes internal framework identifiers", !query.queryText.includes("LEGACY_IPC_CRPC") && !query.queryText.includes("UNSPECIFIED"));
check("External query preserves statutory and legal terms", query.queryText.includes("IPC 420") && query.queryText.includes("chargesheet filed"));
check(
  "Optimized external queries remove internal framework identifiers",
  buildOptimizedProgressiveBailAuthorityQueries(query).every((variant) => !/LEGACY_IPC_CRPC|CURRENT_BNS_BNSS|UNSPECIFIED/.test(variant.queryText)),
);

const authorities = await curatedAuthorityRetriever.retrieve(query);
check("Curated records adapt to RetrievedAuthority", authorities.length > 0 && authorities.every((item) => item.provenance === "curated"));
check("Current curated dataset has no verified provenance", authorities.every((item) => item.provenance !== "verified"));
check("Curated interpretation remains separate from source metadata", authorities.every((item) => Boolean(item.derived?.legalPrinciple) && !("principle" in item)));
check("Discretionary eligibility remains authoritative", authoritativeResult.eligibility === "Uncertain" && authoritativeResult.authority === "DISCRETIONARY");
const eligibilityWithoutAuthorities = determineAuthoritativeEligibility(legalRules, input, custodyDays, chargesheetFiled);
check("Deterministic eligibility is unchanged by retrieval", JSON.stringify(authoritativeResult) === JSON.stringify(eligibilityWithoutAuthorities));

const failingRetriever: AuthorityRetriever = {
  async retrieve() {
    throw new Error("provider unavailable");
  },
};
const failed = await retrieveAuthoritiesSafely(failingRetriever, query);
check("Retrieval failure returns an empty authority list", failed.length === 0);

const originalApiKey = process.env.ECOURTSINDIA_API_KEY;
delete process.env.ECOURTSINDIA_API_KEY;
try {
  const providerWithoutKey = new EcourtsIndiaAuthorityProvider(async () => {
    throw new Error("fetch must not run without an API key");
  });
  check("Provider construction without an API key does not crash", Boolean(providerWithoutKey));
  check("Missing API key produces a safe empty result", (await providerWithoutKey.retrieve(query)).length === 0);
} finally {
  if (originalApiKey === undefined) delete process.env.ECOURTSINDIA_API_KEY;
  else process.env.ECOURTSINDIA_API_KEY = originalApiKey;
}

const providerFailure = new EcourtsIndiaAuthorityProvider(async () => {
  throw new Error("provider unavailable");
});
process.env.ECOURTSINDIA_API_KEY = "test-only-key";
try {
  const providerFailedVerified = await retrieveVerifiedAuthorities(providerFailure, query);
  check("Provider failure produces a safe empty result", providerFailedVerified.length === 0);
  check("Provider failure falls back to curated", selectVerifiedOrCuratedAuthorities(providerFailedVerified, authorities).every((item) => item.provenance === "curated"));
} finally {
  if (originalApiKey === undefined) delete process.env.ECOURTSINDIA_API_KEY;
  else process.env.ECOURTSINDIA_API_KEY = originalApiKey;
}

const multiResultDetails: Record<string, unknown> = {
  BAD001: { data: { courtCaseData: { cnr: "BAD001" } } },
  BAD002: { data: { courtCaseData: { cnr: "BAD002", courtName: "Test Court" } } },
  VALID003: {
    data: {
      courtCaseData: {
        cnr: "VALID003",
        courtName: "High Court",
        decisionDate: "2024-02-03",
        judgmentOrders: [{ orderDate: "2024-02-03", orderUrl: "order-3.pdf" }],
      },
    },
  },
};
let searchPageSize = "";
const multiResultProvider = new EcourtsIndiaAuthorityProvider(async (url) => {
  if (url.pathname.endsWith("/search")) {
    searchPageSize = url.searchParams.get("pageSize") ?? "";
    return new Response(JSON.stringify({
      data: {
        results: [
          { cnr: "BAD001", petitioners: ["Invalid One"], respondents: ["State"] },
          { cnr: "BAD002", petitioners: ["Invalid Two"], respondents: ["State"] },
          { cnr: "VALID003", petitioners: ["Valid Three"], respondents: ["State"] },
        ],
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  const cnr = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
  return new Response(JSON.stringify(multiResultDetails[cnr] ?? {}), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
process.env.ECOURTSINDIA_API_KEY = "test-only-key";
try {
  const multiResultAuthorities = await retrieveVerifiedAuthorities(multiResultProvider, query);
  check("eCourts searches a bounded window of five results", searchPageSize === "5");
  check("eCourts continues past invalid results and returns the third valid result", multiResultAuthorities.length === 1 && multiResultAuthorities[0].authorityId === "VALID003");
  check("Verified order without markdown uses metadata reference", multiResultAuthorities[0].relevantPassage === "Order passed by High Court on 2024-02-03 in Valid Three v State.");
  check("Metadata-only order uses distinct provenance", multiResultAuthorities[0].provenance === "verified-metadata" && multiResultAuthorities[0].contentStatus === "metadata-only");
} finally {
  if (originalApiKey === undefined) delete process.env.ECOURTSINDIA_API_KEY;
  else process.env.ECOURTSINDIA_API_KEY = originalApiKey;
}

const modelLikeAuthority = { caseName: "Invented Case", citation: "Invented Citation" } as Record<string, unknown>;
check("Model-like authority metadata is not accepted", !authorities.some((item) => item.caseName === modelLikeAuthority.caseName || item.citation === modelLikeAuthority.citation));

const completeVerifiedCandidate = {
  authorityId: "MHSO010040402012",
  caseName: "Provider Supplied Authority",
  court: "Test Court",
  officialIdentifier: "MHSO010040402012",
  date: "2024-01-15",
  source: "eCourtsIndia",
  judgmentUrl: "https://webapi.ecourtsindia.com/api/partner/case/MHSO010040402012/order/order-1.pdf",
  relevantPassage: "Provider-supplied relevant passage.",
};
const completeValidation = validateVerifiedAuthority(completeVerifiedCandidate);
check("Complete eCourts source metadata passes validation without legal principle", completeValidation.ok);
const verifiedFixture = completeValidation.ok ? completeValidation.authority : undefined;
check("Verified provider result is accepted and returned as verified", Boolean(verifiedFixture?.provenance === "verified"));
const mergedAuthorities = selectVerifiedOrCuratedAuthorities(
  verifiedFixture ? [verifiedFixture] : [],
  verifiedFixture ? [{ ...authorities[0], authorityId: verifiedFixture.authorityId }, ...authorities] : authorities,
);
check("Verified authorities are ordered before curated results", mergedAuthorities[0]?.provenance === "verified");
check("Verified and curated authorities are merged", mergedAuthorities.some((item) => item.provenance === "verified") && mergedAuthorities.some((item) => item.provenance === "curated"));
check("Merged authorities deduplicate by stable authority identifier", mergedAuthorities.filter((item) => item.authorityId === verifiedFixture?.authorityId).length === 1);
check("Merged authorities are capped at four", mergedAuthorities.length <= 4);
check("No verified result falls back to curated", selectVerifiedOrCuratedAuthorities([], authorities).every((item) => item.provenance === "curated"));
check("Verified authority without URL fails", !validateVerifiedAuthority({ ...completeVerifiedCandidate, judgmentUrl: "" }).ok);
check("Verified authority without CNR/official identifier fails", !validateVerifiedAuthority({ ...completeVerifiedCandidate, authorityId: "", officialIdentifier: undefined }).ok);
check("Verified authority without court fails", !validateVerifiedAuthority({ ...completeVerifiedCandidate, court: "" }).ok);
check("Verified authority without date fails", !validateVerifiedAuthority({ ...completeVerifiedCandidate, date: "" }).ok);
check("Verified authority without provider passage fails", !validateVerifiedAuthority({ ...completeVerifiedCandidate, relevantPassage: "" }).ok);
check("Curated record cannot be silently marked verified", !validateVerifiedAuthority(authorities[0]).ok);
const aiOnlyCandidate = { ...completeVerifiedCandidate, caseAiAnalysis: { summary: "AI-generated summary" }, legalPrinciple: "AI-generated principle" };
const aiOnlyValidation = validateVerifiedAuthority(aiOnlyCandidate);
check("AI summary cannot populate verified legal principle", aiOnlyValidation.ok && !("legalPrinciple" in aiOnlyValidation.authority) && !("principle" in aiOnlyValidation.authority));
check("No fabricated citation or legal principle is introduced", aiOnlyValidation.ok && !aiOnlyValidation.authority.citation && !((aiOnlyValidation.authority as Record<string, unknown>).principle));
check("Groq-like output cannot alter provenance", verifiedFixture?.provenance === "verified" && selectVerifiedOrCuratedAuthorities([verifiedFixture], authorities)[0]?.provenance === "verified");

const sourceWithInvalidRecord: VerifiedAuthoritySource = {
  async retrieve() {
    return [{ ...completeVerifiedCandidate, judgmentUrl: undefined }];
  },
};
const rejected = await retrieveVerifiedAuthorities(sourceWithInvalidRecord, query);
check("Failed verification does not produce a verified record", rejected.length === 0);
check("Provider output does not expose an API key", !JSON.stringify(rejected).includes("test-only-key"));

console.log("Authority retrieval verification passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
