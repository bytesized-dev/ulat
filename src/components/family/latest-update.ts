import { z } from "zod";
import { NewUpdate } from "@/lib/contracts";

// GET /api/updates has no read contract yet. The headline rule comes from
// NewUpdate, and posted_at is the one stored field the home screen adds. Fields
// beyond these two are ignored.
const UpdateSummary = NewUpdate.pick({ headline: true }).extend({
  posted_at: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
});
export type UpdateSummary = z.infer<typeof UpdateSummary>;

/** The newest update in a GET /api/updates body, which may be a list or `{ updates: [...] }`. */
export function latestUpdate(body: unknown): UpdateSummary | null {
  const list = Array.isArray(body) ? body : Array.isArray((body as { updates?: unknown } | null)?.updates) ? (body as { updates: unknown[] }).updates : [];
  let latest: UpdateSummary | null = null;
  for (const item of list) {
    const parsed = UpdateSummary.safeParse(item);
    if (parsed.success && (!latest || Date.parse(parsed.data.posted_at) > Date.parse(latest.posted_at))) latest = parsed.data;
  }
  return latest;
}
