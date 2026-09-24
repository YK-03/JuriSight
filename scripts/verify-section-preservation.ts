/**
 * Regression: mixed IPC/BNS intake sections must survive analysis assembly
 * without a live Groq call.
 *
 * Run with: npx tsx scripts/verify-section-preservation.ts
 */

import { buildCasePayload, type IntakeFormState } from "../lib/case-intake";
import { hasDeterministicSectionRule, runLegalRules } from "../lib/legal-rules";
import {
  formatAuthoritativeSectionsBlock,
  mergeApplicableSections,
  parseSuppliedSections,
} from "../lib/section-preservation";

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

const REAL_INPUT =
  "IPC Sections 420 (Cheating), 468 (Forgery), 471 (Using forged document as genuine), and 120B (Criminal Conspiracy) / BNS Sections 318, 336, 340, and 61";

console.log("\nSection-preservation regression");
console.log("Input:", REAL_INPUT);

const intake: IntakeFormState = {
  caseTitle: "State vs. Test Accused",
  sections: REAL_INPUT,
  offenseType: "Non-bailable",
  accusedName: "Test Accused",
  accusedProfile: "Local resident",
  priorRecord: false,
  bailType: "Anticipatory Bail (CrPC 438)",
  proceduralStage: "Investigation pending",
  custodyStatus: "Not arrested / Pre-arrest",
  previousBail: "No prior bail application",
  cooperationLevel: "Cooperated in investigation",
  whatHappened:
    "Alleged cheating and use of forged documents with a conspiracy charge. The FIR also lists corresponding BNS provisions.",
  incidentDate: "January 2026",
  incidentLocation: "Delhi",
  partiesInvolved: "Complainant and accused",
  evidenceDetails: "Alleged forged documents",
  legalQuestions: "Whether anticipatory bail is maintainable",
};

const payload = buildCasePayload(intake);
assert(
  "Intake payload preserves the full sections string on Case.section",
  payload.section === REAL_INPUT,
  "Got: " + payload.section,
);

const parsed = parseSuppliedSections(payload.section);
console.log("  forRules:", JSON.stringify(parsed.forRules));
console.log("  suppliedRaw:", JSON.stringify(parsed.suppliedRaw));

const expectedIpc = ["420", "468", "471", "120B"];
const expectedBns = ["318", "336", "340", "61"];

assert(
  "All IPC codes survive parsing",
  expectedIpc.every((code) => parsed.forRules.includes(code)),
  "forRules=" + JSON.stringify(parsed.forRules),
);
assert(
  "IPC prefixes are preserved on supplied labels",
  expectedIpc.every((code) => parsed.suppliedRaw.includes(`IPC ${code}`)),
  "suppliedRaw=" + JSON.stringify(parsed.suppliedRaw),
);
assert(
  "All BNS codes survive with BNS prefix",
  expectedBns.every((code) => parsed.suppliedRaw.includes(`BNS ${code}`)),
  "suppliedRaw=" + JSON.stringify(parsed.suppliedRaw),
);
assert(
  "Parenthetical titles are not treated as section codes",
  !parsed.suppliedRaw.some((label) => /cheating|forgery|conspiracy/i.test(label)),
  "suppliedRaw=" + JSON.stringify(parsed.suppliedRaw),
);
assert(
  "BNS tokens are not passed to runLegalRules as IPC-like codes",
  parsed.forRules.every((code) => !code.toUpperCase().startsWith("BNS")),
  "forRules=" + JSON.stringify(parsed.forRules),
);
assert(
  "Naive comma-split is not the surviving representation",
  !parsed.forRules.some((token) => token.includes("IPC Sections")),
);

const legalRules = runLegalRules({
  sections: parsed.forRules,
  custodyDays: 0,
  chargesheetFiled: false,
  age: 25,
});

