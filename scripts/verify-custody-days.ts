/**
 * Custody day parsing must not invent a 30-day remand.
 * Run: npx tsx scripts/verify-custody-days.ts
 */

import { runLegalRules } from "../lib/legal-rules";
import { parseCustodyDaysForRules } from "../lib/case-intake";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log("  PASS: " + label);
    passed++;
  } else {
    console.error("  FAIL: " + label + (detail ? "\n     " + detail : ""));
    failed++;
  }
}

console.log("\nCustody days for legal rules");

assert(
  "Pre-arrest is 0 days, not 30",
  parseCustodyDaysForRules("Not arrested / Pre-arrest") === 0,
);
assert("Empty string is unspecified (null)", parseCustodyDaysForRules("") === null);
assert(
  "Not specified is unspecified (null)",
  parseCustodyDaysForRules("Not specified") === null,
);
assert(
  "Under 30 days remains 25",
  parseCustodyDaysForRules("Under 30 days in custody") === 25,
);
assert("1 to 6 months remains 90", parseCustodyDaysForRules("1 to 6 months in custody") === 90);
assert("Explicit 45 days remains 45", parseCustodyDaysForRules("45 days") === 45);
assert("Over 6 months still parses a month count", parseCustodyDaysForRules("Over 6 months in custody") === 180);
assert(
  "Unrecognised custody is unspecified, not 30",
  parseCustodyDaysForRules("remanded last week") === null,
);

{
  const knownZero = runLegalRules({
    sections: ["420"],
    custodyDays: 0,
    chargesheetFiled: false,
    age: 25,
  });
  assert("Known 0 days still emits Days served: [0]", /Days served: \[0\]/.test(knownZero.promptInjection));
  assert("Known 0 days is computed not-eligible", knownZero.defaultBail.eligible === false);
  assert("Known 0 daysServed is 0, not null", knownZero.defaultBail.daysServed === 0);
}

{
  const unspecified = runLegalRules({
    sections: ["420"],
    custodyDays: null,
    chargesheetFiled: false,
    age: 25,
  });
  assert("Unspecified daysServed is null", unspecified.defaultBail.daysServed === null);
  assert("Unspecified eligibility remains unknown", unspecified.defaultBail.eligible === null);
  assert(
    "Unspecified eligibility is not computed",
    unspecified.promptInjection.includes("Eligible: [not computed]"),
  );
  assert(
    "Unspecified does not emit Days served: [0]",
    !unspecified.promptInjection.includes("Days served: [0]"),
  );
  assert("Unspecified does not invent 30", !unspecified.promptInjection.includes("[30]"));
}

{
  const supplied = runLegalRules({
    sections: ["420"],
    custodyDays: 45,
    chargesheetFiled: false,
    age: 25,
  }).promptInjection;
  assert("Supplied 45 days still reaches default-bail injection", supplied.includes("Days served: [45]"));
}

console.log("\n" + "-".repeat(50));
console.log("Custody-days verification: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
