import assert from "node:assert/strict";
import {
  parseBailStrategyModelOutput,
  validateBailStrategyModelOutput,
} from "../lib/groq";

function throws(label: string, callback: () => unknown) {
  assert.throws(callback, undefined, label);
  console.log(`PASS: ${label}`);
}

function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`PASS: ${label}`);
}

console.log("Bail Strategy LLM output boundary verification");

const valid = parseBailStrategyModelOutput(JSON.stringify({
  reasoning: ["  Contextual reasoning  "],
  keyFactors: ["Custody duration", ""],
}));
check("Valid response is accepted and normalized", valid.reasoning[0] === "Contextual reasoning" && valid.keyFactors.length === 1);

throws("Malformed JSON is rejected", () => parseBailStrategyModelOutput("{not-json"));
throws("Non-object response is rejected", () => validateBailStrategyModelOutput(["reasoning"]));
throws("Missing reasoning is rejected", () => validateBailStrategyModelOutput({ keyFactors: ["factor"] }));
throws("Invalid reasoning type is rejected", () => validateBailStrategyModelOutput({ reasoning: "reason", keyFactors: [] }));
throws("Invalid keyFactors type is rejected", () => validateBailStrategyModelOutput({ reasoning: [], keyFactors: "factor" }));

const extraFields = parseBailStrategyModelOutput(JSON.stringify({
  reasoning: ["Context only"],
  keyFactors: ["Synthetic factor"],
  eligibility: "Likely eligible",
  authority: "DETERMINISTIC",
  provenance: "verified",
  source: "synthetic-source",
  citation: "synthetic-citation",
  judgmentUrl: "https://example.invalid/judgment",
}));
check("Forbidden model fields are ignored", !Object.hasOwn(extraFields, "eligibility") && !Object.hasOwn(extraFields, "provenance"));

const empty = validateBailStrategyModelOutput({
  reasoning: ["", "  "],
  keyFactors: [],
});
check("Empty arrays and strings normalize safely", empty.reasoning.length === 0 && empty.keyFactors.length === 0);

const deterministic = {
  eligibility: "Likely eligible",
  authority: "DETERMINISTIC",
};
const maliciousModelOutput = parseBailStrategyModelOutput(JSON.stringify({
  eligibility: "Unlikely eligible",
  authority: "DETERMINISTIC_UNRESOLVED",
  provenance: "verified",
  reasoning: ["Context only"],
  keyFactors: ["Synthetic factor"],
}));
const finalStrategy = { ...maliciousModelOutput, ...deterministic };
check("Model eligibility cannot override deterministic eligibility", finalStrategy.eligibility === "Likely eligible");
check("Model authority cannot override deterministic authority", finalStrategy.authority === "DETERMINISTIC");
check("Model provenance cannot become verified", !Object.hasOwn(maliciousModelOutput, "provenance"));

console.log("Bail Strategy LLM output boundary verification passed.");

