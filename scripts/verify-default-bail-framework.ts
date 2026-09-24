/**
 * Phase 3B Step 3: framework-qualified default-bail evaluation.
 * Run with: npx tsx scripts/verify-default-bail-framework.ts
 */

import assert from "node:assert/strict";
import { runLegalRules } from "../lib/legal-rules";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  PASS: ${label}`);
  passed++;
}

type Framework = "LEGACY_IPC_CRPC" | "CURRENT_BNS_BNSS" | "MIXED_LEGACY" | "UNSPECIFIED";

function evaluate(sections: string[], framework: Framework, custodyDays = 0, chargesheetFiled = false) {
  return runLegalRules({ sections, framework, custodyDays, chargesheetFiled, age: 25 });
}

function evaluateIdentity(
  sections: Array<{ statute: "IPC" | "BNS"; section: string; subsection?: string }>,
  framework: Framework,
  custodyDays = 0,
) {
  return runLegalRules({ sections, framework, custodyDays, chargesheetFiled: false, age: 25 });
}

console.log("\nFramework-qualified default-bail evaluation");

const ipc302Below = evaluate(["IPC 302"], "LEGACY_IPC_CRPC", 89);
const ipc302At = evaluate(["IPC 302"], "LEGACY_IPC_CRPC", 90);
const ipc420Below = evaluate(["IPC 420"], "LEGACY_IPC_CRPC", 59);
const ipc420At = evaluate(["IPC 420"], "LEGACY_IPC_CRPC", 60);
check("IPC 302 remains on the 90-day branch", ipc302Below.defaultBailThreshold === 90 && ipc302Below.defaultBail.eligible === false);
check("IPC 302 reaches eligibility at 90 days", ipc302At.defaultBail.eligible === true);
check("IPC 420 remains on the 60-day branch", ipc420Below.defaultBailThreshold === 60 && ipc420Below.defaultBail.eligible === false);
check("IPC 420 reaches eligibility at 60 days", ipc420At.defaultBail.eligible === true);
check("Existing chargesheet behavior remains unchanged", evaluate(["IPC 302"], "LEGACY_IPC_CRPC", 90, true).defaultBail.eligible === false);

const bns103 = evaluateIdentity([{ statute: "BNS", section: "103" }], "CURRENT_BNS_BNSS");
const bns109 = evaluateIdentity([{ statute: "BNS", section: "109" }], "CURRENT_BNS_BNSS");
const bns64 = evaluateIdentity([{ statute: "BNS", section: "64" }], "CURRENT_BNS_BNSS");
const bns3184 = evaluateIdentity([{ statute: "BNS", section: "318", subsection: "4" }], "CURRENT_BNS_BNSS");
const bns3162 = evaluateIdentity([{ statute: "BNS", section: "316", subsection: "2" }], "CURRENT_BNS_BNSS");
const bns85 = evaluateIdentity([{ statute: "BNS", section: "85" }], "CURRENT_BNS_BNSS");
check("BNS 103 uses the 90-day branch", bns103.defaultBailThreshold === 90 && bns103.defaultBail.daysRequired === 90);
check("BNS 109 uses the 90-day branch", bns109.defaultBailThreshold === 90 && bns109.defaultBail.daysRequired === 90);
check("BNS 64 uses the 90-day branch", bns64.defaultBailThreshold === 90 && bns64.defaultBail.daysRequired === 90);
check("BNS 318(4) uses the 60-day branch", bns3184.defaultBailThreshold === 60 && bns3184.defaultBail.daysRequired === 60);
check("BNS 316(2) uses the 60-day branch", bns3162.defaultBailThreshold === 60 && bns3162.defaultBail.daysRequired === 60);
check("BNS 85 uses the 60-day branch", bns85.defaultBailThreshold === 60 && bns85.defaultBail.daysRequired === 60);

const unsupportedBns = evaluate(["BNS 468"], "CURRENT_BNS_BNSS", 90);
const bareUnspecified = evaluate(["103"], "UNSPECIFIED", 90);
const bareCurrent = evaluate(["103"], "CURRENT_BNS_BNSS", 90);
const bare302Unspecified = evaluate(["302"], "UNSPECIFIED", 90);
const unsupportedIpc = evaluate(["IPC 468"], "LEGACY_IPC_CRPC", 90);
check("Unsupported BNS remains unresolved", unsupportedBns.defaultBailThreshold === null && unsupportedBns.defaultBail.eligible === null && unsupportedBns.defaultBail.daysRequired === 0);
check("Bare 103 under unspecified remains unresolved", bareUnspecified.defaultBailThreshold === null && bareUnspecified.defaultBail.eligible === null);
check("Bare 103 under current remains unresolved", bareCurrent.defaultBailThreshold === null && bareCurrent.defaultBail.eligible === null);
check("Bare 302 under unspecified remains unresolved", bare302Unspecified.defaultBailThreshold === null && bare302Unspecified.defaultBail.eligible === null);
check("Unsupported explicit IPC remains unresolved", unsupportedIpc.defaultBailThreshold === null && unsupportedIpc.defaultBail.eligible === null);

const mixedLegacySerious = evaluateIdentity([
  { statute: "IPC", section: "302" },
  { statute: "BNS", section: "318", subsection: "4" },
], "MIXED_LEGACY");
const mixedCurrentSerious = evaluateIdentity([
  { statute: "BNS", section: "103" },
  { statute: "IPC", section: "420" },
], "MIXED_LEGACY");
check("Mixed IPC 302 + BNS 318(4) uses the recognized IPC serious rule", mixedLegacySerious.defaultBailThreshold === 90 && mixedLegacySerious.recognizedRuleIdentities.length === 2);
check("Mixed BNS 103 + IPC 420 uses the recognized BNS serious rule", mixedCurrentSerious.defaultBailThreshold === 90 && mixedCurrentSerious.recognizedRuleIdentities.length === 2);

check("Legacy default bail uses CrPC 167(2)", ipc302Below.defaultBailProvision === "CrPC 167(2)");
check("Current default bail uses BNSS 187", bns103.defaultBailProvision === "BNSS 187");
check("Unspecified default bail provision remains unresolved", bareUnspecified.defaultBailProvision === null);
check("Mixed default bail provision remains unresolved", mixedLegacySerious.defaultBailProvision === null);

console.log(`\nFramework default-bail verification: ${passed} passed, 0 failed`);
