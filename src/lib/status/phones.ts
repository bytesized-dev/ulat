import { isIP } from "node:net";

// Phones connected: distinct client IPs seen in the last two minutes. SPEC
// section 6 also counts open event streams, but a phone with an open stream
// is already one of these IPs, so adding the two would count it twice. An
// open stream keeps its IP fresh by calling markSeen on every ping instead.
//
// This module must stay free of the database, because /api/health uses it.

const WINDOW_MS = 2 * 60 * 1000;

// On globalThis for the same reason as the subscribers in src/lib/live/bus.ts:
// each route is bundled separately and Next reloads modules in dev.
const globalForPhones = globalThis as unknown as { ulatPhonesSeen?: Map<string, number> };
const seen: Map<string, number> = (globalForPhones.ulatPhonesSeen ??= new Map());

function isLoopback(ip: string): boolean {
  return ip === "::1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.");
}

/**
 * The phone's address. Caddy sets X-Forwarded-For, and its first entry is the
 * client. With no proxy, as under plain `pnpm dev`, there is no header and no
 * address, so the count reads 0.
 */
function clientIp(request: Request): string | null {
  const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first && isIP(first) !== 0 && !isLoopback(first) ? first : null;
}

function prune(now: number) {
  for (const [ip, at] of seen) {
    if (now - at >= WINDOW_MS) seen.delete(ip);
  }
}

/** Records the caller as a phone. Loopback and requests with no address are skipped. */
export function markSeen(request: Request, now = Date.now()): void {
  const ip = clientIp(request);
  if (ip === null) return;
  seen.set(ip, now);
  prune(now);
}

export function phoneCount(now = Date.now()): number {
  prune(now);
  return seen.size;
}