assert(
  "Deterministic engine recognizes IPC 420",
  hasDeterministicSectionRule("420") && /420/.test(legalRules.offenseClass.primarySection),
  "primarySection=" + legalRules.offenseClass.primarySection,
);
assert(
  "Deterministic engine has no fabricated BNS 318 rule",
  !hasDeterministicSectionRule("BNS 318") && !hasDeterministicSectionRule("318"),
);
assert(
  "Deterministic engine has no fabricated BNS 61 / IPC 61 rule",
  !hasDeterministicSectionRule("61") && !hasDeterministicSectionRule("BNS 61"),
);
assert(
  "Unsupported IPC 468/471/120B still reach the rule engine as bare codes",
  ["468", "471", "120B"].every((code) => parsed.forRules.includes(code)),
);
assert(
  "Unsupported IPC 468 is preserved even without a deterministic rule",
  !hasDeterministicSectionRule("468"),
);

const llmShrunkOutput = ["IPC Section 420", "CrPC Section 438", "CrPC Section 439"];
const merged = mergeApplicableSections({
  parsed: parsed.parsed,
  bailType: payload.bailType || "",
  framework: "LEGACY_IPC_CRPC",
  llmSections: llmShrunkOutput,
});

const mergedCodes = merged.map((entry) => entry.code);
console.log("  merged:", JSON.stringify(merged, null, 2));

assert(
  "Merged output keeps every supplied IPC/BNS section after a shrunk LLM list",
  [...expectedIpc.map((code) => `IPC ${code}`), ...expectedBns.map((code) => `BNS ${code}`)].every((code) =>
    mergedCodes.includes(code),
  ),
  "mergedCodes=" + JSON.stringify(mergedCodes),
);
assert(
  "Anticipatory bail adds CrPC 438 as procedural, not as an offence section",
  merged.some((entry) => entry.source === "procedural" && entry.code === "CrPC 438"),
);
assert(
  "CrPC 439 from the LLM is not treated as a supplied offence section",
  !merged.some((entry) => entry.source === "supplied" && /439/.test(entry.code)),
);
assert(
  "LLM-inferred IPC 420 is not duplicated on top of the supplied entry",
  merged.filter((entry) => /420/.test(entry.code)).length === 1,
);
assert(
  "BNS entries are labeled as declared, not as deterministic findings",
  merged
    .filter((entry) => entry.code.startsWith("BNS "))
    .every((entry) => /not validated by the deterministic/i.test(entry.relevance)),
);

const regularBailMerged = mergeApplicableSections({
  parsed: parsed.parsed,
  bailType: "Regular Bail (CrPC 437 / 439)",
  framework: "LEGACY_IPC_CRPC",
  llmSections: llmShrunkOutput,
});
assert(
  "Regular bail uses CrPC 437/439, not 438, as procedural provisions",
  regularBailMerged.some((entry) => entry.code === "CrPC 437") &&
    regularBailMerged.some((entry) => entry.code === "CrPC 439") &&
    !regularBailMerged.some((entry) => entry.source === "procedural" && entry.code === "CrPC 438"),
);

const extraInferred = mergeApplicableSections({
  parsed: parsed.parsed,
  bailType: "Anticipatory Bail (CrPC 438)",
  framework: "LEGACY_IPC_CRPC",
  llmSections: ["IPC 406", "IPC Section 420"],
});
assert(
  "Extra LLM section 406 is labeled possible/unverified, not user-supplied",
  extraInferred.some(
    (entry) =>
      entry.code === "IPC 406" &&
      entry.source === "inferred" &&
      /possible\/unverified/i.test(entry.relevance),
  ),
);

const promptBlock = formatAuthoritativeSectionsBlock(parsed.suppliedRaw);
assert(
  "Prompt block still contains the full authoritative list even if the LLM later returns a smaller list",
  expectedIpc.every((code) => promptBlock.includes(`IPC ${code}`)) &&
    expectedBns.every((code) => promptBlock.includes(`BNS ${code}`)),
);
assert(
  "Prompt block forbids shrinking the supplied list",
  /DO NOT DROP, REPLACE, OR SHRINK/i.test(promptBlock),
);

console.log("\n" + "-".repeat(50));
console.log("Section preservation: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
