import { asc, desc, eq, sql } from "drizzle-orm";
import { REVIEW_REASONS } from "@/app/api/entries/_lib/review";
import type { Db } from "../../db/client";
import { entries, events, photos, reports, responders } from "../../db/schema";
import { EntryConfirm } from "../contracts/schemas";

// The hub's second look list, docs/SPEC.md sections 5 and 6. It lists entries
// the responder left in needs_review. Staff settle them through
// PATCH /api/entries/[id], which confirms and audits, or ask for photos here.
// Callers pass the database so tests can use their own file.

type EntryRow = typeof entries.$inferSelect;
type ConfirmedClass = NonNullable<EntryRow["damage_class"]>;

export type ReviewEntry = {
  id: string;
  number: number;
  household_head: string | null;
  barangay: string;
  purok: string | null;
  responder_name: string;
  created_at: string;
  /** The responder's class. */
  damage_class: ConfirmedClass | null;
  note: string | null;
  people: number;
  hurt: number;
  missing: number;
  /** The counts in the linked family report, null when there is none. */
  report_people: number | null;
  report_hurt: number | null;
  report_missing: number | null;
  /** The stored reason, in the long form the entries route writes or the short form of the seed. */
  review_reason: string | null;
  /** When staff noted an ask for photos that is still open. */
  photos_asked_at: string | null;
  /** Everything PATCH /api/entries/[id] needs except the class. */
  confirm: Omit<EntryConfirm, "damage_class">;
};

/** An event type for the audit trail. Not a HubEvent: nothing listens for it yet. */
export const PHOTOS_REQUESTED = "entry.photos_requested";

/**
 * When staff last asked for photos and the ask still stands. A photo added or
 * a new needs_review after the request answers it, so staff can ask again.
 */
const pendingAsk = (entryId: unknown) => sql<string | null>`(
  select max(r.at) from ${events} r
  where r.entity = 'entry' and r.entity_id = ${entryId} and r.type = ${PHOTOS_REQUESTED}
    and not exists (
      select 1 from ${events} e
      where e.entity = 'entry' and e.entity_id = r.entity_id and e.type in ('entry.photo_added', 'entry.needs_review') and e.at > r.at
    )
)`;

const columns = {
  entry: entries,
  responder_name: responders.name,
  report_people: reports.people,
  report_hurt: reports.hurt,
  report_missing: reports.missing,
  photos_asked_at: pendingAsk(entries.id),
};

type ReviewRow = {
  entry: EntryRow;
  responder_name: string;
  report_people: number | null;
  report_hurt: number | null;
  report_missing: number | null;
  photos_asked_at: string | null;
};

function toReviewEntry(row: ReviewRow): ReviewEntry {
  const e = row.entry;
  return {
    id: e.id,
    number: e.number,
    household_head: e.household_head,
    barangay: e.barangay,
    purok: e.purok,
    responder_name: row.responder_name,
    created_at: e.created_at,
    damage_class: e.damage_class,
    // The responder's note is audio only. Nothing transcribes it, so the card only says there is one.
    note: e.note_path ? "Left a voice note." : null,
    people: e.people,
    hurt: e.hurt,
    missing: e.missing,
    report_people: row.report_people,
    report_hurt: row.report_hurt,
    report_missing: row.report_missing,
    review_reason: e.review_reason,
    photos_asked_at: row.photos_asked_at,
    confirm: {
      // The entry keeps null while it is unset, the contract has no null.
      material: e.material ?? "unknown",
      hazards: e.hazards,
      families: e.families,
      people: e.people,
      hurt: e.hurt,
      missing: e.missing,
      needs: e.needs,
    },
  };
}

/** Entries waiting for a second look, the newest first, as the canvas lists them. */
export function listReviewEntries(db: Db): ReviewEntry[] {
  return db
    .select(columns)
    .from(entries)
    .innerJoin(responders, eq(responders.id, entries.responder_id))
    .leftJoin(reports, eq(reports.id, entries.report_id))
    .where(eq(entries.status, "needs_review"))
    .orderBy(desc(entries.created_at), desc(entries.number))
    .all()
    .map(toReviewEntry);
}

export type ReviewPhoto = { id: string; label: string | null };

/** The photos of one entry, in the order they were taken. */
export function listReviewPhotos(db: Db, entryId: string): ReviewPhoto[] {
  return db
    .select({ id: photos.id, label: photos.label })
    .from(photos)
    .where(eq(photos.entry_id, entryId))
    .orderBy(asc(photos.taken_at), asc(photos.id))
    .all();
}

/* ---------- Labels, pure ---------- */

export type Tone = "danger" | "warning" | "success" | "muted-soft";

export const CLASS_LABELS: Record<ConfirmedClass, string> = {
  none: "No damage",
  partial: "Partially damaged",
  total: "Totally damaged",
};

