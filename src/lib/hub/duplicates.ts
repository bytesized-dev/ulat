import { and, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
import type { z } from "zod";
import { audit, setStatus, type Tx } from "@/app/api/reports/_lib/audit";
import type { Db } from "../../db/client";
import { duplicates, entries, events, reports } from "../../db/schema";
import type { HubEvent, Need } from "../contracts/schemas";
import { withoutHousehold } from "./desk-name";

// Possible duplicates, docs/SPEC.md section 6. Two reports, or a report and an
// entry, in the same barangay with the same household name, within 50 m when
// both have GPS. A trailing "household" is not part of the name, and a name
// that is only a surname ("Santiago household") also matches a full name that
// ends in it ("Pedro Santiago"). Plain SQL and TypeScript: the model never decides this.
// Callers pass the database so tests can use their own file.

export const DUPLICATE_RADIUS_M = 50;

type Side = "report" | "entry";
type Point = { lat: number; lng: number };

/** The name rule: lowercased and trimmed, so "  Ramil AQUINO " matches "ramil aquino". */
export const normalizeName = (value: string | null | undefined): string => (value ?? "").trim().toLowerCase();

/** The name rule with a trailing "household" dropped, so "Santiago household" reads "santiago". */
export const householdKey = (value: string | null | undefined): string => normalizeName(withoutHousehold(value ?? ""));

/** The surname a full name or a bare surname is filed under, the last word of its key. */
const surnameOf = (key: string): string => key.split(/\s+/).pop() ?? "";

/** Same household: the keys are equal, or one of them is a bare surname that ends the other. */
const sameHousehold = (a: string, b: string): boolean => a === b || !/\s/.test(a) || !/\s/.test(b);

const EARTH_RADIUS_M = 6_371_000;

/** Great circle distance in meters between two GPS fixes. */
export function distanceMeters(a: Point, b: Point): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const hasFix = (p: { lat: number | null; lng: number | null }): p is Point => p.lat !== null && p.lng !== null;

/** The same pair in either order gets the same key. */
const pairKey = (aType: Side, aId: string, bType: Side, bId: string) => [`${aType}:${aId}`, `${bType}:${bId}`].sort().join("|");

type Candidate = {
  type: Side;
  id: string;
  created_at: string;
  /** The report code, to order two reports created in the same instant. */
  code: string;
  /** householdKey of the name. */
  who: string;
  lat: number | null;
  lng: number | null;
  /** For an entry, the report it was opened from. Null for a report. */
  report_id: string | null;
};

/**
 * Looks for pairs that are not in the table yet and adds them as open. A pair
 * that is already there in any status is left alone, so a resolved pair is
 * never flagged a second time. Returns how many it added. Safe to run again.
 */
export function detectDuplicates(db: Db): number {
  return db.transaction((tx) => {
    const live = tx
      .select({ id: reports.id, code: reports.code, name: reports.household_head, barangay: reports.barangay, lat: reports.lat, lng: reports.lng, created_at: reports.created_at })
      .from(reports)
      .where(ne(reports.status, "merged"))
      .all();
    const moved = tx
      .select({ id: reports.id, merged_into: reports.merged_into })
      .from(reports)
      .where(and(eq(reports.status, "merged"), isNotNull(reports.merged_into)))
      .all();
    const rows = tx
      .select({ id: entries.id, name: entries.household_head, barangay: entries.barangay, lat: entries.lat, lng: entries.lng, created_at: entries.created_at, report_id: entries.report_id })
      .from(entries)
      .where(isNotNull(entries.household_head))
      .all();

    // A visit to a report's house is the normal flow, not a duplicate. After a
    // merge the entry still points at the merged report, so follow it.
    const mergedInto = new Map(moved.map((r) => [r.id, r.merged_into as string]));
    const home = (reportId: string | null) => (reportId ? (mergedInto.get(reportId) ?? reportId) : null);

    const buckets = new Map<string, Candidate[]>();
    const add = (name: string | null, barangay: string, candidate: Omit<Candidate, "who">) => {
      const who = householdKey(name);
      if (!who) return;
      const key = `${normalizeName(barangay)}\u0000${surnameOf(who)}`;
      buckets.set(key, [...(buckets.get(key) ?? []), { ...candidate, who }]);
    };
    for (const r of live) add(r.name, r.barangay, { type: "report", id: r.id, created_at: r.created_at, code: r.code, lat: r.lat, lng: r.lng, report_id: null });
    for (const e of rows) add(e.name, e.barangay, { type: "entry", id: e.id, created_at: e.created_at, code: "", lat: e.lat, lng: e.lng, report_id: home(e.report_id) });

    const known = new Set(tx.select().from(duplicates).all().map((d) => pairKey(d.a_type, d.a_id, d.b_type, d.b_id)));

    let added = 0;
    for (const group of buckets.values()) {
      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const [first, second] = [group[i], group[j]];
          if (first.type === "entry" && second.type === "entry") continue;
          if (!sameHousehold(first.who, second.who)) continue;
          // The report goes first. Two reports go oldest first, so side a keeps its code.
          const [a, b] =
            first.type !== second.type
              ? first.type === "report"
                ? [first, second]
                : [second, first]
              : [first, second].sort((x, y) => x.created_at.localeCompare(y.created_at) || x.code.localeCompare(y.code));
          if (b.type === "entry" && b.report_id === a.id) continue;

          const distance = hasFix(a) && hasFix(b) ? distanceMeters(a, b) : null;
          if (distance !== null && distance > DUPLICATE_RADIUS_M) continue;

          const key = pairKey(a.type, a.id, b.type, b.id);
          if (known.has(key)) continue;
          known.add(key);
          tx.insert(duplicates).values({ a_type: a.type, a_id: a.id, b_type: b.type, b_id: b.id, distance_m: distance, status: "open" }).run();
          added += 1;
        }
      }
    }
    return added;
  });
}

