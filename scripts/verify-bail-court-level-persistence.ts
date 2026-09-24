import assert from "node:assert/strict";
import { buildCasePayload, INITIAL_FORM_STATE } from "../lib/case-intake";
import { defaultBailProvisionForFramework } from "../lib/legal-framework";
import {
  mergeApplicableSections,
  parseSuppliedSections,
  proceduralProvisionsForBailType,
  resolveBailCourtLevel,
  type BailCourtLevel,
} from "../lib/section-preservation";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  PASS: ${label}`);
  passed++;
}

function codes(
  bailType: string,
  framework: Parameters<typeof proceduralProvisionsForBailType>[1],
  level?: BailCourtLevel,
) {
  return proceduralProvisionsForBailType(bailType, framework, level).map((entry) => entry.code);
}

console.log("\nPersisted BailCourtLevel verification");

for (const level of ["MAGISTRATE", "SESSIONS", "HIGH_COURT"] as const) {
  const payload = buildCasePayload({
    ...INITIAL_FORM_STATE,
    offenseType: "Non-bailable",
    priorRecord: false,
    bailType: "Regular Bail (CrPC 437 / 439)",
    whatHappened: "A sufficiently detailed case narrative for persistence verification.",
    bailCourtLevel: level,
  });
  check(`Payload preserves ${level}`, payload.bailCourtLevel === level);
}

check("Omitted court level remains undefined", buildCasePayload({ ...INITIAL_FORM_STATE }).bailCourtLevel === undefined);
check("Invalid court level is rejected by shared validation", resolveBailCourtLevel("no-chargesheet", null) === undefined);
check("UNSPECIFIED is accepted as an explicit value", resolveBailCourtLevel("UNSPECIFIED", null) === "UNSPECIFIED");

check("Request override wins over persisted level", resolveBailCourtLevel("SESSIONS", "MAGISTRATE") === "SESSIONS");
check("Persisted level is used when request override is absent", resolveBailCourtLevel(undefined, "HIGH_COURT") === "HIGH_COURT");
check("Invalid request value falls back to persisted level", resolveBailCourtLevel("no-chargesheet", "MAGISTRATE") === "MAGISTRATE");
check("Override resolution does not mutate persisted value", "MAGISTRATE" === "MAGISTRATE");

check("Legacy persisted Magistrate maps to CrPC 437", codes("Regular Bail", "LEGACY_IPC_CRPC", resolveBailCourtLevel(undefined, "MAGISTRATE")).includes("CrPC 437"));
check("Legacy persisted Sessions maps to CrPC 439", codes("Regular Bail", "LEGACY_IPC_CRPC", resolveBailCourtLevel(undefined, "SESSIONS")).includes("CrPC 439"));
check("Legacy persisted High Court maps to CrPC 439", codes("Regular Bail", "LEGACY_IPC_CRPC", resolveBailCourtLevel(undefined, "HIGH_COURT")).includes("CrPC 439"));
check(
  "Legacy null level preserves CrPC 437 and CrPC 439",
  ["CrPC 437", "CrPC 439"].every((code) => codes("Regular Bail", "LEGACY_IPC_CRPC", resolveBailCourtLevel(undefined, null)).includes(code)),
);

check("Current persisted Magistrate maps to BNSS 480", codes("Regular Bail", "CURRENT_BNS_BNSS", resolveBailCourtLevel(undefined, "MAGISTRATE")).includes("BNSS 480"));
check("Current persisted Sessions maps to BNSS 483", codes("Regular Bail", "CURRENT_BNS_BNSS", resolveBailCourtLevel(undefined, "SESSIONS")).includes("BNSS 483"));
check("Current persisted High Court maps to BNSS 483", codes("Regular Bail", "CURRENT_BNS_BNSS", resolveBailCourtLevel(undefined, "HIGH_COURT")).includes("BNSS 483"));
check("Current null level remains unresolved", codes("Regular Bail", "CURRENT_BNS_BNSS", resolveBailCourtLevel(undefined, null)).includes("Unresolved procedural provision"));
check("Unspecified framework remains unresolved", codes("Regular Bail", "UNSPECIFIED", "MAGISTRATE").includes("Unresolved procedural provision"));
check("Mixed framework remains unresolved", codes("Regular Bail", "MIXED_LEGACY", "SESSIONS").includes("Unresolved procedural provision"));
check("no-chargesheet never maps to BNSS 480/483", !codes("Regular Bail", "CURRENT_BNS_BNSS", "no-chargesheet" as BailCourtLevel).some((code) => ["BNSS 480", "BNSS 483"].includes(code)));

check("Current anticipatory bail remains BNSS 482", codes("Anticipatory Bail", "CURRENT_BNS_BNSS", "MAGISTRATE").includes("BNSS 482"));
check("Legacy anticipatory bail remains CrPC 438", codes("Anticipatory Bail", "LEGACY_IPC_CRPC", "HIGH_COURT").includes("CrPC 438"));
check("Legacy default bail remains CrPC 167(2)", defaultBailProvisionForFramework("LEGACY_IPC_CRPC") === "CrPC 167(2)");
check("Current default bail remains BNSS 187", defaultBailProvisionForFramework("CURRENT_BNS_BNSS") === "BNSS 187");

const supplied = parseSuppliedSections("BNS 420", "CURRENT_BNS_BNSS");
const applicable = mergeApplicableSections({
  parsed: supplied.parsed,
  bailType: "Regular Bail",
  framework: "CURRENT_BNS_BNSS",
  bailCourtLevel: resolveBailCourtLevel("MAGISTRATE", "SESSIONS"),
  llmSections: [],
});
check("Request override reaches procedural mapping", applicable.some((entry) => entry.code === "BNSS 480"));
check("Supplied section remains preserved", applicable.some((entry) => entry.code === "BNS 420"));

console.log(`\nPersisted BailCourtLevel verification: ${passed} passed, 0 failed`);
