import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  acquireAIAbuseControl,
  AbuseControlUnavailableError,
  AI_LIMITS,
  readJsonBody,
  RequestLimitError,
  setAbuseControlStoreForTests,
  type AbuseControlStore,
} from "../lib/ai-abuse-controls";

const root = resolve(__dirname, "..");
const routeText = (path: string) => readFileSync(resolve(root, path), "utf8");

function check(label: string, condition: boolean) {
  assert.equal(condition, true, label);
  console.log(`PASS: ${label}`);
}

for (const route of [
  "app/api/analyze/route.ts",
  "app/api/guest-eligibility/route.ts",
  "app/api/chat/route.ts",
  "app/api/extract-document/route.ts",
  "app/api/bail-strategy/route.ts",
]) {
  check(`${route} invokes abuse control`, /acquireAIAbuseControl/.test(routeText(route)));
}

const oversized = new Request("http://localhost/api/chat", {
  method: "POST",
  body: JSON.stringify({ message: "x".repeat(100) }),
  headers: { "content-type": "application/json" },
});
await assert.rejects(() => readJsonBody(oversized, 32), RequestLimitError);
check("Oversized streamed JSON body is rejected before parsing", true);

let seenKey = "";
const store: AbuseControlStore = {
  async check(key) {
    seenKey = key;
    return { allowed: true, retryAfterSeconds: 60, release: async () => undefined };
  },
};
setAbuseControlStoreForTests(store);
const request = new Request("http://localhost/api/guest-eligibility", {
  headers: { "x-forwarded-for": "203.0.113.10" },
});
const release = await acquireAIAbuseControl(request, AI_LIMITS.guestEligibility, "user-123");
check("Authenticated identity creates a user-scoped quota key", typeof release === "function" && seenKey === "user:user-123");
if (typeof release === "function") release();

const rejectingStore: AbuseControlStore = {
  async check() {
    return { allowed: false, retryAfterSeconds: 17, release: async () => undefined };
  },
};
setAbuseControlStoreForTests(rejectingStore);
const rejected = await acquireAIAbuseControl(new Request("http://localhost/api/guest-eligibility"), AI_LIMITS.guestEligibility);
check("Rate-limit rejection returns 429 with Retry-After", rejected instanceof Response && rejected.status === 429 && rejected.headers.get("Retry-After") === "17");

const failingStore: AbuseControlStore = {
  async check() {
    throw new Error("store unavailable");
  },
};
setAbuseControlStoreForTests(failingStore);
await assert.rejects(() => acquireAIAbuseControl(new Request("http://localhost/api/guest-eligibility"), AI_LIMITS.guestEligibility));
check("Rate-limit-store failure is not silently treated as allowed", true);

const previousNodeEnv = process.env.NODE_ENV;
const mutableEnv = process.env as Record<string, string | undefined>;
mutableEnv.NODE_ENV = "production";
setAbuseControlStoreForTests(null);
await assert.rejects(
  () => acquireAIAbuseControl(new Request("http://localhost/api/guest-eligibility"), AI_LIMITS.guestEligibility),
  AbuseControlUnavailableError,
);
mutableEnv.NODE_ENV = previousNodeEnv;
check("Production fails closed without a durable shared store", true);

// Keep the remainder of this script isolated from any shell-level NODE_ENV.
mutableEnv.NODE_ENV = "test";

let publicKey = "";
setAbuseControlStoreForTests({
  async check(key) {
    publicKey = key;
    return { allowed: true, retryAfterSeconds: 60, release: async () => undefined };
  },
});
delete process.env.TRUSTED_PROXY_HEADERS;
await acquireAIAbuseControl(new Request("http://localhost", { headers: { "x-forwarded-for": "198.51.100.10" } }), AI_LIMITS.guestEligibility);
check("Untrusted forwarding headers do not define client identity", publicKey === "anonymous");
process.env.TRUSTED_PROXY_HEADERS = "true";
await acquireAIAbuseControl(new Request("http://localhost", { headers: { "x-forwarded-for": "198.51.100.10" } }), AI_LIMITS.guestEligibility);
check("Trusted proxy mode uses the configured client IP", publicKey === "ip:198.51.100.10");
delete process.env.TRUSTED_PROXY_HEADERS;

setAbuseControlStoreForTests(null);
const firstLease = await acquireAIAbuseControl(new Request("http://localhost"), { ...AI_LIMITS.guestEligibility, name: "concurrency-test", maxRequests: 10, maxConcurrent: 1 });
const secondLease = await acquireAIAbuseControl(new Request("http://localhost"), { ...AI_LIMITS.guestEligibility, name: "concurrency-test", maxRequests: 10, maxConcurrent: 1 });
check("Concurrent requests are capped", typeof firstLease === "function" && secondLease instanceof Response && secondLease.status === 429);
if (typeof firstLease === "function") firstLease();

setAbuseControlStoreForTests(null);
check("Provider output is bounded", /max_tokens:\s*2048/.test(routeText("lib/groq.ts")));
check("Document text and chunk limits exist", /MAX_AI_DOCUMENT_TEXT/.test(routeText("lib/document-parser.ts")) && /MAX_AI_DOCUMENT_CHUNKS/.test(routeText("lib/document-parser.ts")));
check("Durable leases cannot release a slot from a later window", /windowStartedAt, activeCount: \{ gt: 0 \}/.test(routeText("lib/ai-abuse-controls.ts")));

console.log("AI abuse-control verification passed.");
