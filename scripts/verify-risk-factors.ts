/**
 * Risk-factor contract checks. No live Groq call.
 *
 * Run with: npx tsx scripts/verify-risk-factors.ts
 */

import {
  isNearDuplicateText,
  normalizeRiskFactors,
  normalizeRiskSeverity,
  toAnalysisRiskFactors,
} from "../lib/risk-factors";

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

const VIKRAM_FACTS = `
Accused name: Vikram Malhotra
Statutory sections / offences: IPC Sections 420 (Cheating), 468 (Forgery)
Alleged economic loss of ₹45 Lakhs in a commercial transaction
Allegations concern forged documents and cheating
Investigation is still pending
Anticipatory bail sought
Prosecution concern about influencing witnesses or tampering with documentary evidence
`;

const VIKRAM_VALID = [
  {
    title: "Potential evidence or witness interference",
    description:
      "The investigation involving Vikram Malhotra is still pending and the allegations concern forged documents. The prosecution may therefore seek conditions addressing possible interference with documentary evidence or witnesses.",
    severity: "HIGH",
  },
  {
    title: "Alleged economic loss of ₹45 Lakhs",
    description:
      "The case attributes a ₹45 Lakhs commercial loss to the cheating allegations against Vikram Malhotra. The prosecution can argue that this scale supports stricter surety and reporting conditions on anticipatory bail.",
    severity: "HIGH",
  },
  {
    title: "Forgery and cheating allegations",
    description:
      "IPC Sections 468 and 420 are the supplied offence sections. Those forgery and cheating allegations, while not themselves a bail bar, are likely to be cited in support of higher surety.",
    severity: "MEDIUM",
  },
];

const VIKRAM_DUPLICATE_TEXT_ONLY = [
  { text: "Potential tampering with forged documents or influencing witnesses", level: "HIGH" },
  {
    text: "Economic loss of ₹45 Lakhs may prompt the court to impose strict bail conditions",
    level: "HIGH",
  },
  {
    text: "Seriousness of forgery (Section 468) and cheating (Section 420) could lead to higher bail surety",
    level: "MEDIUM",
  },
];

console.log("\nRisk-factor contract");

{
  const truncatedTitle = "Potential tampering with forged documents or influencing ...";
  const description = "Potential tampering with forged documents or influencing witnesses";
  assert(
    "Current UI duplication pattern is detected as near-duplicate",
    isNearDuplicateText(truncatedTitle, description),
  );
}

{
  const normalized = normalizeRiskFactors(
    [
      {
        title: "Potential evidence or witness interference",
        description: "Potential evidence or witness interference",
        severity: "HIGH",
      },
    ],
    { caseFacts: VIKRAM_FACTS },
  );
  assert("Identical title and description are rejected", normalized.length === 0);
}

{
  const normalized = normalizeRiskFactors(
    [
      {
        title: "Potential evidence or witness interference.",
        description: "potential evidence or witness interference",
        severity: "high",
      },
    ],
    { caseFacts: VIKRAM_FACTS },
  );
  assert("Punctuation/casing-only restatements are rejected", normalized.length === 0);
}

{
  const normalized = normalizeRiskFactors(VIKRAM_VALID, { caseFacts: VIKRAM_FACTS });
  assert("Valid Vikram factors are kept", normalized.length === 3, "Got " + normalized.length);
  for (const factor of normalized) {
    assert(
      `Title is distinct from description: ${factor.title}`,
      !isNearDuplicateText(factor.title, factor.description),
    );
    assert(
      `Description is a meaningful explanation: ${factor.title}`,
      factor.description.length >= 48 && factor.description.split(/\s+/).length >= 12,
    );
    assert(
      `Severity is LOW|MEDIUM|HIGH: ${factor.title}`,
      factor.severity === "LOW" || factor.severity === "MEDIUM" || factor.severity === "HIGH",
    );
  }
  assert(
    "Vikram factors are distinct from one another",
    new Set(normalized.map((factor) => factor.title)).size === normalized.length,
  );
  assert(
    "Vikram factors stay grounded in supplied facts",
    normalized.some((factor) => /45/.test(factor.description)) &&
      normalized.some((factor) => /468|420|forged/i.test(factor.description)) &&
      normalized.some((factor) => /Vikram|Malhotra|witness/i.test(factor.description)),
  );
  console.log("\n  Vikram Malhotra normalized structure:");
  console.log(JSON.stringify(normalized, null, 2));
}

{
  const rejected = normalizeRiskFactors(VIKRAM_DUPLICATE_TEXT_ONLY, { caseFacts: VIKRAM_FACTS });
  assert(
    "Legacy single-text risks are not stored as truncated title + same description",
    rejected.every((factor) => !isNearDuplicateText(factor.title, factor.description)),
  );
  assert(
    "Legacy single-text Vikram payload does not survive as three duplicate cards",
    rejected.length === 0,
    "Got " + JSON.stringify(rejected),
  );
}

{
  const duplicates = normalizeRiskFactors(
    [
      VIKRAM_VALID[0],
      {
        title: "Possible witness interference",
        description:
          "The investigation involving Vikram Malhotra is still pending and the allegations concern forged documents. The prosecution may therefore seek conditions addressing possible interference with documentary evidence or witnesses.",
        severity: "HIGH",
      },
      VIKRAM_VALID[1],
    ],
    { caseFacts: VIKRAM_FACTS },
  );
  assert(
    "Near-duplicate underlying factors are collapsed",
    duplicates.filter((factor) => /interfer|tamper|witness/i.test(factor.title)).length === 1,
    "Got " + duplicates.map((factor) => factor.title).join(" | "),
  );
}

{
  const generic = normalizeRiskFactors(
    [
      {
        title: "Flight risk",
        description: "The court may impose strict bail conditions.",
        severity: "MEDIUM",
      },
    ],
    { caseFacts: VIKRAM_FACTS },
  );
  assert("Generic ungrounded boilerplate is rejected", generic.length === 0);
}

{
  const mapped = toAnalysisRiskFactors(VIKRAM_VALID as any);
  assert("UI mapping keeps title as the card heading", mapped[0].label === VIKRAM_VALID[0].title);
  assert("UI mapping does not truncate the title with ellipsis", !mapped[0].label.includes("..."));
  assert("UI mapping keeps a distinct description", mapped[0].description !== mapped[0].label);
}

{
  assert("normalizeRiskSeverity('high') => HIGH", normalizeRiskSeverity("high") === "HIGH");
  assert("normalizeRiskSeverity('Low') => LOW", normalizeRiskSeverity("Low") === "LOW");
  assert("normalizeRiskSeverity('maybe') => MEDIUM", normalizeRiskSeverity("maybe") === "MEDIUM");
}

{
  const leftover = normalizeRiskFactors(VIKRAM_VALID, { caseFacts: VIKRAM_FACTS });
  assert(
    "Normalizer does not attach a numeric risk score (score stays deterministic elsewhere)",
    leftover.every((factor) => !("riskScore" in factor)),
  );
}

console.log("\n" + "-".repeat(50));
console.log("Risk-factor verification: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exit(1);
