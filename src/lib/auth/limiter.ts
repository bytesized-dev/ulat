/**
 * A small in-memory limiter for the PIN routes, one bucket per client address.
 * After MAX_FAILURES wrong tries the address is blocked for BLOCK_MS, and a
 * correct PIN does not get through while it is blocked. The state is lost when
 * the server restarts, which is fine for a hub on one laptop.
 */

export const MAX_FAILURES = 5;
export const BLOCK_MS = 30_000;
// Failures that are this old no longer count towards the limit.
const FAILURE_WINDOW_MS = 10 * 60_000;

type Bucket = { failures: number; lastFailure: number; blockedUntil: number };

// On globalThis so every route bundle in dev shares the same buckets.
const globalForLimiter = globalThis as unknown as { ulatAuthBuckets?: Map<string, Bucket> };
const buckets = (globalForLimiter.ulatAuthBuckets ??= new Map<string, Bucket>());

/** The caller's address. Caddy sets x-forwarded-for, and its last entry is the one Caddy added. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || "direct";
}

/** Seconds left on a block, or 0 when the address may try. */
export function blockedSeconds(key: string, now = Date.now()): number {
  const bucket = buckets.get(key);
  if (!bucket || bucket.blockedUntil <= now) return 0;
  return Math.ceil((bucket.blockedUntil - now) / 1000);
}

export function recordFailure(key: string, now = Date.now()) {
  for (const [other, b] of buckets) {
    if (b.blockedUntil <= now && now - b.lastFailure > FAILURE_WINDOW_MS) buckets.delete(other);
  }
  const bucket = buckets.get(key) ?? { failures: 0, lastFailure: now, blockedUntil: 0 };
  bucket.failures += 1;
  bucket.lastFailure = now;
  if (bucket.failures >= MAX_FAILURES) {
    bucket.failures = 0;
    bucket.blockedUntil = now + BLOCK_MS;
  }
  buckets.set(key, bucket);
}

export function recordSuccess(key: string) {
  buckets.delete(key);
}

/** For tests. */
export function resetLimiter() {
  buckets.clear();
}
