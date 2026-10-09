import { desc, gt, isNull, or } from "drizzle-orm";
import type { Db } from "../../db/client";
import { updates } from "../../db/schema";

// Reading posted updates. GET /api/updates and the hub updates page both use
// this, so families and staff see the same list. Writes live in the route.

export type PostedUpdate = typeof updates.$inferSelect;

/** Updates that have not expired, newest first. */
export function listUpdates(db: Db, now: string = new Date().toISOString()): PostedUpdate[] {
  return db
    .select()
    .from(updates)
    .where(or(isNull(updates.expires_at), gt(updates.expires_at, now)))
    .orderBy(desc(updates.posted_at))
    .all();
}
