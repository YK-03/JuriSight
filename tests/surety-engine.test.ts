import assert from "node:assert/strict";
import { normalizeSuretyBounds } from "../lib/surety-engine";

const reversed = normalizeSuretyBounds(50000, 19000);
assert.equal(reversed.min, 19000);
assert.equal(reversed.max, 50000);

const alreadyOrdered = normalizeSuretyBounds(19000, 50000);
assert.equal(alreadyOrdered.min, 19000);
assert.equal(alreadyOrdered.max, 50000);

const equal = normalizeSuretyBounds(50000, 50000);
assert.equal(equal.min, 50000);
assert.equal(equal.max, 50000);

const invalid = normalizeSuretyBounds(Number.NaN, undefined);
assert.equal(invalid.min, 10000);
assert.equal(invalid.max, 50000);
