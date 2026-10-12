import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveAnalysisInput } from "../lib/case-analysis-input";

const root = resolve(__dirname, "..");
const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const shareRoute = readFileSync(resolve(root, "app/api/share/[id]/route.ts"), "utf8");

function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`PASS: ${label}`);
}

check("New cases default to private", /isPublic\s+Boolean\s+@default\(false\)/.test(schema));
check("Cases have a unique optional share token", /shareToken\s+String\?\s+@unique/.test(schema));
check("Public reads query by share token", /where:\s*\{ shareToken: shareToken \|\| undefined, isPublic: true \}/.test(shareRoute));
check("Public reads do not return rawAnalysis", !/rawAnalysis/.test(shareRoute));
check("Sharing requires authenticated opt-in", /export async function POST/.test(shareRoute) && /getOrCreateUser/.test(shareRoute));
check("Sharing can be revoked", /export async function DELETE/.test(shareRoute) && /shareToken: null/.test(shareRoute));

const request = {
  caseId: "case_1",
  whatHappened: "ATTACKER NARRATIVE",
  sections: "IPC 999",
  offenseType: "bailable",
  bailType: "Anticipatory Bail",
  cooperationLevel: "High",
};
const persisted = {
  title: "Persisted case",
  offenseDescription: "AUTHORITATIVE NARRATIVE",
  offenseType: "non-bailable",
  accusedName: "Persisted accused",
  accusedProfile: "No prior record",
  section: "IPC 420",
  cooperationLevel: "Low",
  jurisdiction: "Delhi",
  legalFramework: "LEGACY_IPC_CRPC" as const,
  bailType: "Regular Bail",
  proceduralStage: "Charge Sheet Filed",
  custodyStatus: "Over 6 months",
  previousBail: "none",
  priorRecord: false,
  timeServedDays: 210,
};
const resolved = resolveAnalysisInput(request, persisted);

check("Persisted narrative wins over request narrative", resolved.whatHappened === persisted.offenseDescription);
check("Persisted sections win over request sections", resolved.sections === persisted.section);
check("Persisted offense type wins over request offense type", resolved.offenseType === persisted.offenseType);
check("Persisted bail type wins over request bail type", resolved.bailType === persisted.bailType);
check("Persisted cooperation wins over request cooperation", resolved.cooperationLevel === persisted.cooperationLevel);
check("Direct analysis still accepts request facts", resolveAnalysisInput(request, null).whatHappened === request.whatHappened);

console.log("Case privacy and authoritative-facts verification passed.");
