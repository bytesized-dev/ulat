import type { HubEvent } from "../contracts/schemas";

// Which live events change what the hub overview shows. A draft moves nothing:
// totals count confirmed entries only, and Latest lists reviews and confirmations.
// A saved place moves a relief, shelter or hazard pin on the map.
const OVERVIEW_EVENTS = new Set<HubEvent["type"]>(["report.created", "report.updated", "entry.needs_review", "entry.confirmed", "place.saved"]);

export function changesOverview(event: HubEvent | null): boolean {
  return event !== null && OVERVIEW_EVENTS.has(event.type);
}

/** Which live events change the second look list: an entry joins it or leaves it. */
export function changesReview(event: HubEvent | null): boolean {
  return event !== null && (event.type === "entry.needs_review" || event.type === "entry.confirmed");
}

/** Runs `fn` once, `ms` after the last call, so a burst of events costs one refetch. */
export function debounce(fn: () => void, ms: number): { call: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    call() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/** The newer of two summaries by `as_of`, so a late response never replaces fresher numbers. */
export function newerSummary<T extends { as_of: string }>(a: T | null, b: T): T {
  if (a === null) return b;
  return Date.parse(a.as_of) >= Date.parse(b.as_of) ? a : b;
}
