import assert from "node:assert/strict";
import { buildBailAuthorityQuery } from "../lib/authority-retrieval";
import type { BailStrategyInput } from "../lib/bail-strategy-engine";
import { runLegalRules, type CustodyDuration } from "../lib/legal-rules";

const ranges: Array<{ value: CustodyDuration; expected: [boolean | null, boolean | null] }> = [
  { value: "under-30", expected: [false, false] },
  { value: "1-6mo", expected: [null, null] },
  { value: "6-12mo", expected: [true, true] },
  { value: "1-2yr", expected: [true, true] },
  { value: "over-2yr", expected: [true, true] },
];

function checkRange(range: CustodyDuration, thresholdIndex: 0 | 1, expected: boolean | null) {
  const thresholdSection = thresholdIndex === 0 ? "IPC 420" : "IPC 302";
  const rules = runLegalRules({
    sections: [thresholdSection],
    custodyDays: null,
    custodyDuration: range,
    chargesheetFiled: false,
    age: 25,
  });

  assert.equal(rules.defaultBail.eligible, expected, `${range} should classify correctly for ${thresholdIndex === 0 ? 60 : 90} days`);
  assert.equal(rules.defaultBail.daysServed, null, `${range} must not manufacture days served`);
  assert.match(rules.promptInjection, /Days served: \[unspecified/);
  if (expected === true) {
    assert.match(rules.promptInjection, /custody range satisfies .*day threshold/);
    assert.doesNotMatch(rules.promptInjection, /Eligible: \[not computed\]/);
  } else if (expected === false) {
    assert.match(rules.promptInjection, /Eligible: \[no\]/);
    assert.doesNotMatch(rules.promptInjection, /Eligible: \[not computed\]/);
  } else {
    assert.match(rules.promptInjection, /Eligible: \[not computed\]/);
  }
}

for (const range of ranges) {
  checkRange(range.value, 0, range.expected[0]);
  checkRange(range.value, 1, range.expected[1]);
}

// Production-shaped Bail Strategy path: preserve the selected range while
// deriving legal rules without supplying an exact custody day count.
const productionInput: BailStrategyInput = {
  sections: "IPC 302",
  legalFramework: "LEGACY_IPC_CRPC",
  offenseType: "non-bailable",
  custodyDuration: "1-2yr",
  courtStage: "SESSIONS",
  previousBail: "none",
  accusedTags: [],
  age: "35",
  firOrCnr: "FIR 112/2026",
  additionalContext: "Investigation ongoing.",
};
const productionRules = runLegalRules({
  sections: ["IPC 302"],
  custodyDays: null,
  custodyDuration: productionInput.custodyDuration,
  chargesheetFiled: false,
  age: 35,
});
const productionQuery = buildBailAuthorityQuery({
  input: productionInput,
  legalRules: productionRules,
  authoritativeResult: {
    eligibility: "Likely eligible",
    authority: "DETERMINISTIC",
    ruleSummary: "Range-confirmed default bail test fixture.",
    deterministicFindings: {
      framework: "LEGACY_IPC_CRPC",
      primarySection: "IPC 302",
      bailable: false,
      supported: true,
      severity: "severe",
      defaultBailEligible: true,
      defaultBailDaysServed: null,
      defaultBailDaysRequired: 90,
      defaultBailProvision: "CrPC 167(2)",
      chargesheetFiled: false,
      specialActBar: false,
      isJuvenile: false,
    },
  },
  custodyDays: null,
  chargesheetFiled: false,
});

assert.equal(productionRules.defaultBail.eligible, true);
assert.equal(productionRules.defaultBail.daysServed, null);
assert.equal(productionQuery.custodyDuration, "1-2yr");
assert.equal(productionQuery.custodyDays, undefined);
assert.match(productionQuery.queryText, /custody 1 to 2 years/);

const chargesheetRules = runLegalRules({
  sections: ["IPC 302"],
  custodyDays: null,
  custodyDuration: "over-2yr",
  chargesheetFiled: true,
  age: 35,
});
assert.equal(chargesheetRules.defaultBail.eligible, false);
assert.equal(chargesheetRules.defaultBail.daysServed, null);
assert.match(chargesheetRules.promptInjection, /Eligible: \[no\]/);

console.log("Bail custody range verification passed: 10 range cases + 1 production-shaped case.");
