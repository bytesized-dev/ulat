import { z } from "zod";

// GET /api/updates has no response contract yet, so this reads only the two
// fields the home screen shows. Anything that does not fit is ignored.
const UpdateSummary = z.object({
  headline: z.string().min(1),
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
