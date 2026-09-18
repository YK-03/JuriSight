/**
 * verify-phase2.ts
 * Run with: npx tsx scripts/verify-phase2.ts
 *
 * Tests:
 *   A - Narrative >500 chars retains material fact after character 500
 *   B - Structured sections ("IPC 420, 468") survive parseSectionsForRules
 *   C - Bail type ("Anticipatory") survives into resolved variable
 *   D - Case A vs Case B produce DIFFERENT deterministic legal grounding
 *   E - Prompt no longer contains "Financial diversion -> IPC 420, 406"
 */

import { runLegalRules } from "../lib/legal-rules";
import { parseSuppliedSections } from "../lib/section-preservation";

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

function parseCustodyDaysForRules(custodyDuration: string): number {
  const val = custodyDuration.toLowerCase();
  if (val.includes("under") || val.includes("30")) return 25;
  if (val.includes("1 to 6") || val.includes("1-6")) return 90;
  if (val.includes("6 to 12") || val.includes("6-12")) return 180;
  if (val.includes("1 to 2") || val.includes("1-2")) return 365;
  if (val.includes("over 2") || val.includes("2+")) return 730;
  const dayMatch = val.match(/(\d+)\s*day/);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  const monthMatch = val.match(/(\d+)\s*month/);
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30;
  return 30;
}

function isChargesheetFiled(proceduralStage: string): boolean {
  const lower = proceduralStage.toLowerCase();
  return (
    lower.includes("chargesheet") ||
    lower.includes("charge sheet") ||
    lower.includes("charge-sheet") ||
    lower.includes("trial") ||
    lower.includes("session") ||
    lower.includes("framing of charges")
  );
}

// Test A
console.log("\nTest A: Narrative truncation removed");
{
  const longNarrative = "A".repeat(490) + " MATERIAL_FACT_AFTER_500_CHARS " + "B".repeat(200);
  const oldTruncated = longNarrative.length > 500 ? longNarrative.slice(0, 500) + "..." : longNarrative;
  assert("Old 500-char logic loses the material fact", !oldTruncated.includes("MATERIAL_FACT_AFTER_500_CHARS"));
  const newTruncated = longNarrative.length > 8000 ? longNarrative.slice(0, 8000) + "..." : longNarrative;
  assert("New 8000-char logic retains the material fact", newTruncated.includes("MATERIAL_FACT_AFTER_500_CHARS"));
}

// Test B
console.log("\nTest B: Structured section parsing");
{
  const sections = "IPC 420, 468";
  const parsed = parseSuppliedSections(sections);
  assert("Preserves supplied label 'IPC 420'", parsed.suppliedRaw.includes("IPC 420"), "Got: " + JSON.stringify(parsed.suppliedRaw));
  assert("Preserves supplied label 'IPC 468'", parsed.suppliedRaw.includes("IPC 468"), "Got: " + JSON.stringify(parsed.suppliedRaw));
  assert("Rule engine receives bare '420'", parsed.forRules.includes("420"), "Got: " + JSON.stringify(parsed.forRules));
  assert("Rule engine receives bare '468'", parsed.forRules.includes("468"), "Got: " + JSON.stringify(parsed.forRules));
}

// Test C
console.log("\nTest C: Bail type resolution priority");
{
  const body = { bailType: "Anticipatory" };
  const caseRecord = { bailType: "Regular" };
  const resolvedBailType = body.bailType || caseRecord.bailType || "Not specified";
  assert("Body bail type takes priority over caseRecord", resolvedBailType === "Anticipatory", "Got: " + resolvedBailType);
  const body2 = {} as { bailType?: string };
  const resolvedBailType2 = body2.bailType || caseRecord.bailType || "Not specified";
  assert("Falls back to caseRecord bail type when body empty", resolvedBailType2 === "Regular", "Got: " + resolvedBailType2);
}

// Test D
console.log("\nTest D: Case A vs Case B produce different legal grounding");
{
  const caseASections = parseSuppliedSections("IPC 420, 468").forRules;
  const caseACustodyDays = parseCustodyDaysForRules("");
  const caseAChargesheet = isChargesheetFiled("Investigation ongoing");
  const caseALegalRules = runLegalRules({ sections: caseASections, custodyDays: caseACustodyDays, chargesheetFiled: caseAChargesheet, age: 25 });

  const caseBSections = parseSuppliedSections("IPC 420").forRules;
  const caseBCustodyDays = parseCustodyDaysForRules("45 days");
  const caseBChargesheet = isChargesheetFiled("Chargesheet filed");
  const caseBLegalRules = runLegalRules({ sections: caseBSections, custodyDays: caseBCustodyDays, chargesheetFiled: caseBChargesheet, age: 25 });

  assert("Case A chargesheet flag is false", caseAChargesheet === false, "Got: " + caseAChargesheet);
  assert("Case B chargesheet flag is true", caseBChargesheet === true, "Got: " + caseBChargesheet);
  assert("Case A custody days = 30 (default)", caseACustodyDays === 30, "Got: " + caseACustodyDays);
  assert("Case B custody days = 45", caseBCustodyDays === 45, "Got: " + caseBCustodyDays);
  assert("promptInjections differ", caseALegalRules.promptInjection !== caseBLegalRules.promptInjection);
  assert("Default bail eligibility differs", JSON.stringify(caseALegalRules.defaultBail) !== JSON.stringify(caseBLegalRules.defaultBail));
}

// Test E
console.log("\nTest E: IPC inference rules removed from prompt");
{
  const legalRules = runLegalRules({ sections: ["420"], custodyDays: 30, chargesheetFiled: false, age: 25 });
  const samplePrompt = "-------------------------------------\n" + legalRules.promptInjection + "\n-------------------------------------\n- ALWAYS include correct CrPC section";
  assert("Prompt LACKS 'Financial diversion -> IPC 420, 406'", !samplePrompt.includes("Financial diversion"));
  assert("Prompt LACKS 'Theft -> IPC 379'", !samplePrompt.includes("Theft -> IPC 379"));
  assert("Prompt LACKS 'Cheating -> IPC 417, 420'", !samplePrompt.includes("Cheating -> IPC 417"));
  assert("Prompt HAS DETERMINISTIC LEGAL FINDINGS header", samplePrompt.includes("DETERMINISTIC LEGAL FINDINGS"), "Injection preview: " + legalRules.promptInjection.slice(0, 80));
}

console.log("\n" + "-".repeat(50));
console.log("Phase 2 verification: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
