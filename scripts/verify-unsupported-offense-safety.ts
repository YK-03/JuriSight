import assert from "node:assert/strict";
import { buildDeterministicReasoning } from "../lib/analysis-source-of-truth";
import { runLegalRules, classifyOffense } from "../lib/legal-rules";
import { mergeApplicableSections, parseSuppliedSections } from "../lib/section-preservation";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  PASS: ${label}`);
  passed++;
}

function rules(raw: string, framework: "LEGACY_IPC_CRPC" | "CURRENT_BNS_BNSS" | "UNSPECIFIED") {
  const parsed = parseSuppliedSections(raw, framework);
  return runLegalRules({
    sections: parsed.ruleIdentities,
    custodyDays: 120,
    chargesheetFiled: false,
    age: 25,
    framework,
  });
}

console.log("\nUnsupported-offense safety verification");

for (const [label, raw, framework] of [
  ["Unsupported BNS 420", "BNS 420", "CURRENT_BNS_BNSS"],
  ["Unsupported IPC 468", "IPC 468", "LEGACY_IPC_CRPC"],
  ["Unsupported IPC 471", "IPC 471", "LEGACY_IPC_CRPC"],
  ["Unsupported IPC 120B", "IPC 120B", "LEGACY_IPC_CRPC"],
] as const) {
  const output = rules(raw, framework);
  check(`${label} is unsupported`, output.offenseClass.supported === false);
  check(`${label} has no bailable conclusion`, output.offenseClass.bailable === null);
  check(`${label} has no severity conclusion`, output.offenseClass.severity === null);
  check(`${label} has no default-bail threshold`, output.defaultBailThreshold === null);
  check(`${label} prompt identifies unsupported input`, output.promptInjection.includes("unsupported / not determined"));
  check(`${label} prompt does not claim non-bailable`, !output.promptInjection.includes("Offense Classification: [non-bailable]"));
}

for (const raw of ["302", "420", "21", "3"]) {
  const output = rules(raw, "UNSPECIFIED");
  check(`Bare ${raw} under unspecified is unsupported`, output.offenseClass.supported === false);
  check(`Bare ${raw} under unspecified has no default-bail threshold`, output.defaultBailThreshold === null);
}

check("Bare 21 does not trigger NDPS", rules("21", "UNSPECIFIED").offenseClass.hasNDPS === false);
check("Bare 3 does not trigger PMLA", rules("3", "UNSPECIFIED").offenseClass.hasPMLA === false);

const ipc302 = rules("IPC 302", "LEGACY_IPC_CRPC");
check("Supported IPC 302 remains non-bailable", ipc302.offenseClass.bailable === false);
check("Supported IPC 302 remains severe", ipc302.offenseClass.severity === "severe");

const ipc420 = rules("IPC 420", "LEGACY_IPC_CRPC");
check("Supported IPC 420 remains non-bailable", ipc420.offenseClass.bailable === false);
check("Supported IPC 420 remains moderate", ipc420.offenseClass.severity === "moderate");

const bns103 = rules("BNS 103", "CURRENT_BNS_BNSS");
check("Supported BNS 103 remains non-bailable", bns103.offenseClass.bailable === false);
check("Supported BNS 103 remains severe", bns103.offenseClass.severity === "severe");

const bns318 = rules("BNS 318(4)", "CURRENT_BNS_BNSS");
check("Supported BNS 318(4) remains non-bailable", bns318.offenseClass.bailable === false);
check("Supported BNS 318(4) remains moderate", bns318.offenseClass.severity === "moderate");

const mixed = rules("IPC 302, IPC 468", "LEGACY_IPC_CRPC");
check("Mixed supported and unsupported sections use supported classification", mixed.offenseClass.supported && mixed.offenseClass.primarySection === "302");
check("Mixed supported and unsupported sections use supported threshold", mixed.defaultBailThreshold === 90);

const preserved = parseSuppliedSections("BNS 420", "CURRENT_BNS_BNSS");
const applicable = mergeApplicableSections({
  parsed: preserved.parsed,
  bailType: "Regular Bail",
  framework: "CURRENT_BNS_BNSS",
  llmSections: [],
});
check("Unsupported BNS 420 remains in applicable sections", applicable.some((entry) => entry.code === "BNS 420"));

const fallbackReasoning = buildDeterministicReasoning(rules("BNS 420", "CURRENT_BNS_BNSS"), 42);
check("Fallback reasoning preserves unresolved classification", fallbackReasoning.includes("unsupported / not determined"));
check("Fallback reasoning does not manufacture non-bailable status", !fallbackReasoning.includes("classification: [non-bailable]"));
check("Fallback reasoning keeps risk score separate", fallbackReasoning.includes("separate risk indicator"));

const directUnsupported = classifyOffense(["BNS 420"], "CURRENT_BNS_BNSS");
check("Direct unsupported classification remains unresolved", directUnsupported.bailable === null && directUnsupported.severity === null);

console.log(`\nUnsupported-offense safety verification: ${passed} passed, 0 failed`);
