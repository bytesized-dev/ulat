// How the phone spaces out its tries while entries wait. Each try re-uploads the
// oldest entry's photos, so a hub that keeps failing must not be asked every 5 s.

export const BACKOFF_BASE_MS = 5000;
export const BACKOFF_CAP_MS = 120_000;
/** A hub that asks for longer than this is not waited on, so a typo in the header cannot park the queue for hours. */
export const RETRY_AFTER_CAP_MS = 300_000;

/**
 * Wait before try number `attempt` (1 for the first failure): 5 s, 10 s, 20 s and so on up to
 * the cap. Half of it is fixed and half is random, so phones that failed together do not return together.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));
  return Math.round(ceiling / 2 + (random() * ceiling) / 2);
}

/** Reads a Retry-After header, in seconds or as a date, to milliseconds. Null when absent or unreadable. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  const text = value?.trim();
  if (!text) return null;
  const ms = /^\d+$/.test(text) ? Number(text) * 1000 : Date.parse(text) - now;
  return Number.isFinite(ms) ? Math.min(RETRY_AFTER_CAP_MS, Math.max(0, ms)) : null;
}

export type Backoff = {
  /** True when the next try may go out. */
  ready: () => boolean;
  /** A retryable failure. The hub's Retry-After can lengthen the wait, never shorten it. */
  failed: (retryAfterMs?: number | null) => void;
  /** Success, the network coming back, a new entry or a manual try. */
  reset: () => void;
  readonly attempts: number;
};

export function createBackoff(now: () => number = Date.now, random: () => number = Math.random): Backoff {
  let attempts = 0;
  let notBefore = 0;
  return {
    ready: () => now() >= notBefore,
    failed(retryAfterMs) {
      attempts += 1;
      notBefore = now() + Math.max(backoffDelay(attempts, random), retryAfterMs ?? 0);
    },
    reset() {
      attempts = 0;
      notBefore = 0;
    },
    get attempts() {
      return attempts;
    },
  };
}

/**
 * Whether this check may post the queue. The hub must answer and something must wait.
 * After a 401 nothing posts until the responder signs in again, and after a retryable
 * failure nothing posts until the backoff ends. A tap on Try again skips the backoff
 * wait, and also the 401 stop, because the responder may have signed in on another tab.
 */
export function mayFlush(input: { inRange: boolean; waiting: boolean; signedOut: boolean; backoffReady: boolean; manual: boolean }): boolean {
  if (!input.inRange || !input.waiting) return false;
  return input.manual || (!input.signedOut && input.backoffReady);
}
