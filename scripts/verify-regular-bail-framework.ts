import assert from "node:assert/strict";
import { defaultBailProvisionForFramework } from "../lib/legal-framework";
import {
  mergeApplicableSections,
  parseSuppliedSections,
  proceduralProvisionsForBailType,
  type BailCourtLevel,
} from "../lib/section-preservation";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  PASS: ${label}`);
  passed++;
}

function codes(bailType: string, framework: Parameters<typeof proceduralProvisionsForBailType>[1], level?: BailCourtLevel) {
  return proceduralProvisionsForBailType(bailType, framework, level).map((entry) => entry.code);
}

console.log("\nRegular-bail framework verification");

check("Legacy Magistrate maps to CrPC 437", codes("Regular Bail", "LEGACY_IPC_CRPC", "MAGISTRATE").includes("CrPC 437"));
check("Legacy Sessions maps to CrPC 439", codes("Regular Bail", "LEGACY_IPC_CRPC", "SESSIONS").includes("CrPC 439"));
check("Legacy High Court maps to CrPC 439", codes("Regular Bail", "LEGACY_IPC_CRPC", "HIGH_COURT").includes("CrPC 439"));
check(
  "Legacy unspecified preserves CrPC 437 and CrPC 439",
  ["CrPC 437", "CrPC 439"].every((code) => codes("Regular Bail", "LEGACY_IPC_CRPC").includes(code)),
);

check("Current Magistrate maps to BNSS 480", codes("Regular Bail", "CURRENT_BNS_BNSS", "MAGISTRATE").includes("BNSS 480"));
check("Current Sessions maps to BNSS 483", codes("Regular Bail", "CURRENT_BNS_BNSS", "SESSIONS").includes("BNSS 483"));
check("Current High Court maps to BNSS 483", codes("Regular Bail", "CURRENT_BNS_BNSS", "HIGH_COURT").includes("BNSS 483"));
check("Current unspecified is unresolved", codes("Regular Bail", "CURRENT_BNS_BNSS").includes("Unresolved procedural provision"));
check("Unspecified framework is unresolved", codes("Regular Bail", "UNSPECIFIED", "MAGISTRATE").includes("Unresolved procedural provision"));
check("Mixed framework is unresolved", codes("Regular Bail", "MIXED_LEGACY", "MAGISTRATE").includes("Unresolved procedural provision"));

const mixedWithCrpc = parseSuppliedSections("IPC 420, CrPC 437", "MIXED_LEGACY");
const mixedResolved = mergeApplicableSections({
  parsed: mixedWithCrpc.parsed,
  bailType: "Regular Bail",
  framework: "MIXED_LEGACY",
  bailCourtLevel: "MAGISTRATE",
  llmSections: [],
});
check(
  "Mixed framework preserves an explicit CrPC procedural declaration without adding an unresolved duplicate",
  mixedResolved.some((entry) => entry.code === "CrPC 437") &&
    !mixedResolved.some((entry) => entry.code === "Unresolved procedural provision"),
);

check(
  "no-chargesheet cannot select BNSS 480 or BNSS 483",
  !codes("Regular Bail", "CURRENT_BNS_BNSS", "no-chargesheet" as BailCourtLevel).some((code) => code === "BNSS 480" || code === "BNSS 483"),
);
check("Current anticipatory bail remains BNSS 482", codes("Anticipatory Bail", "CURRENT_BNS_BNSS", "MAGISTRATE").includes("BNSS 482"));
check("Legacy anticipatory bail remains CrPC 438", codes("Anticipatory Bail", "LEGACY_IPC_CRPC", "MAGISTRATE").includes("CrPC 438"));
check("Legacy default bail remains CrPC 167(2)", defaultBailProvisionForFramework("LEGACY_IPC_CRPC") === "CrPC 167(2)");
check("Current default bail remains BNSS 187", defaultBailProvisionForFramework("CURRENT_BNS_BNSS") === "BNSS 187");

console.log(`\nRegular-bail framework verification: ${passed} passed, 0 failed`);
