import { routes } from "@/lib/contracts/routes";

// Only the path of the hub is read from the address, never the host.
const base = "http://hub.invalid";

/**
 * Where to go after unlocking. Takes the next query parameter and returns a
 * path inside /hub, or /hub when it is missing, points anywhere else or points
 * back at the lock screen.
 */
export function safeNext(raw: string | string[] | null | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/")) return routes.hub.overview;
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return routes.hub.overview;
  }
  const inHub = url.pathname === routes.hub.overview || url.pathname.startsWith(`${routes.hub.overview}/`);
  const isLock = url.pathname.replace(/\/+$/, "") === routes.hub.lock;
  if (url.origin !== base || !inHub || isLock) return routes.hub.overview;
  return url.pathname + url.search;
}

/** The lock screen address that returns to the current page after unlocking. */
export function lockUrl(from: string): string {
  const next = safeNext(from);
  return next === routes.hub.overview ? routes.hub.lock : `${routes.hub.lock}?next=${encodeURIComponent(next)}`;
}