const CLASS_TONES: Record<ConfirmedClass, Tone> = { none: "success", partial: "warning", total: "danger" };

/** "Approve totally damaged", the canvas wording. */
const approveLabel = (c: ConfirmedClass) => `Approve ${CLASS_LABELS[c].toLowerCase()}`;

const SHORT_REASONS: Record<keyof typeof REVIEW_REASONS, string> = {
  hurt_differs: "Hurt count differs",
};

export const GENERIC_REASON = "Needs a second look";

/** The dot on each reason pill. A hurt count that differs is the one that can cost a life. */
export function reasonTone(label: string): Tone {
  if (label === SHORT_REASONS.hurt_differs) return "danger";
  return "warning";
}

/**
 * Why an entry needs review, as the short labels on the list. The entries route
 * stores the long sentences from REVIEW_REASONS, joined. The seed stores one
 * short label. Anything else is shown as stored, and no reason gets a generic one.
 */
export function reasonLabels(stored: string | null): string[] {
  const text = stored?.trim();
  if (!text) return [GENERIC_REASON];
  const keys = (Object.keys(REVIEW_REASONS) as (keyof typeof REVIEW_REASONS)[]).filter((k) => text.includes(REVIEW_REASONS[k]));
  return keys.length > 0 ? keys.map((k) => SHORT_REASONS[k]) : [text];
}

export type Side = { label: string; tone: Tone; text: string };

/** The responder side: their class and their note. The counts are on CountLine rows. */
export function responderSide(entry: Pick<ReviewEntry, "damage_class" | "note">): Side {
  const cls = entry.damage_class;
  return {
    label: cls ? CLASS_LABELS[cls] : "No class chosen",
    tone: cls ? CLASS_TONES[cls] : "muted-soft",
    text: entry.note || "No note.",
  };
}

/** One number a card shows under its text, such as Hurt 2. */
export type CountLine = { label: string; value: string };

type CountEntry = Pick<ReviewEntry, "people" | "hurt" | "missing" | "report_people" | "report_hurt" | "report_missing" | "review_reason">;

const COUNT_FIELDS = [
  { label: "People", own: "people", report: "report_people" },
  { label: "Hurt", own: "hurt", report: "report_hurt" },
  { label: "Missing", own: "missing", report: "report_missing" },
] as const;

/**
 * The counts the review is about. Hurt shows whenever the reason says it differs,
 * and people or missing show when they differ from the family report.
 */
function comparedCounts(entry: CountEntry) {
  const hurtReason = reasonLabels(entry.review_reason).includes(SHORT_REASONS.hurt_differs);
  return COUNT_FIELDS.filter(({ label, own, report }) => (label === "Hurt" && hurtReason) || (entry[report] !== null && entry[report] !== entry[own])).map(
    ({ label, own, report }) => ({ label, own: entry[own], report: entry[report] }),
  );
}

/**
 * The counts under the responder's card: their own, then the family report's
 * for the same fields. A report that is not linked says so.
 */
export function responderCounts(entry: CountEntry): CountLine[] {
  return comparedCounts(entry).flatMap(({ label, own, report }) => [
    { label, value: String(own) },
    { label: `Family report, ${label.toLowerCase()}`, value: report === null ? "Not linked" : String(report) },
  ]);
}

export type ReviewAction = { label: string; body: EntryConfirm };

/**
 * The Approve button: it sends the responder's values and class. The body is
 * checked against the contract, so a bad row throws here and not in the route.
 */
export function reviewActions(entry: ReviewEntry): { approve: ReviewAction | null } {
  const approve = entry.damage_class ? { label: approveLabel(entry.damage_class), body: EntryConfirm.parse({ ...entry.confirm, damage_class: entry.damage_class }) } : null;
  return { approve };
}

/* ---------- Ask for photos ---------- */

export type AskForPhotosResult = { ok: true; already: boolean } | { ok: false; error: "not_found" | "not_in_review" };

/**
 * Keeps the entry in needs_review and writes the request to the audit trail.
 * Asking again while the first request stands writes nothing, so a double tap
 * leaves one row. Nothing reads the row yet: staff still tell the responder.
 */
export function askForPhotos(db: Db, entryId: string, now: Date = new Date()): AskForPhotosResult {
  const entry = db.select({ id: entries.id, status: entries.status }).from(entries).where(eq(entries.id, entryId)).get();
  if (!entry) return { ok: false, error: "not_found" };
  if (entry.status !== "needs_review") return { ok: false, error: "not_in_review" };

  return db.transaction((tx) => {
    if (tx.select({ at: pendingAsk(entryId) }).from(sql`(select 1)`).get()?.at) return { ok: true, already: true } as const;
    tx.insert(events)
      .values({ entity: "entry", entity_id: entryId, type: PHOTOS_REQUESTED, actor: "staff", data: {}, at: now.toISOString() })
      .run();
    return { ok: true, already: false } as const;
  });
}
