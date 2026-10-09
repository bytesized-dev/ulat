import type { NewPlaceInput } from "./places";
import type { NewUpdateInput } from "./updates";

// Browser side of the hub's writes, on the paths in docs/SPEC.md section 4.
// The route handlers come in BYT-56 and wrap createUpdate and createPlace.
// Until then these return false and the screen says it could not post.

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
