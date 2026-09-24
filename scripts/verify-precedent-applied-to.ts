/**
 * Prove Groq precedent appliedTo survives normalize + fallback.
 * Run: npx tsx scripts/verify-precedent-applied-to.ts
 */

import {
  buildFallbackPrecedents,
  normalizePrecedents,
  PrecedentSchema,
} from "../lib/precedents";

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

const groqShaped = [
  {
    case: "Sanjay Chandra v. CBI (2012)",
    principle: "Bail should not be denied merely due to seriousness of allegations if trial will take time.",
    appliedTo: "alleged diversion of ₹45 Lakhs against Vikram Malhotra",
    relevance: "this fact supports conditional bail rather than continued custody",
    searchLink: "https://indiankanoon.org/search/?formInput=Sanjay%20Chandra",
  },
];

console.log("\nPrecedent appliedTo preservation");

{
  const normalized = normalizePrecedents(groqShaped);
  assert("normalizePrecedents keeps appliedTo", normalized[0]?.appliedTo === groqShaped[0].appliedTo);
  assert("normalizePrecedents does not use relevance as appliedTo", normalized[0]?.appliedTo !== groqShaped[0].relevance);
  assert("principle is unchanged", normalized[0]?.principle === groqShaped[0].principle);
}

{
  const fallback = buildFallbackPrecedents(groqShaped);
  assert("buildFallbackPrecedents keeps appliedTo", fallback[0]?.appliedTo === groqShaped[0].appliedTo);
}

{
  const parsed = PrecedentSchema.parse(normalizePrecedents(groqShaped)[0]);
  assert("PrecedentSchema retains appliedTo", parsed.appliedTo === groqShaped[0].appliedTo);
}

{
  const without = normalizePrecedents([
    { case: "State of Rajasthan v. Balchand (1977)", principle: "Bail is the rule" },
  ]);
  assert("appliedTo omitted when Groq did not send it", without[0]?.appliedTo === undefined);
}

console.log("\n" + "-".repeat(50));
console.log("appliedTo verification: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
