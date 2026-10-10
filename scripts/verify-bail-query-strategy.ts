import assert from "node:assert/strict";
import {
  MAX_BAIL_AUTHORITY_QUERY_VARIANTS,
  buildBailAuthorityQuery,
  buildOptimizedProgressiveBailAuthorityQueries,
  buildProgressiveBailAuthorityQueries,
} from "../lib/authority-retrieval";
import { runBailScenarioDeterministicPipeline } from "../lib/evaluation/bail-evaluation";
import { evaluateBailQueryStrategy } from "../lib/evaluation/bail-query-strategy-evaluation";
import { bailStrategyScenarios } from "../lib/evaluation/bail-scenarios";

function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`PASS: ${label}`);
}

async function main() {
  const baseline = await evaluateBailQueryStrategy("baseline");
  const progressive = await evaluateBailQueryStrategy("progressive");
  const optimized = await evaluateBailQueryStrategy("optimized");

  check(
    "All required scenarios are included",
    bailStrategyScenarios.length >= 10 && bailStrategyScenarios.some((scenario) => scenario.id === "default-bail-range"),
  );
  check("Progressive query count stays bounded", progressive.maxQueriesObserved <= MAX_BAIL_AUTHORITY_QUERY_VARIANTS);
  check("Optimized query count stays bounded", optimized.maxQueriesObserved <= MAX_BAIL_AUTHORITY_QUERY_VARIANTS);
  check("Baseline uses one query per scenario", baseline.maxQueriesObserved === 1);
  check("Progressive strategy improves offline usable candidates", progressive.usableCandidates > baseline.usableCandidates);
  check("Progressive strategy reduces offline zero-result scenarios", progressive.zeroResultScenarios < baseline.zeroResultScenarios);
  check("Optimized strategy remains at least as relevant as current progressive strategy", optimized.queryIssueOverlap >= progressive.queryIssueOverlap);
  check("Offline evaluation makes zero network calls", baseline.totalNetworkCalls === 0 && progressive.totalNetworkCalls === 0 && optimized.totalNetworkCalls === 0);
  check("Deterministic eligibility remains unchanged", !baseline.deterministicEligibilityChanged && !progressive.deterministicEligibilityChanged && !optimized.deterministicEligibilityChanged);
  check("Fallback semantics remain represented", baseline.fallbackRate > 0 && progressive.fallbackRate === 0);

  for (const scenario of bailStrategyScenarios) {
    const { legalRules, authoritative } = runBailScenarioDeterministicPipeline(scenario);
    const baseQuery = buildBailAuthorityQuery({
      input: scenario.input,
      legalRules,
      authoritativeResult: authoritative,
      custodyDays: scenario.execution.custodyDays,
      chargesheetFiled: scenario.execution.chargesheetFiled,
    });
    const variants = buildProgressiveBailAuthorityQueries(baseQuery);
    const variantsAgain = buildProgressiveBailAuthorityQueries(baseQuery);
    const optimizedVariants = buildOptimizedProgressiveBailAuthorityQueries(baseQuery);
    const optimizedVariantsAgain = buildOptimizedProgressiveBailAuthorityQueries(baseQuery);
    const sections = scenario.input.sections.split(",").map((section) => section.trim()).filter(Boolean);

    check(`${scenario.id} query variants are deterministic`, JSON.stringify(variants) === JSON.stringify(variantsAgain));
    check(`${scenario.id} optimized query variants are deterministic`, JSON.stringify(optimizedVariants) === JSON.stringify(optimizedVariantsAgain));
    check(`${scenario.id} preserves core section identifiers`, variants.every((variant) => sections.every((section) => variant.queryText.includes(section))));
    check(`${scenario.id} optimized queries preserve sections and remove internal framework identifiers`, optimizedVariants.every((variant) =>
      sections.every((section) => variant.queryText.includes(section))
      && !/LEGACY_IPC_CRPC|CURRENT_BNS_BNSS|UNSPECIFIED/.test(variant.queryText)));
    check(`${scenario.id} removes procedural overload`, variants.every((variant) => !/custody \d+ days|chargesheet filed|court|prior bail/i.test(variant.queryText)));
    check(`${scenario.id} optimized queries remove procedural overload`, optimizedVariants.every((variant) => !/custody \d+ days|chargesheet filed|court|prior bail/i.test(variant.queryText)));
  }

  console.log("Bail query strategy verification passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
