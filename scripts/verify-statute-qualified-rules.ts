/**
 * Phase 3B Step 1: statute-qualified deterministic rule identity checks.
 * Run with: npx tsx scripts/verify-statute-qualified-rules.ts
 */

import assert from "node:assert/strict";
import { runLegalRules, hasDeterministicSectionRule } from "../lib/legal-rules";
import { parseSuppliedSections } from "../lib/section-preservation";
import type { LegalFramework } from "../lib/legal-framework";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  PASS: ${label}`);
  passed++;
}

function rules(sections: Array<string | { statute: "IPC" | "BNS" | "NDPS" | "PMLA"; section: string }>, framework: LegalFramework = "LEGACY_IPC_CRPC") {
  return runLegalRules({ sections, custodyDays: 0, chargesheetFiled: false, age: 25, framework });
}

console.log("\nStatute-qualified deterministic rules");

const ipc302 = rules(["IPC 302"]);
const ipc420 = rules(["IPC 420"]);
const ipc406 = rules(["IPC 406"]);
const ipc498A = rules(["IPC 498A"]);
check("IPC 302 preserves the existing severe/non-bailable result", !ipc302.offenseClass.bailable && ipc302.offenseClass.severity === "severe" && ipc302.offenseClass.primarySection === "302");
check("IPC 420 preserves the existing moderate/non-bailable result", !ipc420.offenseClass.bailable && ipc420.offenseClass.severity === "moderate" && ipc420.offenseClass.primarySection === "420");
check("IPC 406 preserves the existing moderate/non-bailable result", !ipc406.offenseClass.bailable && ipc406.offenseClass.severity === "moderate");
check("IPC 498A preserves the existing moderate/non-bailable result", !ipc498A.offenseClass.bailable && ipc498A.offenseClass.severity === "moderate");

const bns103 = rules([{ statute: "BNS", section: "103" }], "CURRENT_BNS_BNSS");
const bns420 = rules([{ statute: "BNS", section: "420" }], "CURRENT_BNS_BNSS");
const unspecified302 = rules(["302"], "UNSPECIFIED");
const unspecified420 = rules(["420"], "UNSPECIFIED");
check("BNS 103 uses its own BNS rule and does not invoke IPC 302", bns103.offenseClass.supported && !bns103.offenseClass.bailable && bns103.offenseClass.primarySection === "BNS 103");
check("BNS 420 does not invoke IPC 420", !bns420.offenseClass.supported && !bns420.promptInjection.includes("non-bailable"));
check("Bare 302 under unspecified is not IPC 302", !unspecified302.offenseClass.supported && unspecified302.offenseClass.primarySection === "");
check("Bare 420 under unspecified is not IPC 420", !unspecified420.offenseClass.supported && unspecified420.offenseClass.primarySection === "");

check("Explicit NDPS 21 has a distinct deterministic identity", hasDeterministicSectionRule("NDPS 21"));
check("Bare 21 does not automatically invoke NDPS", !hasDeterministicSectionRule("21"));
check("Explicit NDPS 21 triggers NDPS logic", rules(["NDPS 21"]).offenseClass.hasNDPS && rules(["NDPS 21"]).ndpsBar?.barApplies === true);
check("Bare 21 does not trigger NDPS logic", rules(["21"]).offenseClass.hasNDPS === false && rules(["21"]).ndpsBar === null);
check("Explicit PMLA 3 has a distinct deterministic identity", hasDeterministicSectionRule("PMLA 3"));
check("Bare 3 does not automatically invoke PMLA", !hasDeterministicSectionRule("3"));
check("Explicit PMLA 3 triggers PMLA logic", rules(["PMLA 3"]).offenseClass.hasPMLA && rules(["PMLA 3"]).pmlaConditions?.applies === true);
check("Bare 3 does not trigger PMLA logic", rules(["3"]).offenseClass.hasPMLA === false && rules(["3"]).pmlaConditions === null);

const parsedNdps = parseSuppliedSections("NDPS 21", "UNSPECIFIED");
const parsedBare = parseSuppliedSections("21", "UNSPECIFIED");
check("Section parsing emits a qualified NDPS identity", parsedNdps.ruleIdentities[0]?.statute === "NDPS" && parsedNdps.ruleIdentities[0]?.section === "21");
check("Section parsing emits no rule identity for ambiguous bare 21", parsedBare.ruleIdentities.length === 0);

const unsupportedBns = rules([{ statute: "BNS", section: "999" }], "CURRENT_BNS_BNSS");
check("Unsupported BNS remains unsupported", !unsupportedBns.offenseClass.supported);
check("Unsupported BNS does not receive a substantive non-bailable conclusion", unsupportedBns.promptInjection.includes("unsupported / not determined") && !unsupportedBns.promptInjection.includes("Offense Classification: [non-bailable]"));

console.log(`\nStatute-qualified rules: ${passed} passed, 0 failed`);
