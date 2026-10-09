import { asc, count, desc, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { safe_checkins } from "@/db/schema";

// The public safe list. A search returns only the name, barangay, where the
// person is staying and when they checked in. The message is for the desk and
// family, never for a stranger searching a name.

export { MIN_QUERY } from "./safe-query";
const SEARCH_LIMIT = 20;
const RECENT_LIMIT = 50;

const publicColumns = {
  name: safe_checkins.name,
  barangay: safe_checkins.barangay,
  staying_at: safe_checkins.staying_at,
  at: safe_checkins.at,
};

export type SafeResult = { name: string; barangay: string; staying_at: string; at: string };

/** Escapes LIKE wildcards so a search for "50%" or "a_b" matches those characters. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Name search, newest first. SQLite LIKE ignores ASCII case. */
export function searchSafe(db: Db, q: string): SafeResult[] {
  return db
    .select(publicColumns)
    .from(safe_checkins)
    .where(sql`${safe_checkins.name} like ${likePattern(q)} escape '\\'`)
    .orderBy(desc(safe_checkins.at))
    .limit(SEARCH_LIMIT)
    .all();
}

/** The latest check-ins, for the hub safe list before staff type a name. */
export function recentSafe(db: Db): SafeResult[] {
  return db.select(publicColumns).from(safe_checkins).orderBy(desc(safe_checkins.at)).limit(RECENT_LIMIT).all();
}

export type SafeCounts = { total: number; staying: { staying_at: string; count: number }[] };

/** Everyone on the list and how many are at each place, biggest first. Counted in SQL. */
export function safeCounts(db: Db): SafeCounts {
  const total = db.select({ n: count() }).from(safe_checkins).get()?.n ?? 0;
  const staying = db
    .select({ staying_at: safe_checkins.staying_at, count: count() })
    .from(safe_checkins)
    .groupBy(safe_checkins.staying_at)
    .orderBy(desc(count()), asc(safe_checkins.staying_at))
    .all();
  return { total, staying };
}
