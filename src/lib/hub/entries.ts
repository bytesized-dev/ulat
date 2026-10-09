import { and, asc, desc, eq, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../../db/client";
import { entries, events, photos, reports, responders } from "../../db/schema";
import { ConfirmedDamageClass } from "../contracts/schemas";
import { likePattern } from "./safe";

// docs/SPEC.md sections 3 and 4. What the hub entries pages read: a paged,
// filtered list and one entry with its photos and history.
// Callers pass the database so tests can use their own file. Server only.

export const ENTRIES_PER_PAGE = 10;

/** The filters in the URL. A bad value is dropped, so a hand-edited link still opens the list. */
const EntryQuery = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  damage_class: ConfirmedDamageClass.optional().catch(undefined),
  barangay: z.string().trim().max(120).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
});
export type EntryQuery = z.infer<typeof EntryQuery>;
export type EntryFilters = Omit<EntryQuery, "page">;

/** Reads the page and filters from a page's searchParams. */
export function parseEntryQuery(params: Record<string, string | string[] | undefined>): EntryQuery {
  const first = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key]);
  return EntryQuery.parse({
    page: first("page"),
    damage_class: first("damage_class"),
    barangay: first("barangay") || undefined,
    q: first("q") || undefined,
  });
}

export type EntryListRow = {
  id: string;
  number: number;
  household_head: string | null;
  barangay: string;
  damage_class: z.infer<typeof ConfirmedDamageClass> | null;
  people: number;
  hurt: number;
  responder: string | null;
  confirmed_at: string | null;
};

export type EntryPage = {
  rows: EntryListRow[];
  total: number;
  /** The page shown, which is the last page when the one asked for is past the end. */
  page: number;
  pages: number;
  per_page: number;
};

/** A LIKE pattern that matches the text as typed, so a % or _ in a name is not a wildcard. */
const contains = (column: SQL | AnyColumn, text: string) =>
  sql`${column} like ${likePattern(text)} escape '\\'`;

/** Confirmed entries, newest first. Only confirmed entries reach the hub lists and totals. */
export function listEntries(db: Db, query: Partial<EntryQuery> = {}, perPage = ENTRIES_PER_PAGE): EntryPage {
  const search = query.q
    ? or(
        contains(entries.household_head, query.q),
        contains(entries.barangay, query.q),
        contains(entries.purok, query.q),
        contains(sql`printf('%04d', ${entries.number})`, query.q),
      )
    : undefined;
  const filters: (SQL | undefined)[] = [
    eq(entries.status, "confirmed"),
    query.damage_class ? eq(entries.damage_class, query.damage_class) : undefined,
    query.barangay ? eq(entries.barangay, query.barangay) : undefined,
    search,
  ];
  const where = and(...filters);

  const total = db.select({ n: sql<number>`count(*)` }).from(entries).where(where).get()?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(query.page ?? 1, pages);
  const rows = db
    .select({
      id: entries.id,
      number: entries.number,
      household_head: entries.household_head,
      barangay: entries.barangay,
      damage_class: entries.damage_class,
      people: entries.people,
      hurt: entries.hurt,
      responder: responders.name,
      confirmed_at: entries.confirmed_at,
    })
    .from(entries)
    .leftJoin(responders, eq(entries.responder_id, responders.id))
    .where(where)
    .orderBy(desc(entries.confirmed_at), desc(entries.number))
    .limit(perPage)
    .offset((page - 1) * perPage)
    .all();
  return { rows, total, page, pages, per_page: perPage };
}

export type HistoryItem = { label: string; at: string };

export type EntryDetail = {
  entry: typeof entries.$inferSelect;
  responder: string | null;
  photos: { id: string; label: string | null }[];
  report: {
    code: string;
    reporter_name: string | null;
    /** True when people, hurt and missing are the same in the report and the entry. */
    counts_match: boolean;
  } | null;
  history: HistoryItem[];
};

const firstName = (name: string) => name.split(" ")[0] ?? name;

const FIELD_NAMES: Record<string, string> = {
  damage_class: "damage",
  material: "material",
  hazards: "hazards",
  families: "families",
  people: "people",
  hurt: "hurt",
  missing: "missing",
  needs: "needs",
};

/** One entry with everything the detail page shows, or null when the id is unknown. Any status, so staff can open a draft from the review list. */
export function getEntryDetail(db: Db, id: string): EntryDetail | null {
  const entry = db.select().from(entries).where(eq(entries.id, id)).get();
  if (!entry) return null;

  // Actors in the audit trail are responder ids, "staff" or "system". A responder
  // who is no longer in the table is still named, never shown as an id.
  const names = new Map(db.select({ id: responders.id, name: responders.name }).from(responders).all().map((r) => [r.id, r.name]));
  const who = (actor: string) => names.get(actor) ?? (actor === "staff" ? "Staff" : actor === "system" ? "System" : "Responder");

  const rows = db
    .select()
    .from(events)
    .where(and(eq(events.entity, "entry"), eq(events.entity_id, id)))
    .orderBy(asc(events.at))
    .all();

  const report = entry.report_id ? db.select().from(reports).where(eq(reports.id, entry.report_id)).get() : undefined;

  const history: HistoryItem[] = [];
  if (report) history.push({ label: "Family report", at: report.created_at });
  // Older rows may hold AI photo events. No screen shows them.
  for (const e of rows.filter((r) => !r.type.startsWith("ai."))) {
    const field = FIELD_NAMES[String(e.data?.field)] ?? String(e.data?.field);
    const label =
      e.type === "entry.created"
        ? `Taken by ${firstName(who(e.actor))}`
        : e.type === "entry.photo_added"
          ? `Photo added by ${firstName(who(e.actor))}`
          : e.type === "entry.field_changed"
            ? `Changed ${field} by ${firstName(who(e.actor))}`
            : e.type === "entry.needs_review"
              ? `Sent for review by ${firstName(who(e.actor))}`
              : e.type === "entry.confirmed"
                ? "Confirmed"
                : e.type.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());
    history.push({ label, at: e.at });
  }
  history.sort((a, b) => a.at.localeCompare(b.at));

  return {
    entry,
    responder: names.get(entry.responder_id) ?? null,
    photos: db
      .select({ id: photos.id, label: photos.label })
      .from(photos)
      .where(eq(photos.entry_id, id))
      .orderBy(asc(photos.taken_at), sql`${photos}.rowid`)
      .all(),
    report: report
      ? {
          code: report.code,
          reporter_name: report.reporter_name,
          counts_match: report.people === entry.people && report.hurt === entry.hurt && report.missing === entry.missing,
        }
      : null,
    history,
  };
}
