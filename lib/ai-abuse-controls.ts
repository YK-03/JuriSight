export class RequestLimitError extends Error {
  constructor(message = "Request is too large") {
    super(message);
    this.name = "RequestLimitError";
  }
}

export class AbuseControlUnavailableError extends Error {
  constructor() {
    super("AI abuse controls are temporarily unavailable. Please try again shortly.");
    this.name = "AbuseControlUnavailableError";
  }
}

export type AbuseLimit = {
  name: string;
  maxRequests: number;
  windowMs: number;
  maxConcurrent: number;
};

type Counter = { startedAt: number; requests: number; active: number };

export interface AbuseControlStore {
  check(key: string, limit: AbuseLimit, now?: number): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
    release: () => Promise<void>;
  }>;
}

class MemoryAbuseControlStore implements AbuseControlStore {
  private readonly counters = new Map<string, Counter>();

  async check(key: string, limit: AbuseLimit, now = Date.now()) {
    const existing = this.counters.get(`${limit.name}:${key}`);
    const counter = !existing || now - existing.startedAt >= limit.windowMs
      ? { startedAt: now, requests: 0, active: 0 }
      : existing;
    const retryAfterSeconds = Math.max(1, Math.ceil((counter.startedAt + limit.windowMs - now) / 1000));
    if (counter.requests >= limit.maxRequests || counter.active >= limit.maxConcurrent) {
      this.counters.set(`${limit.name}:${key}`, counter);
      return { allowed: false, retryAfterSeconds, release: async () => undefined };
    }

    counter.requests += 1;
    counter.active += 1;
    this.counters.set(`${limit.name}:${key}`, counter);
    let released = false;
    return {
      allowed: true,
      retryAfterSeconds,
      release: async () => {
        if (released) return;
        released = true;
        counter.active = Math.max(0, counter.active - 1);
      },
    };
  }
}

class PrismaAbuseControlStore implements AbuseControlStore {
  async check(key: string, limit: AbuseLimit, now = Date.now()) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const bucketKey = `${limit.name}:${key}`;
          const current = new Date(now);
          const existing = await tx.aiAbuseBucket.findUnique({ where: { key: bucketKey } });
          const expired = !existing || now - existing.windowStartedAt.getTime() >= limit.windowMs;
          const windowStartedAt = expired ? current : existing.windowStartedAt;
          const requestCount = expired ? 0 : existing.requestCount;
          const activeCount = expired ? 0 : existing.activeCount;
          const retryAfterSeconds = Math.max(1, Math.ceil((windowStartedAt.getTime() + limit.windowMs - now) / 1000));

          if (requestCount >= limit.maxRequests || activeCount >= limit.maxConcurrent) {
            await tx.aiAbuseBucket.upsert({
              where: { key: bucketKey },
              create: { key: bucketKey, windowStartedAt, requestCount, activeCount },
              update: { windowStartedAt, requestCount, activeCount },
            });
            return { allowed: false, retryAfterSeconds, release: async () => undefined };
          }

          await tx.aiAbuseBucket.upsert({
            where: { key: bucketKey },
            create: { key: bucketKey, windowStartedAt, requestCount: requestCount + 1, activeCount: activeCount + 1 },
            update: { windowStartedAt, requestCount: requestCount + 1, activeCount: activeCount + 1 },
          });
          let released = false;
          return {
            allowed: true,
            retryAfterSeconds,
            release: async () => {
              if (released) return;
              released = true;
              try {
                await prisma.aiAbuseBucket.updateMany({
                  // A request that crosses a window boundary must not release a
                  // slot belonging to the next window.
                  where: { key: bucketKey, windowStartedAt, activeCount: { gt: 0 } },
                  data: { activeCount: { decrement: 1 } },
                });
              } catch {
                // Do not expose request contents or provider details in limiter errors.
              }
            },
          };
        }, { isolationLevel: "Serializable" });
      } catch (error: any) {
        if (error?.code === "P2034" && attempt < 2) continue;
        throw new AbuseControlUnavailableError();
      }
    }
    throw new AbuseControlUnavailableError();
  }
}

let testStore: AbuseControlStore | null = null;
let localStore: AbuseControlStore | null = null;

export function setAbuseControlStoreForTests(store: AbuseControlStore | null) {
  testStore = store;
}

function getStore(): AbuseControlStore {
  if (testStore) return testStore;
  if (process.env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL) {
      throw new AbuseControlUnavailableError();
    }
    if (!localStore) localStore = new PrismaAbuseControlStore();
    return localStore;
  }
  if (!(localStore instanceof MemoryAbuseControlStore)) localStore = new MemoryAbuseControlStore();
  return localStore;
}

export function getRequestIdentity(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  // Forwarded headers are ignored unless the deployment explicitly trusts its proxy.
  if (process.env.TRUSTED_PROXY_HEADERS === "true") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return `ip:${forwarded}`;
  }
  return "anonymous";
}

export async function acquireAIAbuseControl(
  request: Request,
  limit: AbuseLimit,
  userId?: string | null,
) {
  const result = await getStore().check(getRequestIdentity(request, userId), limit);
  if (!result.allowed) {
    return new Response(JSON.stringify({ error: "Too many AI requests. Please try again later." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
      },
    });
  }
  return result.release;
}

export function assertContentLength(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number.isFinite(Number(contentLength)) && Number(contentLength) > maxBytes) {
    throw new RequestLimitError();
  }
}

export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  assertContentLength(request, maxBytes);
  const reader = request.body?.getReader();
  if (!reader) throw new RequestLimitError("Request body is required");

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new RequestLimitError();
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Invalid request body");
  }
}

export function assertBoundedString(value: unknown, maxLength: number, field: string): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new RequestLimitError(`${field} exceeds the permitted length`);
  }
  return value;
}

export function assertRecordStringLengths(value: unknown, maxLength: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const [field, fieldValue] of Object.entries(value)) {
    if (typeof fieldValue === "string") assertBoundedString(fieldValue, maxLength, field);
  }
}

export const AI_LIMITS = {
  analyze: { name: "analyze", maxRequests: 10, windowMs: 60_000, maxConcurrent: 2 },
  guestEligibility: { name: "guest-eligibility", maxRequests: 5, windowMs: 60_000, maxConcurrent: 1 },
  chat: { name: "chat", maxRequests: 30, windowMs: 60_000, maxConcurrent: 3 },
  extractDocument: { name: "extract-document", maxRequests: 5, windowMs: 60_000, maxConcurrent: 1 },
  bailStrategy: { name: "bail-strategy", maxRequests: 10, windowMs: 60_000, maxConcurrent: 2 },
} as const;

export const AI_REQUEST_MAX_BYTES = {
  analyze: 128 * 1024,
  guestEligibility: 32 * 1024,
  chat: 128 * 1024,
  bailStrategy: 128 * 1024,
  extractDocument: 11 * 1024 * 1024,
} as const;
import prisma from "./db";

