import { evaluateAllBailScenarios } from "../lib/evaluation/bail-evaluation";

const summary = evaluateAllBailScenarios();
const passRate = summary.total === 0 ? 0 : (summary.passed / summary.total) * 100;

console.log("JuriSight Bail Strategy Evaluation");
console.log(`Total scenarios: ${summary.total}`);
console.log(`Passed: ${summary.passed}`);
console.log(`Failed: ${summary.failed}`);
console.log(`Pass rate: ${passRate.toFixed(1)}%`);
console.log(`Overall: ${summary.overallPassed ? "PASS" : "FAIL"}`);

const failures = summary.results.filter((result) => !result.passed);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const failure of failures) {
    console.log(`- Scenario: ${failure.scenarioId}`);
    console.log(`  Expected eligibility: ${failure.expectedEligibility}`);
    console.log(`  Actual eligibility: ${failure.actualEligibility}`);
    console.log(`  Expected authority: ${failure.expectedAuthority}`);
    console.log(`  Actual authority: ${failure.actualAuthority}`);
  }
}

process.exitCode = summary.overallPassed ? 0 : 1;

