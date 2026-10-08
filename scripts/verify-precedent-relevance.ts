import assert from "node:assert/strict";
import {
  buildPrecedentQuery,
  retrievePrecedents,
  type PrecedentCaseData,
} from "../lib/precedent-retrieval";

type ProductionCase = {
  id: string;
  data: PrecedentCaseData;
  context: string;
};

const cases: ProductionCase[] = [
  {
    id: "A-ipc-302-default-bail",
    data: {
      bailType: "default bail",
      offenseType: "non-bailable",
      section: "IPC 302",
      custodyDuration: "1-2yr",
      proceduralStage: "pre-chargesheet",
      previousBail: "none",
    },
    context: "default bail satisfied; heinous violent offence",
  },
  {
    id: "B-ipc-420-cooperation",
    data: {
      bailType: "regular bail",
      offenseType: "non-bailable",
      section: "IPC 420",
      custodyDuration: "under-30",
      proceduralStage: "chargesheet filed",
      cooperationLevel: "cooperated in investigation",
      previousBail: "none",
    },
    context: "economic offence; cooperation",
  },
  {
    id: "C-ndps-21-section-37",
    data: {
      bailType: "regular bail",
      offenseType: "ndps",
      section: "NDPS 21",
      custodyDuration: "6-12mo",
      proceduralStage: "trial",
      previousBail: "1 rejected",
    },
    context: "commercial quantity; NDPS Section 37 twin conditions apply",
  },
  {
    id: "D-ipc-323-bailable",
    data: {
      bailType: "regular bail",
      offenseType: "bailable",
      section: "IPC 323",
      custodyDuration: "under-30",
      proceduralStage: "investigation",
      priorRecord: false,
      previousBail: "none",
    },
    context: "first-time offender; minor bailable offence",
  },
];

const results = cases.map((scenario) => {
  const query = buildPrecedentQuery(scenario.data, scenario.context);
  const retrieved = retrievePrecedents(scenario.data, scenario.context);
  assert.ok(retrieved.length > 0, `${scenario.id} should retrieve curated precedents`);
  return { scenario, query, retrieved };
});

const byId = (id: string) => results.find((result) => result.scenario.id === id)!;
const caseA = byId("A-ipc-302-default-bail");
const caseB = byId("B-ipc-420-cooperation");
const caseC = byId("C-ndps-21-section-37");
const caseD = byId("D-ipc-323-bailable");

const unavailableDefaultQuery = buildPrecedentQuery(
  { bailType: "regular bail", section: "IPC 420" },
  "default bail not available",
);
assert.equal(unavailableDefaultQuery.bailPosture, "regular bail");
assert.equal(unavailableDefaultQuery.signals.has("default/statutory bail"), false);
assert.equal(unavailableDefaultQuery.signals.has("default bail not available"), true);

const exactCustodyQuery = buildPrecedentQuery(
  { bailType: "regular bail", custodyDuration: "90 days in custody" },
  "",
);
assert.equal(exactCustodyQuery.bailPosture, "regular bail");

const noPriorRejectionQuery = buildPrecedentQuery(
  { previousBail: "none", section: "IPC 420" },
  "no prior bail rejection",
);
assert.equal(noPriorRejectionQuery.signals.has("first-time offender"), false);

assert.deepEqual(caseA.query.statutorySections, ["IPC:302"]);
assert.equal(caseA.query.offenseCategory, "heinous violent offence");
assert.equal(caseA.query.bailPosture, "default/statutory bail");
assert.equal(caseA.query.proceduralStage, "investigation");
assert.ok(caseA.query.signals.has("murder/heinous offence"));

assert.deepEqual(caseB.query.statutorySections, ["IPC:420"]);
assert.equal(caseB.query.offenseCategory, "economic offence");
assert.ok(caseB.query.signals.has("economic offence"));
assert.ok(caseB.query.signals.has("cooperation"));

assert.deepEqual(caseC.query.statutorySections, ["NDPS:21"]);
assert.equal(caseC.query.offenseCategory, "special statutory offence");
assert.ok(caseC.query.specialStatutoryIssues.includes("NDPS Section 37"));
assert.ok(caseC.query.signals.has("NDPS Section 37"));

assert.deepEqual(caseD.query.statutorySections, ["IPC:323"]);
assert.equal(caseD.query.offenseCategory, "minor bailable offence");
assert.ok(caseD.query.signals.has("minor bailable offence"));
assert.ok(caseD.query.signals.has("first-time offender"));

