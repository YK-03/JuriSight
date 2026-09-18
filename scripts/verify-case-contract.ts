import assert from "node:assert/strict";
import { z } from "zod";
import { buildCasePayload, buildCaseDescription, IntakeFormState } from "../lib/case-intake";

// Schema matching app/api/cases/route.ts
const CaseCreateSchema = z.object({
  title: z.string().min(2),
  accusedName: z.string().min(1),
  section: z.string().min(1),
  offenseType: z.string().min(1),
  accusedProfile: z.string().min(1),
  priorRecord: z.boolean(),
  offenseDescription: z.string().min(10),
  cooperationLevel: z.string().min(1),
  jurisdiction: z.string().min(1),
  legalFramework: z.string().optional(),
  specialAct: z.string().optional(),
  bailType: z.string().optional(),
  proceduralStage: z.string().optional(),
  custodyStatus: z.string().optional(),
  previousBail: z.string().optional(),
  dateOfArrest: z.string().datetime().optional().nullable(),
  maximumSentenceYears: z.number().int().positive().optional().nullable(),
  timeServedDays: z.number().int().nonnegative().optional().nullable(),
});

console.log("==================================================");
console.log("Running JuriSight Flow 1 Data Contract Tests");
console.log("==================================================");

// Test 1: Case A (IPC 420 & 468, Anticipatory Bail, First-time offender, Notice 41A)
console.log("\n[Test 1] Case A: IPC 420 & 468, Anticipatory Bail, First-time offender");
const caseAInput: IntakeFormState = {
  caseTitle: "State vs. Rajesh Sharma",
  sections: "IPC 420, 468",
  offenseType: "Non-bailable",
  accusedName: "Rajesh Sharma",
  accusedProfile: "Director of private firm, local resident with family, no flight risk",
  priorRecord: false,
  bailType: "Anticipatory Bail (CrPC 438)",
  proceduralStage: "FIR registered, investigation ongoing, Notice u/s 41A CrPC issued",
  custodyStatus: "Not arrested / Pre-arrest",
  previousBail: "No prior bail application",
  cooperationLevel: "Cooperated in investigation (Notice complied with)",
  whatHappened: "Allegations of corporate cheating and forged invoices under IPC 420/468. Notice under 41A CrPC was received and complied with.",
  incidentDate: "March 2024",
  incidentLocation: "New Delhi",
  partiesInvolved: "Complainant: ABC Ltd, IO: Sub-Inspector Verma",
  evidenceDetails: "Bank statements, ledger records, compliance reply to 41A notice",
  legalQuestions: "Whether custodial interrogation is required when accused has joined investigation",
};

const payloadA = buildCasePayload(caseAInput);
const validatedA = CaseCreateSchema.parse(payloadA);

// Assert semantic correctness
assert.equal(validatedA.title, "State vs. Rajesh Sharma", "Title should match case title");
assert.equal(validatedA.section, "IPC 420, 468", "Section should contain actual IPC sections, NOT legal questions");
assert.notEqual(validatedA.section, caseAInput.legalQuestions, "Section must NOT be legalQuestions");
assert.equal(validatedA.offenseType, "Non-bailable", "OffenseType should be offense classification, NOT caseTitle");
assert.notEqual(validatedA.offenseType, caseAInput.caseTitle, "OffenseType must NOT be caseTitle");
assert.equal(validatedA.accusedName, "Rajesh Sharma", "Accused name should be extracted, NOT entire partiesInvolved");
assert.notEqual(validatedA.accusedName, caseAInput.partiesInvolved, "Accused name must NOT be partiesInvolved");
assert.equal(validatedA.priorRecord, false, "Prior record should be false for first-time offender");
assert.equal(validatedA.cooperationLevel, "Cooperated in investigation (Notice complied with)", "CooperationLevel must be cooperation, NOT proceduralStage");
assert.notEqual(validatedA.cooperationLevel, caseAInput.proceduralStage, "CooperationLevel must NOT be proceduralStage");
assert.equal(validatedA.proceduralStage, "FIR registered, investigation ongoing, Notice u/s 41A CrPC issued", "ProceduralStage must be preserved");
assert.equal(validatedA.bailType, "Anticipatory Bail (CrPC 438)", "BailType must be preserved");
assert.equal(validatedA.custodyStatus, "Not arrested / Pre-arrest", "CustodyStatus must be preserved");
assert.equal(validatedA.previousBail, "No prior bail application", "PreviousBail must be preserved");
console.log("✓ Case A assertions passed. All fields mapped semantically with zero corruption.");