/* ---------- Reading the open pairs ---------- */

export type DuplicateSide = {
  type: Side;
  id: string;
  /** The report code, or the entry number as 0231. */
  label: string;
  household_head: string;
  barangay: string;
  purok: string | null;
  people: number;
  hurt: number;
  missing: number;
  needs: z.infer<typeof Need>[];
  /** When it was sent, and who sent it: family, neighbor, desk or responder. */
  sent_at: string;
  sent_by: string;
  lat: number | null;
  lng: number | null;
};

export type DuplicatePair = {
  id: string;
  distance_m: number | null;
  a: DuplicateSide;
  b: DuplicateSide;
  /** Only two reports can be merged. A report and an entry can be kept or dismissed. */
  mergeable: boolean;
};

const entryNumber = (n: number) => String(n).padStart(4, "0");

/** Open pairs with both sides, the one that came in first on top. A pair with a side that is gone is left out. */
export function listOpenDuplicates(db: Db): DuplicatePair[] {
  const open = db.select().from(duplicates).where(eq(duplicates.status, "open")).all();
  if (open.length === 0) return [];

  const reportIds = open.flatMap((d) => [d.a_type === "report" ? d.a_id : null, d.b_type === "report" ? d.b_id : null]).filter((v): v is string => v !== null);
  const entryIds = open.flatMap((d) => [d.a_type === "entry" ? d.a_id : null, d.b_type === "entry" ? d.b_id : null]).filter((v): v is string => v !== null);

  const sides = new Map<string, DuplicateSide>();
  if (reportIds.length) {
    for (const r of db.select().from(reports).where(inArray(reports.id, reportIds)).all()) {
      sides.set(`report:${r.id}`, {
        type: "report",
        id: r.id,
        label: r.code,
        household_head: r.household_head,
        barangay: r.barangay,
        purok: r.purok,
        people: r.people,
        hurt: r.hurt,
        missing: r.missing,
        needs: r.needs,
        sent_at: r.created_at,
        sent_by: r.source,
        lat: r.lat,
        lng: r.lng,
      });
    }
  }
  if (entryIds.length) {
    for (const e of db.select().from(entries).where(inArray(entries.id, entryIds)).all()) {
      sides.set(`entry:${e.id}`, {
        type: "entry",
        id: e.id,
        label: entryNumber(e.number),
        household_head: e.household_head ?? "",
        barangay: e.barangay,
        purok: e.purok,
        people: e.people,
        hurt: e.hurt,
        missing: e.missing,
        needs: e.needs,
        sent_at: e.created_at,
        sent_by: "responder",
        lat: e.lat,
        lng: e.lng,
      });
    }
  }

  const pairs: DuplicatePair[] = [];
  for (const d of open) {
    const a = sides.get(`${d.a_type}:${d.a_id}`);
    const b = sides.get(`${d.b_type}:${d.b_id}`);
    if (!a || !b) continue;
    pairs.push({ id: d.id, distance_m: d.distance_m, a, b, mergeable: a.type === "report" && b.type === "report" });
  }
  const latest = (p: DuplicatePair) => (p.a.sent_at > p.b.sent_at ? p.a.sent_at : p.b.sent_at);
  return pairs.sort((x, y) => latest(x).localeCompare(latest(y)) || x.id.localeCompare(y.id));
}

/* ---------- Labels, pure ---------- */

const NEED_LABELS: Record<z.infer<typeof Need>, string> = {
  water: "water",
  food: "food",
  tarp: "tarp",
  medicine: "medicine",
  hygiene_kit: "hygiene kit",
  baby_needs: "baby needs",
};

