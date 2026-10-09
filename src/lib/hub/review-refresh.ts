import type { HubEvent } from "../contracts/schemas";

/** Which live events change the second look list: an entry joins it or leaves it. */
export function changesReview(event: HubEvent | null): boolean {
  return event !== null && (event.type === "entry.needs_review" || event.type === "entry.confirmed");
}

/** The query flag that makes the page say another tab already settled an entry. */
export const SETTLED_PARAM = "settled";
