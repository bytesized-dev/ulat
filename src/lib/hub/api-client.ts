import type { z } from "zod";
import type { EntryConfirm, NewPlace, NewUpdate } from "../contracts/schemas";

// Browser side of the hub's writes to POST /api/updates, POST /api/places and
// PATCH /api/entries/[id], docs/SPEC.md section 4. The first two return false when the write did not go through.

export type NewUpdateInput = z.infer<typeof NewUpdate>;
export type NewPlaceInput = z.infer<typeof NewPlace>;

async function send(path: string, body: unknown, fetcher: typeof fetch): Promise<boolean> {
  try {
    const res = await fetcher(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function postUpdate(update: NewUpdateInput, fetcher: typeof fetch = fetch): Promise<boolean> {
  return send("/api/updates", update, fetcher);
}

export function savePlace(place: NewPlaceInput, fetcher: typeof fetch = fetch): Promise<boolean> {
  return send("/api/places", place, fetcher);
}

export type ConfirmEntryResult = "ok" | "unauthorized" | "not_found" | "failed";

/** Settles an entry as staff. The route confirms it and audits every field that changed. */
export async function confirmEntry(entryId: string, body: EntryConfirm, fetcher: typeof fetch = fetch): Promise<ConfirmEntryResult> {
  try {
    const res = await fetcher(`/api/entries/${entryId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return "ok";
    if (res.status === 401) return "unauthorized";
    if (res.status === 404) return "not_found";
    return "failed";
  } catch {
    return "failed";
  }
}
