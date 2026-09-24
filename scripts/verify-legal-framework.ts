import assert from "node:assert/strict";
import {
  defaultBailProvisionForFramework,
  inferLegalFrameworkFromSections,
  normalizeLegalFramework,
  resolveLegalFramework,
} from "../lib/legal-framework";
import { parseSuppliedSections, proceduralProvisionsForBailType } from "../lib/section-preservation";
import { runLegalRules } from "../lib/legal-rules";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  PASS: ${label}`);
  passed++;
}

console.log("\nLegal-framework contract verification");

check("Canonical legacy is accepted", normalizeLegalFramework("LEGACY_IPC_CRPC") === "LEGACY_IPC_CRPC");
check("Canonical current is accepted", normalizeLegalFramework("CURRENT_BNS_BNSS") === "CURRENT_BNS_BNSS");
check("Canonical mixed is accepted", normalizeLegalFramework("MIXED_LEGACY") === "MIXED_LEGACY");
check("Canonical unspecified is accepted", normalizeLegalFramework("UNSPECIFIED") === "UNSPECIFIED");
check("Old bail-type metadata becomes unspecified", normalizeLegalFramework("Anticipatory Bail (CrPC 438)") === "UNSPECIFIED");

check("Explicit framework wins", resolveLegalFramework({ explicit: "CURRENT_BNS_BNSS", suppliedSections: "IPC 420" }) === "CURRENT_BNS_BNSS");
check("Persisted canonical framework is used", resolveLegalFramework({ persisted: "LEGACY_IPC_CRPC", suppliedSections: "BNS 318" }) === "LEGACY_IPC_CRPC");
check("IPC/CrPC evidence infers legacy", inferLegalFrameworkFromSections("IPC 420, CrPC 438") === "LEGACY_IPC_CRPC");
check("BNS/BNSS evidence infers current", inferLegalFrameworkFromSections("BNS 318, BNSS 482") === "CURRENT_BNS_BNSS");
check("Mixed evidence infers mixed", inferLegalFrameworkFromSections("IPC 420 / BNS 318") === "MIXED_LEGACY");
check("Bare sections do not infer IPC", inferLegalFrameworkFromSections("420") === "UNSPECIFIED");

const currentBnss = parseSuppliedSections("BNSS 482, BNSS 187", "CURRENT_BNS_BNSS");
check("BNSS 482 remains BNSS 482", currentBnss.suppliedRaw.includes("BNSS 482"));
check("BNSS 187 remains BNSS 187", currentBnss.suppliedRaw.includes("BNSS 187"));
check("BNSS is never rendered as IPC", !currentBnss.suppliedRaw.some((entry) => entry.startsWith("IPC ")));

const mixed = parseSuppliedSections("IPC 420, BNS 318, CrPC 438, BNSS 482", "MIXED_LEGACY");
check("Mixed prefixes are preserved", ["IPC 420", "BNS 318", "CrPC 438", "BNSS 482"].every((entry) => mixed.suppliedRaw.includes(entry)));

const legacyAnticipatory = proceduralProvisionsForBailType("Anticipatory Bail", "LEGACY_IPC_CRPC");
const currentAnticipatory = proceduralProvisionsForBailType("Anticipatory Bail", "CURRENT_BNS_BNSS");
const unspecifiedAnticipatory = proceduralProvisionsForBailType("Anticipatory Bail", "UNSPECIFIED");
const mixedAnticipatory = proceduralProvisionsForBailType("Anticipatory Bail", "MIXED_LEGACY");
check("Legacy anticipatory bail maps to CrPC 438", legacyAnticipatory[0]?.code === "CrPC 438");
check("Current anticipatory bail maps to BNSS 482", currentAnticipatory[0]?.code === "BNSS 482");
check("Unspecified anticipatory bail is unresolved", unspecifiedAnticipatory[0]?.source === "unresolved");
check("Mixed anticipatory bail is unresolved", mixedAnticipatory[0]?.source === "unresolved");
check("Legacy default bail uses CrPC 167(2)", defaultBailProvisionForFramework("LEGACY_IPC_CRPC") === "CrPC 167(2)");
check("Current default bail uses BNSS 187", defaultBailProvisionForFramework("CURRENT_BNS_BNSS") === "BNSS 187");
check("Mixed default bail remains unresolved", defaultBailProvisionForFramework("MIXED_LEGACY") === null);

const legacyBare = parseSuppliedSections("420", "LEGACY_IPC_CRPC");
const currentBare = parseSuppliedSections("420", "CURRENT_BNS_BNSS");
const unspecifiedBare = parseSuppliedSections("420", "UNSPECIFIED");
check("Bare 420 can remain backward-compatible IPC under legacy", legacyBare.forRules.includes("420"));
check("Bare 420 is ambiguous under current", currentBare.parsed[0]?.statute === "UNKNOWN" && currentBare.forRules.length === 0);
check("Bare 420 is ambiguous when unspecified", unspecifiedBare.parsed[0]?.statute === "UNKNOWN" && unspecifiedBare.forRules.length === 0);

const ambiguousRules = runLegalRules({ sections: unspecifiedBare.forRules, custodyDays: 0, chargesheetFiled: false, age: 25, framework: "UNSPECIFIED" });
check("Ambiguous bare section does not become IPC primary section", ambiguousRules.offenseClass.primarySection === "");
check("Current framework defensively ignores bare rule input", runLegalRules({ sections: ["420"], custodyDays: 0, chargesheetFiled: false, age: 25, framework: "CURRENT_BNS_BNSS" }).offenseClass.primarySection === "");
check("Conflicting IPC declaration is preserved and flagged", parseSuppliedSections("IPC 420", "CURRENT_BNS_BNSS").parsed[0]?.frameworkConflict === true);
check("Conflicting BNS declaration is preserved and flagged", parseSuppliedSections("BNS 318", "LEGACY_IPC_CRPC").parsed[0]?.frameworkConflict === true);
check("Conflicting IPC declaration does not trigger legacy rules", parseSuppliedSections("IPC 420", "CURRENT_BNS_BNSS").forRules.length === 0);

console.log(`\nLegal-framework verification: ${passed} passed, 0 failed`);