const sanjayInMurder = caseA.retrieved.find((precedent) => precedent.id === "sanjay-chandra-2012");
if (sanjayInMurder) {
  assert.equal(
    sanjayInMurder.scoreReasons.some((reason) => reason.includes("heinous-offence relevance")),
    false,
    "generic seriousness wording must not trigger the heinous-offence boost",
  );
}
assert.ok(
  caseA.retrieved.some((precedent) =>
    ["kalyan-chandra-sarkar-v-rajesh-ranjan-2004", "prasanta-kumar-sarkar-v-ashis-chatterjee-2010"].includes(precedent.id)
    && precedent.scoreReasons.some((reason) => reason.includes("heinous-offence relevance"))),
  "IPC 302 should receive a genuinely heinous-offence-relevant authority",
);
assert.ok(
  caseB.retrieved.some((precedent) => precedent.id === "sanjay-chandra-2012" && precedent.scoreReasons.some((reason) => reason.includes("economic-offence relevance"))),
  "IPC 420 should retain economic-offence relevance for Sanjay Chandra",
);

assert.ok(
  ["state-of-mp-v-kajad-2001", "union-of-india-v-ram-samujh-1999", "mohd-muslim-v-state-nct-delhi-2023"].some((id) =>
    caseC.retrieved.some((precedent) => precedent.id === id && precedent.scoreReasons.some((reason) => reason.includes("NDPS Section 37 relevance")))),
  "NDPS Section 37 authorities should outrank generic authorities",
);

const defaultBailCase: PrecedentCaseData = {
  bailType: "default bail",
  offenseType: "non-bailable",
  section: "IPC 420",
  proceduralStage: "pre-chargesheet",
};
const defaultBailQuery = buildPrecedentQuery(defaultBailCase, "Section 167(2) default bail; charge-sheet not filed");
const defaultBailResults = retrievePrecedents(defaultBailCase, "Section 167(2) default bail; charge-sheet not filed");
assert.equal(defaultBailQuery.bailPosture, "default/statutory bail");
assert.equal(defaultBailQuery.proceduralStage, "investigation");
assert.ok(
  defaultBailResults.some((precedent) =>
    ["bikramjit-singh-v-state-of-punjab-2020", "m-ravindran-v-directorate-of-revenue-intelligence-2020"].includes(precedent.id)
    && precedent.scoreReasons.some((reason) => reason.includes("default/statutory bail"))),
  "Section 167(2) authorities should be retrieved for default bail",
);

const pmlaCase: PrecedentCaseData = {
  bailType: "regular bail",
  offenseType: "non-bailable",
  section: "PMLA 45",
  proceduralStage: "trial",
};
const pmlaResults = retrievePrecedents(pmlaCase, "PMLA Section 45 twin conditions apply");
const pmlaAuthority = pmlaResults.find((precedent) => precedent.id === "vijay-madanlal-choudhary-v-union-of-india-2022");
assert.ok(pmlaAuthority, "Vijay Madanlal Choudhary should be retrieved for PMLA Section 45");
assert.ok(pmlaAuthority.scoreReasons.includes("PMLA Section 45 relevance"));

const topCaseNames = results.map(({ retrieved }) => retrieved[0]?.caseName);
assert.equal(new Set(topCaseNames).size > 1, true, "production cases should not share one universal top authority");
assert.notDeepEqual(
  caseA.retrieved.map((precedent) => precedent.caseName),
  caseB.retrieved.map((precedent) => precedent.caseName),
  "murder/default-bail and economic-offence rankings should differ",
);
assert.notDeepEqual(
  caseC.retrieved.map((precedent) => precedent.caseName),
  caseD.retrieved.map((precedent) => precedent.caseName),
  "NDPS Section 37 and bailable/minor-offence rankings should differ",
);

for (const result of results) {
  assert.ok(result.retrieved.every((precedent) => precedent.scoreReasons.length > 0));
}

console.log("Precedent relevance verification passed for Cases A–D.");
for (const { scenario, query, retrieved } of results) {
  console.log(`${scenario.id}: ${query.offenseCategory} | ${query.bailPosture} | ${[...query.signals].join(", ")}`);
  console.log(`  ${retrieved.map((precedent) => `${precedent.caseName} (${precedent.score})`).join(" -> ")}`);
}