// Test 2: Case B (IPC 420 only, ₹15L real estate, Has prior record, Custody >1mo, Prior bail rejected)
console.log("\n[Test 2] Case B: IPC 420 only, In Custody, Prior Record = true, Prior Rejection");
const caseBInput: IntakeFormState = {
  caseTitle: "State vs. Vikram Singh",
  sections: "IPC 420",
  offenseType: "Economic Offence",
  accusedName: "Vikram Singh",
  accusedProfile: "Real estate broker with previous commercial dispute",
  priorRecord: true,
  bailType: "Regular Bail (CrPC 437 / 439)",
  proceduralStage: "Charge sheet filed, trial pending",
  custodyStatus: "1 to 6 months in custody",
  previousBail: "Previous bail rejected / dismissed",
  cooperationLevel: "Cooperated in investigation",
  whatHappened: "Alleged diversion of Rs. 15 lakh in real estate project. In custody for 75 days.",
  incidentDate: "October 2023",
  incidentLocation: "Gurugram",
  partiesInvolved: "Complainant: Homebuyer group",
  evidenceDetails: "Agreement to sell, bank transfer receipts",
  legalQuestions: "Whether civil dispute has been criminalized",
};

const payloadB = buildCasePayload(caseBInput);
const validatedB = CaseCreateSchema.parse(payloadB);

assert.equal(validatedB.section, "IPC 420", "Section must be IPC 420");
assert.notEqual(validatedB.section, validatedA.section, "Case A and Case B sections must differ");
assert.equal(validatedB.priorRecord, true, "Prior record must be true when accused has record (not hardcoded false)");
assert.notEqual(validatedB.priorRecord, validatedA.priorRecord, "Prior record must differ between Case A and Case B");
assert.equal(validatedB.custodyStatus, "1 to 6 months in custody", "Custody status must reflect custody duration");
assert.equal(validatedB.previousBail, "Previous bail rejected / dismissed", "Previous bail rejection must be captured");
assert.notEqual(validatedB.previousBail, validatedA.previousBail, "Previous bail status must differ between Case A and Case B");
console.log("✓ Case B assertions passed. Distinct criminal facts cleanly differentiated.");

// Test 3: Minimal Input Fallbacks (User only fills required whatHappened)
console.log("\n[Test 3] Minimal input fallback behavior (Only whatHappened provided)");
const minimalInput: IntakeFormState = {
  caseTitle: "",
  sections: "",
  offenseType: "",
  accusedName: "",
  accusedProfile: "",
  priorRecord: false,
  bailType: "",
  proceduralStage: "",
  custodyStatus: "",
  previousBail: "",
  cooperationLevel: "",
  whatHappened: "A dispute arose regarding an commercial delivery contract and police summoned both parties.",
  incidentDate: "",
  incidentLocation: "",
  partiesInvolved: "",
  evidenceDetails: "",
  legalQuestions: "",
};

const payloadMinimal = buildCasePayload(minimalInput);
const validatedMinimal = CaseCreateSchema.parse(payloadMinimal);

assert.ok(validatedMinimal.title.length >= 2, "Title must satisfy min length");
assert.equal(validatedMinimal.accusedName, "Not specified", "Accused name has safe fallback");
assert.equal(validatedMinimal.section, "Not specified / Under investigation", "Section has safe fallback");
assert.equal(validatedMinimal.offenseType, "Non-bailable", "OffenseType has safe fallback");
assert.equal(validatedMinimal.priorRecord, false, "Prior record defaults to false");
assert.equal(validatedMinimal.jurisdiction, "Jurisdiction not specified", "Jurisdiction has safe fallback");
console.log("✓ Minimal input assertions passed. All Prisma Case required fields satisfied.");

// Test 4: Verify buildCaseDescription output
console.log("\n[Test 4] Case description text generation");
const descriptionA = buildCaseDescription(caseAInput);
assert.ok(descriptionA.includes("IPC 420, 468"), "Description includes sections");
assert.ok(descriptionA.includes("Rajesh Sharma"), "Description includes accused name");
assert.ok(descriptionA.includes("Anticipatory Bail"), "Description includes bail framework");
assert.ok(descriptionA.includes("First-time offender"), "Description includes clean record status");
console.log("✓ Case description assertions passed.");

console.log("\n==================================================");
console.log("ALL 4 DATA CONTRACT TESTS PASSED SUCCESSFULLY!");
console.log("==================================================");
