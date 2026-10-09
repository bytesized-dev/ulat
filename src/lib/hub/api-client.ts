import type { z } from "zod";
import type { NewPlace, NewUpdate } from "../contracts/schemas";

// Browser side of the hub's writes to POST /api/updates and POST /api/places,
// docs/SPEC.md section 4. False means it did not go through.

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
