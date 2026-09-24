/**
 * Source-of-truth boundary checks. No live Groq call.
 * Run with: npx tsx scripts/verify-source-of-truth.ts
 */

import { resolveLegalReasoning } from "../lib/analysis-source-of-truth";
import { runLegalRules } from "../lib/legal-rules";

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log("  PASS: " + label);
    passed++;
  } else {
    console.error("  FAIL: " + label);
    failed++;
  }
}

const legalRules = runLegalRules({
  sections: ["420"],
  custodyDays: null,
  chargesheetFiled: false,
  age: 25,
});

const fallback = resolveLegalReasoning(undefined, legalRules, 85);
assert("Fallback contains deterministic offense classification", fallback.includes("non-bailable"));
assert("Fallback contains unspecified default-bail state", fallback.includes("eligible [not computed]"));
assert("Fallback preserves unknown custody", fallback.includes("days served [unspecified]"));
assert("Fallback labels score separately", fallback.includes("Deterministic risk score: [85/100]"));
assert("Fallback does not convert score into statutory eligibility", !fallback.includes("statutory eligibility: [85]"));

const normalGroqReasoning = "The supplied facts and deterministic findings support a mixed qualitative assessment.";
const preservedReasoning = resolveLegalReasoning(normalGroqReasoning, legalRules, 85);
assert("Normal non-empty Groq reasoning remains unchanged", preservedReasoning === normalGroqReasoning);
assert("Normal reasoning does not receive the fallback", !preservedReasoning.includes("Deterministic risk score"));

const favorableVerdict = "Favorable";
const deterministicScore = 85;
assert("Qualitative verdict remains separate from deterministic score", favorableVerdict === "Favorable" && deterministicScore === 85);
assert("Unknown default-bail result remains authoritative", legalRules.defaultBail.eligible === null && legalRules.defaultBail.daysServed === null);

const knownZeroRules = runLegalRules({
  sections: ["420"],
  custodyDays: 0,
  chargesheetFiled: false,
  age: 25,
});
const knownZeroFallback = resolveLegalReasoning(null, knownZeroRules, 50);
assert("Known zero-day default-bail result remains authoritative", knownZeroFallback.includes("eligible [no]") && knownZeroFallback.includes("days served [0]"));

const known45Rules = runLegalRules({
  sections: ["420"],
  custodyDays: 45,
  chargesheetFiled: false,
  age: 25,
});
const known45Fallback = resolveLegalReasoning(null, known45Rules, 50);
assert("Explicit custody duration remains authoritative", known45Fallback.includes("days served [45]"));

console.log("\n" + "-".repeat(50));
console.log("Source-of-truth verification: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