/** "Water, food, medicine", or "None" when nothing is listed. */
export function needsLabel(needs: readonly z.infer<typeof Need>[]): string {
  if (needs.length === 0) return "None";
  const text = needs.map((n) => NEED_LABELS[n]).join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "K9D2, family, Purok 3": what tells two sides with the same name apart. The purok is left out when there is none. */
export function sideLine(side: Pick<DuplicateSide, "label" | "sent_by" | "purok">): string {
  return [side.label, side.sent_by, side.purok?.trim()].filter(Boolean).join(", ");
}

/** "30 m apart", or "No GPS" when a side has no position to measure from. */
export function distanceLabel(distance: number | null): string {
  return distance === null ? "No GPS" : `${Math.round(distance)} m apart`;
}

/* ---------- Resolving ---------- */

type Failure = { ok: false; error: "not_found" | "already_resolved" | "not_mergeable" | "already_merged" };

/** One audit row under the report or entry the event is about. The events table has no duplicate entity. */
function logSide(tx: Tx | Db, side: Side, id: string, type: string, actor: string, data: Record<string, unknown>) {
  tx.insert(events).values({ entity: side, entity_id: id, type, actor, data, at: new Date().toISOString() }).run();
}

/** Keeps a note from each report. The same text twice is kept once. */
function joinNotes(...notes: (string | null)[]): string | null {
  const parts = [...new Set(notes.map((n) => n?.trim() ?? "").filter(Boolean))];
  return parts.length ? parts.join("\n\n") : null;
}

/**
 * Kept both, or one is a mistake. Only the pair changes: no report or entry is
 * touched, so the household stays on every list.
 */
export function resolveDuplicate(db: Db, id: string, status: "kept" | "mistake", actor: string): { ok: true } | Failure {
  return db.transaction((tx) => {
    const pair = tx.select().from(duplicates).where(eq(duplicates.id, id)).get();
    if (!pair) return { ok: false, error: "not_found" } as const;
    if (pair.status !== "open") return { ok: false, error: "already_resolved" } as const;

    tx.update(duplicates).set({ status, resolved_by: actor, resolved_at: new Date().toISOString() }).where(eq(duplicates.id, id)).run();
    logSide(tx, pair.a_type, pair.a_id, `duplicate.${status}`, actor, { duplicate_id: id, other: pair.b_id });
    logSide(tx, pair.b_type, pair.b_id, `duplicate.${status}`, actor, { duplicate_id: id, other: pair.a_id });
    return { ok: true } as const;
  });
}

export type MergeResult = { ok: true; kept: string; merged: string; events: HubEvent[] } | Failure;

/**
 * Merges the later report into the first. The first keeps its code, both notes
 * and the higher people, hurt and missing counts, and the union of the needs.
 * The later report stays in the table as merged with merged_into set, so its
 * code still resolves. Returns the live events for the caller to publish after
 * the transaction commits.
 */
export function mergeDuplicate(db: Db, id: string, actor: string): MergeResult {
  return db.transaction((tx) => {
    const pair = tx.select().from(duplicates).where(eq(duplicates.id, id)).get();
    if (!pair) return { ok: false, error: "not_found" } as const;
    if (pair.status !== "open") return { ok: false, error: "already_resolved" } as const;
    if (pair.a_type !== "report" || pair.b_type !== "report") return { ok: false, error: "not_mergeable" } as const;

    const found = tx.select().from(reports).where(inArray(reports.id, [pair.a_id, pair.b_id])).all();
    if (found.length !== 2) return { ok: false, error: "not_found" } as const;
    if (found.some((r) => r.status === "merged")) return { ok: false, error: "already_merged" } as const;

    const [first, later] = found.sort((x, y) => x.created_at.localeCompare(y.created_at) || x.code.localeCompare(y.code));
    const now = new Date().toISOString();
    const hurt = Math.max(first.hurt, later.hurt);
    const merged = {
      people: Math.max(first.people, later.people),
      hurt,
      missing: Math.max(first.missing, later.missing),
      needs: [...new Set([...first.needs, ...later.needs])],
      what_happened: joinNotes(first.what_happened, later.what_happened),
      transcript: joinNotes(first.transcript, later.transcript),
      transcript_en: joinNotes(first.transcript_en, later.transcript_en),
    };

    tx.update(reports).set({ ...merged, updated_at: now }).where(eq(reports.id, first.id)).run();
    audit(tx, first.id, "report.merged", actor, { duplicate_id: id, merged: later.code, hurt, people: merged.people, missing: merged.missing });
    const laterEvent = setStatus(tx, later, "merged", actor, { merged_into: first.id }, { duplicate_id: id, merged_into: first.code });

    tx.update(duplicates).set({ status: "merged", resolved_by: actor, resolved_at: now }).where(eq(duplicates.id, id)).run();
    // Other open pairs that name the merged report have nothing left to decide.
    // Detection flags the first report against the same neighbors if they still match.
    tx.update(duplicates)
      .set({ status: "merged", resolved_by: actor, resolved_at: now })
      .where(
        and(
          eq(duplicates.status, "open"),
          or(
            and(eq(duplicates.a_type, "report"), eq(duplicates.a_id, later.id)),
            and(eq(duplicates.b_type, "report"), eq(duplicates.b_id, later.id)),
          ),
        ),
      )
      .run();

    return {
      ok: true,
      kept: first.code,
      merged: later.code,
      events: [{ type: "report.updated", code: first.code, status: first.status }, laterEvent],
    } as const;
  });
}
