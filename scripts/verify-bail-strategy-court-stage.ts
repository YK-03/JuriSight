import assert from "node:assert/strict";
import {
  isChargesheetFiledForBailStrategyStage,
  normalizeBailStrategyCourtStage,
} from "../lib/section-preservation";

let passed = 0;
function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`  PASS: ${label}`);
  passed++;
}

console.log("\nBail-strategy court-stage normalization");

check("magistrate normalizes to MAGISTRATE", normalizeBailStrategyCourtStage("magistrate") === "MAGISTRATE");
check("sessions normalizes to SESSIONS", normalizeBailStrategyCourtStage("sessions") === "SESSIONS");
check("high-court normalizes to HIGH_COURT", normalizeBailStrategyCourtStage("high-court") === "HIGH_COURT");
check("canonical MAGISTRATE remains MAGISTRATE", normalizeBailStrategyCourtStage("MAGISTRATE") === "MAGISTRATE");
check("canonical HIGH_COURT remains HIGH_COURT", normalizeBailStrategyCourtStage("HIGH_COURT") === "HIGH_COURT");
check("no-chargesheet remains a separate procedural status", normalizeBailStrategyCourtStage("no-chargesheet") === "no-chargesheet");
check("UNSPECIFIED uses the shared framework contract", normalizeBailStrategyCourtStage("UNSPECIFIED") === "UNSPECIFIED");
check("invalid court stage is rejected", normalizeBailStrategyCourtStage("trial-court") === null);
check("missing court stage is rejected", normalizeBailStrategyCourtStage(undefined) === null);

check("MAGISTRATE is treated as chargesheet-filed posture", isChargesheetFiledForBailStrategyStage("MAGISTRATE"));
check("SESSIONS is treated as chargesheet-filed posture", isChargesheetFiledForBailStrategyStage("SESSIONS"));
check("HIGH_COURT is treated as chargesheet-filed posture", isChargesheetFiledForBailStrategyStage("HIGH_COURT"));
check("no-chargesheet keeps chargesheetFiled false", !isChargesheetFiledForBailStrategyStage("no-chargesheet"));

console.log(`\nBail-strategy court-stage verification: ${passed} passed, 0 failed`);
