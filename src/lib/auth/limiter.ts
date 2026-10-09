/**
 * A small in-memory limiter for the PIN routes, one bucket per client
 * address. The routes call beginAttempt before their first await, so an
 * attempt counts while its scrypt check is still running. Failures plus
 * attempts in flight never pass MAX_FAILURES, which keeps a batch of parallel
 * requests from all being checked. After MAX_FAILURES wrong tries the bucket is
 * blocked for BLOCK_MS, and a correct PIN does not get through while it is
 * blocked. The state is lost when the server restarts, which is fine for a hub
 * on one laptop.
 */

export const MAX_FAILURES = 5;
export const BLOCK_MS = 30_000;
// Failures that are this old no longer count towards the limit.
const FAILURE_WINDOW_MS = 10 * 60_000;

type Bucket = { failures: number; inFlight: number; lastFailure: number; blockedUntil: number };

// On globalThis so every route bundle in dev shares the same buckets.
const globalForLimiter = globalThis as unknown as { ulatAuthBuckets?: Map<string, Bucket> };
const buckets = (globalForLimiter.ulatAuthBuckets ??= new Map<string, Bucket>());

/** The caller's address. Caddy sets x-forwarded-for, and its last entry is the one Caddy added. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || "direct";
}

/** Seconds left on a block, or 0 when the bucket is not blocked. */
export function blockedSeconds(key: string, now = Date.now()): number {
  const bucket = buckets.get(key);
  if (!bucket || bucket.blockedUntil <= now) return 0;
  return Math.ceil((bucket.blockedUntil - now) / 1000);
}

/** What to tell a refused caller: the time left on a block, or a full block while tries are still running. */
export function retryAfterSeconds(key: string, now = Date.now()): number {
  return blockedSeconds(key, now) || BLOCK_MS / 1000;
}

/**
 * Count an attempt before any await. Returns false when the bucket is blocked
 * or when failures plus attempts in flight already reach MAX_FAILURES. After a
 * true, call endAttempt exactly once.
 */
export function beginAttempt(key: string, now = Date.now()): boolean {
  for (const [other, b] of buckets) {
    if (b.inFlight === 0 && b.blockedUntil <= now && now - b.lastFailure > FAILURE_WINDOW_MS) buckets.delete(other);
  }
  const bucket = buckets.get(key) ?? { failures: 0, inFlight: 0, lastFailure: now, blockedUntil: 0 };
  buckets.set(key, bucket);
  if (bucket.blockedUntil > now) return false;
  if (bucket.failures + bucket.inFlight >= MAX_FAILURES) return false;
  bucket.inFlight += 1;
  return true;
}

/**
 * Settle an attempt. "wrong" counts a failure, "right" clears the count for
 * this bucket, and "none" releases it for a request that never checked a PIN.
 */
export function endAttempt(key: string, result: "wrong" | "right" | "none", now = Date.now()) {
  const bucket = buckets.get(key);
  if (!bucket) return;
  bucket.inFlight = Math.max(0, bucket.inFlight - 1);
  if (result === "right") {
    bucket.failures = 0;
  } else if (result === "wrong") {
    bucket.failures += 1;
    bucket.lastFailure = now;
    if (bucket.failures >= MAX_FAILURES) {
      bucket.failures = 0;
      bucket.blockedUntil = now + BLOCK_MS;
    }
  }
}

/** For tests. */
export function resetLimiter() {
  buckets.clear();
}
