import type { LegalRuleOutput } from "./legal-rules";

function formatDefaultBail(output: LegalRuleOutput): string {
  const { defaultBail } = output;
  const eligibility =
    defaultBail.eligible === null
      ? "not computed"
      : defaultBail.eligible
        ? "yes"
        : "no";
  const daysServed = defaultBail.daysServed === null ? "unspecified" : String(defaultBail.daysServed);

  return `Default bail: eligible [${eligibility}], days served [${daysServed}], days required [${defaultBail.daysRequired}]. ${defaultBail.note}`;
}

/** Builds a deterministic explanation only when Groq does not provide one. */
export function buildDeterministicReasoning(
  legalRules: LegalRuleOutput,
  riskScore: number,
): string {
  const offenseLine = legalRules.offenseClass.supported
    ? `Offense classification: [${legalRules.offenseClass.bailable ? "bailable" : "non-bailable"}], severity: [${legalRules.offenseClass.severity}], primary section: [${legalRules.offenseClass.primarySection || "unspecified"}].`
    : `Offense classification: [unsupported / not determined by the deterministic rule table], primary section: [${legalRules.offenseClass.primarySection || "unspecified"}].`;
  const lines = [
    offenseLine,
    formatDefaultBail(legalRules),
  ];

  if (legalRules.ndpsBar) {
    lines.push(
      `NDPS Section 37: applies [${legalRules.ndpsBar.barApplies ? "yes" : "no"}], twin conditions required [${legalRules.ndpsBar.twinConditionsRequired ? "yes" : "no"}]. ${legalRules.ndpsBar.note}`,
    );
  }

  if (legalRules.pmlaConditions) {
    lines.push(
      `PMLA twin conditions: applies [${legalRules.pmlaConditions.applies ? "yes" : "no"}]. ${legalRules.pmlaConditions.note}`,
    );
  }

  if (legalRules.juvenile.isJuvenile) {
    lines.push(`Juvenile route: [${legalRules.juvenile.routeTo}]. ${legalRules.juvenile.note}`);
  }

  lines.push(`Deterministic risk score: [${riskScore}/100]. This is a separate risk indicator, not a statutory eligibility determination.`);
  return lines.join("\n");
}

export function resolveLegalReasoning(
  value: unknown,
  legalRules: LegalRuleOutput,
  riskScore: number,
): string {
  const reasoning = typeof value === "string" ? value.trim() : "";
  return reasoning || buildDeterministicReasoning(legalRules, riskScore);
}
