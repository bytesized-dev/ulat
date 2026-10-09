import type { NewEntryMeta } from "@/lib/contracts";
import { newClientId } from "@/lib/client-id";
import { buildForm, buildMeta, type Gps, type House, sendError } from "./capture";

// One tap on Send on the online path. Kept apart from the screen so the id rules can be tested.

/**
 * The client id for one form. It is made on the first Send and every later tap reuses it,
 * even after the photos or the note changed, until the entry is known to be saved. The hub
 * answers a repeated id with the first entry, so a tap after a lost or unreadable reply
 * cannot make a second one. A different house starts over.
 */
export function createClientIds(make: () => string = newClientId) {
  let current: { house: string; id: string } | null = null;
  return {
    get(house: string): string {
      if (current?.house !== house) current = { house, id: make() };
      return current.id;
    },
    clear() {
      current = null;
    },
  };
}
export type ClientIds = ReturnType<typeof createClientIds>;

export const UNCLEAR_ANSWER = "The hub may already have this entry, but its answer did not arrive. Tap Send again to check. It will not make a second entry.";

export type SendOutcome =
  /** The hub took it, now or on an earlier try. */
  | { kind: "saved"; id: string }
  /** The hub said 2xx but the answer was unreadable, so the entry is probably saved. Send again with the same id to find out. */
  | { kind: "unclear" }
  /** The hub answered with an error. The same id stays, because a 5xx can come after the insert. */
  | { kind: "refused"; message: string }
  /** The hub never answered. The caller queues `meta`, which carries the id. */
  | { kind: "unreachable"; meta: NewEntryMeta }
  | { kind: "invalid" };

type Input = {
  house: House;
  labels: string[];
  gps: Gps | null;
  photos: File[];
  note: Blob | null;
  ids: ClientIds;
};

export async function sendEntry({ house, labels, gps, photos, note, ids }: Input, send: typeof fetch = fetch): Promise<SendOutcome> {
  const meta = buildMeta(house, labels, gps, ids.get(house.report_code ?? "new-house"));
  if (!meta.success) return { kind: "invalid" };
  try {
    const res = await send("/api/entries", { method: "POST", body: buildForm(meta.data, photos, note) });
    const body = (await res.json().catch(() => null)) as { id?: unknown; error?: string } | null;
    if (res.ok) {
      if (typeof body?.id !== "string") return { kind: "unclear" };
      ids.clear();
      return { kind: "saved", id: body.id };
    }
    return { kind: "refused", message: sendError(res.status, body?.error) };
  } catch {
    return { kind: "unreachable", meta: meta.data };
  }
}
