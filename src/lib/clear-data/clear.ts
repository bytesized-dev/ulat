import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { db } from "@/db/client";
import { uploadsPath } from "@/db/path";
import { duplicates, entries, events, photos, places, reports, safe_checkins, sitreps, updates } from "@/db/schema";

// SPEC section 10. Children first, so foreign keys hold. events and duplicates
// point at the rows below by entity and id with no foreign key, and every kind
// of row they can point at is wiped, so they go too. settings and responders
// are not here on purpose.
const wiped = {
  photos,
  entries,
  reports,
  events,
  duplicates,
  places,
  updates,
  safe_checkins,
  sitreps,
} satisfies Record<string, SQLiteTable>;

export type ClearedCounts = Record<keyof typeof wiped, number>;

/**
 * Wipes reports, entries, photos, updates, places, check-ins and sitreps, with
 * the audit events and duplicate flags that point at them, and the uploaded
 * photos and audio on disk. Keeps settings and responders. The rows go in one
 * transaction, so a failure leaves them all in place. The files go after it
 * commits, because a file cannot be rolled back.
 */
export function clearData(): ClearedCounts {
  const counts = db.transaction((tx) => {
    const result = {} as ClearedCounts;
    for (const [name, table] of Object.entries(wiped) as [keyof ClearedCounts, SQLiteTable][]) {
      result[name] = tx.delete(table).run().changes;
    }
    return result;
  });
  clearUploads();
  return counts;
}

/** Empties the uploads folder and keeps the folder, so the next upload has a place to land. */
function clearUploads(): void {
  let names: string[];
  try {
    names = readdirSync(uploadsPath);
  } catch {
    return; // No upload has happened yet.
  }
  for (const name of names) rmSync(join(uploadsPath, name), { recursive: true, force: true });
}
