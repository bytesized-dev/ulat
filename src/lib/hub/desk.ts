import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { places, reports, safe_checkins, settings } from "@/db/schema";
import { lastName } from "./desk-name";

// What the help desk page reads from the hub: the barangays and shelters to
// pick from, and the last things the desk filed.

const RECENT_LIMIT = 5;

/** The barangays staff set up, in the order they saved them. A missing or broken setting gives none. */
export function readBarangays(db: Db): string[] {
  const raw = db.select({ value: settings.value }).from(settings).where(eq(settings.key, "barangays")).get()?.value;
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const names = list.filter((n): n is string => typeof n === "string").map((n) => n.trim()).filter((n) => n !== "");
    return [...new Set(names)];
  } catch {
    return [];
  }
}

const ALWAYS = ["With relatives", "At home"];

/** Where a family can say they are staying: the shelters on the map, then the two places that are never on it. */
export function stayingOptions(db: Db): string[] {
  const shelters = db.select({ name: places.name }).from(places).where(and(eq(places.type, "shelter"), eq(places.visible, true))).all();
  return [...new Set([...shelters.map((s) => s.name.trim()).filter((n) => n !== ""), ...ALWAYS])];
}

export type DeskRecent = { kind: "report"; code: string; label: string; at: string } | { kind: "safe"; label: string; at: string };

/** The latest household reports and safe list check-ins the desk filed, newest first. */
export function recentDesk(db: Db): DeskRecent[] {
  const filed = db
    .select({ code: reports.code, head: reports.household_head, at: reports.created_at })
    .from(reports)
    .where(eq(reports.source, "desk"))
    .orderBy(desc(reports.created_at))
    .limit(RECENT_LIMIT)
    .all();
  const checkins = db
    .select({ name: safe_checkins.name, at: safe_checkins.at })
    .from(safe_checkins)
    .where(eq(safe_checkins.source, "desk"))
    .orderBy(desc(safe_checkins.at))
    .limit(RECENT_LIMIT)
    .all();
  const all: DeskRecent[] = [
    ...filed.map((r): DeskRecent => ({ kind: "report", code: r.code, label: lastName(r.head), at: r.at })),
    ...checkins.map((c): DeskRecent => ({ kind: "safe", label: `${lastName(c.name)}, safe list`, at: c.at })),
  ];
  return all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT_LIMIT);
}
