import { z } from "zod";
import { NewUpdate, UpdateType } from "@/lib/contracts";

// GET /api/updates has no read contract yet. The text rules come from NewUpdate,
// and id and posted_at are the stored fields the list adds. Other fields are ignored.
const Update = NewUpdate.pick({ type: true, headline: true, message: true }).extend({
  id: z.string().min(1),
  posted_at: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
});
export type Update = z.infer<typeof Update>;

/** The updates in a GET /api/updates body, newest first. Items that do not fit are skipped. */
export function parseUpdates(body: unknown): Update[] {
  const list = (body as { updates?: unknown } | null)?.updates;
  if (!Array.isArray(list)) return [];
  const updates: Update[] = [];
  for (const item of list) {
    const parsed = Update.safeParse(item);
    if (parsed.success) updates.push(parsed.data);
  }
  return updates.sort((a, b) => Date.parse(b.posted_at) - Date.parse(a.posted_at));
}

type UpdateKind = z.infer<typeof UpdateType>;

/** The pill text for each kind, and whether its dot is blue, ink or gray. */
export const UPDATE_PILL: Record<UpdateKind, { label: string; dot: "primary" | "ink" | "muted-soft" }> = {
  water_food: { label: "Water", dot: "primary" },
  hazard: { label: "Hazard", dot: "ink" },
  shelter: { label: "Shelter", dot: "muted-soft" },
  notice: { label: "Notice", dot: "muted-soft" },
};
