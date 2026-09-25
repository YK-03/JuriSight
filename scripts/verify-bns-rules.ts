/**
 * Phase 3B Step 2: focused BNS deterministic rule coverage.
 * Run with: npx tsx scripts/verify-bns-rules.ts
 */

import assert from "node:assert/strict";
import { runLegalRules, hasDeterministicSectionRule, type LegalRuleIdentity } from "../lib/legal-rules";
import { parseSuppliedSections } from "../lib/section-preservation";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  PASS: ${label}`);
  passed++;
}

function bns(section: string, subsection?: string): LegalRuleIdentity {
  return { statute: "BNS", section, subsection };
}

function evaluate(sections: Array<string | LegalRuleIdentity>, framework: "CURRENT_BNS_BNSS" | "UNSPECIFIED" | "LEGACY_IPC_CRPC" = "CURRENT_BNS_BNSS") {
  return runLegalRules({ sections, custodyDays: 0, chargesheetFiled: false, age: 25, framework });
}

console.log("\nBNS deterministic rule coverage");

const bns103 = evaluate([bns("103")]);
const bns109 = evaluate([bns("109")]);
const bns64 = evaluate([bns("64")]);
const bns3184 = evaluate([bns("318", "4")]);
const bns3162 = evaluate([bns("316", "2")]);
const bns85 = evaluate([bns("85")]);
const bns1152 = evaluate([bns("115", "2")]);
const bns1181 = evaluate([bns("118", "1")]);
const bns3512 = evaluate([bns("351", "2")]);
const bns3513 = evaluate([bns("351", "3")]);
const bns352 = evaluate([bns("352")]);

check("BNS 103 resolves to a supported rule", bns103.offenseClass.supported && !bns103.offenseClass.bailable && bns103.offenseClass.severity === "severe");
check("BNS 109 resolves to a supported rule", bns109.offenseClass.supported && !bns109.offenseClass.bailable && bns109.offenseClass.severity === "serious");
check("BNS 64 resolves to a supported rule", bns64.offenseClass.supported && !bns64.offenseClass.bailable && bns64.offenseClass.severity === "severe");
check("BNS 318(4) resolves to a supported rule", bns3184.offenseClass.supported && !bns3184.offenseClass.bailable && bns3184.offenseClass.severity === "moderate");
check("BNS 316(2) resolves to a supported rule", bns3162.offenseClass.supported && !bns3162.offenseClass.bailable && bns3162.offenseClass.severity === "moderate");
check("BNS 85 resolves to a supported rule", bns85.offenseClass.supported && !bns85.offenseClass.bailable && bns85.offenseClass.severity === "moderate");
check("BNS 115(2) resolves to a supported bailable rule", bns1152.offenseClass.supported && bns1152.offenseClass.bailable === true && bns1152.offenseClass.severity === "minor");
check("BNS 118(1) resolves to a supported non-bailable rule", bns1181.offenseClass.supported && bns1181.offenseClass.bailable === false && bns1181.offenseClass.severity === "moderate");
check("BNS 351(2) resolves to a supported bailable rule", bns3512.offenseClass.supported && bns3512.offenseClass.bailable === true && bns3512.offenseClass.severity === "minor");
check("BNS 351(3) resolves as a distinct supported bailable rule", bns3513.offenseClass.supported && bns3513.offenseClass.bailable === true && bns3513.offenseClass.severity === "moderate");
check("BNS 352 resolves to a supported bailable rule", bns352.offenseClass.supported && bns352.offenseClass.bailable === true && bns352.offenseClass.severity === "minor");

check("BNS 103 participates in the current serious default-bail threshold", bns103.defaultBail.daysRequired === 90);
check("BNS 109 participates in the current serious default-bail threshold", bns109.defaultBail.daysRequired === 90);
check("BNS 64 participates in the current serious default-bail threshold", bns64.defaultBail.daysRequired === 90);
check("BNS 318(4) does not enter the serious threshold", bns3184.defaultBail.daysRequired === 60);
check("BNS 316(2) does not enter the serious threshold", bns3162.defaultBail.daysRequired === 60);
check("BNS 85 does not enter the serious threshold", bns85.defaultBail.daysRequired === 60);
check("BNS 115(2) uses the supported non-serious threshold", bns1152.defaultBail.daysRequired === 60);
check("BNS 118(1) uses the supported non-serious threshold", bns1181.defaultBail.daysRequired === 60);
check("BNS 351(2) uses the supported non-serious threshold", bns3512.defaultBail.daysRequired === 60);
check("BNS 351(3) uses the supported non-serious threshold", bns3513.defaultBail.daysRequired === 60);
check("BNS 352 uses the supported non-serious threshold", bns352.defaultBail.daysRequired === 60);

const parsedSubsections = parseSuppliedSections("BNS 318(4), BNS 316(2)", "CURRENT_BNS_BNSS");
check("Parser preserves BNS 318(4) subsection identity", parsedSubsections.ruleIdentities.some((entry) => entry.section === "318" && entry.subsection === "4"));
check("Parser preserves BNS 316(2) subsection identity", parsedSubsections.ruleIdentities.some((entry) => entry.section === "316" && entry.subsection === "2"));
check("BNS 318 does not resolve to BNS 318(4)", !hasDeterministicSectionRule({ statute: "BNS", section: "318" }));
check("BNS 318(3) does not resolve to BNS 318(4)", !hasDeterministicSectionRule({ statute: "BNS", section: "318", subsection: "3" }));
check("BNS 316 does not resolve to BNS 316(2)", !hasDeterministicSectionRule({ statute: "BNS", section: "316" }));
check("BNS 316(3) does not resolve to BNS 316(2)", !hasDeterministicSectionRule({ statute: "BNS", section: "316", subsection: "3" }));
check("BNS 115 does not resolve to BNS 115(2)", !hasDeterministicSectionRule({ statute: "BNS", section: "115" }));
check("BNS 115(1) does not resolve to BNS 115(2)", !hasDeterministicSectionRule({ statute: "BNS", section: "115", subsection: "1" }));
check("BNS 118 does not resolve to BNS 118(1)", !hasDeterministicSectionRule({ statute: "BNS", section: "118" }));
check("BNS 118(2) does not resolve to BNS 118(1)", !hasDeterministicSectionRule({ statute: "BNS", section: "118", subsection: "2" }));
check("BNS 351 does not resolve to a subsection rule", !hasDeterministicSectionRule({ statute: "BNS", section: "351" }));
check("BNS 351(1) does not resolve to BNS 351(2)", !hasDeterministicSectionRule({ statute: "BNS", section: "351", subsection: "1" }));
check("BNS 351(1) does not resolve to BNS 351(3)", !hasDeterministicSectionRule({ statute: "BNS", section: "351", subsection: "1" }));
check("BNS 352(1) does not resolve to BNS 352", !hasDeterministicSectionRule({ statute: "BNS", section: "352", subsection: "1" }));
check("BNS 303(2) remains unsupported because its statutory condition is not modeled", !hasDeterministicSectionRule({ statute: "BNS", section: "303", subsection: "2" }));

const unsupportedBns = evaluate([bns("999")]);
const unspecifiedBns = evaluate([bns("103")], "UNSPECIFIED");
const bareCurrent = evaluate(["103"], "CURRENT_BNS_BNSS");
const ipcLegacy = evaluate(["IPC 302"], "LEGACY_IPC_CRPC");
const ipcCurrent = evaluate(["IPC 302"], "CURRENT_BNS_BNSS");
const batch2UnderLegacy = evaluate([bns("115", "2")], "LEGACY_IPC_CRPC");
const batch2BareCurrent = evaluate(["BNS 115"], "CURRENT_BNS_BNSS");
const bns3032 = evaluate([bns("303", "2")]);
check("Unsupported BNS remains unsupported", !unsupportedBns.offenseClass.supported && unsupportedBns.defaultBailThreshold === null && unsupportedBns.defaultBail.eligible === null);
check("BNS 103 under unspecified remains unsupported", !unspecifiedBns.offenseClass.supported && unspecifiedBns.offenseClass.primarySection === "");
check("Bare 103 under current remains unsupported", !bareCurrent.offenseClass.supported && bareCurrent.offenseClass.primarySection === "");
check("IPC 302 retains its legacy result", ipcLegacy.offenseClass.supported && !ipcLegacy.offenseClass.bailable && ipcLegacy.offenseClass.severity === "severe");
check("IPC 302 does not invoke a BNS rule", !ipcCurrent.offenseClass.supported);
check("BNS 115(2) is isolated from the legacy framework", !batch2UnderLegacy.offenseClass.supported);
check("Bare BNS 115 remains unsupported", !batch2BareCurrent.offenseClass.supported);
check("BNS 351(2) and BNS 351(3) remain distinct rule identities", bns3512.recognizedRuleIdentities.some((entry) => entry.section === "351" && entry.subsection === "2") && bns3513.recognizedRuleIdentities.some((entry) => entry.section === "351" && entry.subsection === "3"));
check("BNS 303(2) remains unresolved without a value/restoration condition", !bns3032.offenseClass.supported && bns3032.defaultBailThreshold === null && bns3032.offenseClass.bailable === null);

console.log(`\nBNS rules: ${passed} passed, 0 failed`);
