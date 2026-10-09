import { and, asc, desc, eq, sql } from "drizzle-orm";
import { REVIEW_REASONS } from "@/app/api/entries/_lib/review";
import type { Db } from "../../db/client";
import { entries, events, photos, reports, responders } from "../../db/schema";
import { EntryConfirm } from "../contracts/schemas";

// The hub's second look list, docs/SPEC.md sections 5 and 6. It lists entries
// the responder or the AI left in needs_review. Staff settle them through
// PATCH /api/entries/[id], which confirms and audits, or ask for photos here.
// Callers pass the database so tests can use their own file.

type EntryRow = typeof entries.$inferSelect;
type ConfirmedClass = NonNullable<EntryRow["damage_class"]>;
type AiClass = NonNullable<EntryRow["ai_class"]>;

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
  ai_class: AiClass | null;
  ai_reason: string | null;
  ai_need_more: string | null;
  note: string | null;
  hurt: number;
  /** The hurt count in the linked family report, null when there is none. */
  report_hurt: number | null;
  /** The stored reason, in the long form the entries route writes or the short form of the seed. */
  review_reason: string | null;
  /** When staff last asked the responder for photos. */
  photos_asked_at: string | null;
  /** Everything PATCH /api/entries/[id] needs except the class. */
  confirm: Omit<EntryConfirm, "damage_class">;
};

/** An event type for the audit trail. Not a HubEvent: nothing listens for it yet. */
export const PHOTOS_REQUESTED = "entry.photos_requested";

const askedAt = sql<string | null>`(select max(${events.at}) from ${events} where ${events.entity} = 'entry' and ${events.entity_id} = ${entries.id} and ${events.type} = ${PHOTOS_REQUESTED})`;

const columns = {
  entry: entries,
  responder_name: responders.name,
  report_hurt: reports.hurt,
  photos_asked_at: askedAt,
};

function toReviewEntry(row: { entry: EntryRow; responder_name: string; report_hurt: number | null; photos_asked_at: string | null }): ReviewEntry {
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
    ai_class: e.ai_class,
    ai_reason: e.ai_reason,
    ai_need_more: e.ai_need_more,
    note: e.note_en ?? e.note_transcript,
    hurt: e.hurt,
    report_hurt: row.report_hurt,
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
      new_photo_since_unclear: false,
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

export const CLASS_LABELS: Record<AiClass, string> = {
  none: "No damage",
  partial: "Partially damaged",
  total: "Totally damaged",
  unclear: "Not sure",
};

const CLASS_TONES: Record<AiClass, Tone> = { none: "success", partial: "warning", total: "danger", unclear: "muted-soft" };

/** "Approve totally damaged", the canvas wording. */
const approveLabel = (c: ConfirmedClass) => `Approve ${CLASS_LABELS[c].toLowerCase()}`;

const USE_LABELS: Record<ConfirmedClass, string> = { none: "Use no damage", partial: "Use partially", total: "Use totally" };

const SHORT_REASONS: Record<keyof typeof REVIEW_REASONS, string> = {
  class_differs: "Responder changed class",
  unclear_no_new_photo: "AI not sure",
  hurt_differs: "Hurt count differs",
};

export const GENERIC_REASON = "Needs a second look";

/** The dot on each reason pill. A hurt count that differs is the one that can cost a life. */
export function reasonTone(label: string): Tone {
  if (label === SHORT_REASONS.hurt_differs) return "danger";
  if (label === SHORT_REASONS.unclear_no_new_photo) return "muted-soft";
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

/** The AI draft side. The AI can say unclear, or never have drafted. */
export function aiSide(entry: Pick<ReviewEntry, "ai_class" | "ai_reason" | "ai_need_more">): Side {
  if (entry.ai_class === null) return { label: "No AI draft", tone: "muted-soft", text: "The AI did not draft this house." };
  if (entry.ai_class === "unclear") {
    return { label: CLASS_LABELS.unclear, tone: CLASS_TONES.unclear, text: entry.ai_need_more ?? entry.ai_reason ?? "The photos were not clear." };
  }
  return { label: CLASS_LABELS[entry.ai_class], tone: CLASS_TONES[entry.ai_class], text: entry.ai_reason ?? "" };
}

/** The responder side: their class, their note, and the hurt count when it differs from the family report. */
export function responderSide(entry: Pick<ReviewEntry, "damage_class" | "note" | "hurt" | "report_hurt">): Side {
  const cls = entry.damage_class;
  const hurt =
    entry.report_hurt !== null && entry.report_hurt !== entry.hurt ? `Hurt: ${entry.hurt}. The family report says ${entry.report_hurt}.` : null;
  const text = [entry.note, hurt].filter(Boolean).join(" ");
  return {
    label: cls ? CLASS_LABELS[cls] : "No class chosen",
    tone: cls ? CLASS_TONES[cls] : "muted-soft",
    text: text || "No note.",
  };
}

export type ReviewAction = { label: string; body: EntryConfirm };

/**
 * The two buttons that settle an entry. Approve sends the responder's values.
 * Use the AI class sends the same values with the class the AI drafted, and is
 * left out when the AI had no class or already agrees. The body is checked
 * against the contract, so a bad row throws here and not in the route.
 */
export function reviewActions(entry: ReviewEntry): { approve: ReviewAction | null; useAi: ReviewAction | null } {
  const build = (damage_class: ConfirmedClass) => EntryConfirm.parse({ ...entry.confirm, damage_class });
  const approve = entry.damage_class ? { label: approveLabel(entry.damage_class), body: build(entry.damage_class) } : null;
  const ai = entry.ai_class && entry.ai_class !== "unclear" ? entry.ai_class : null;
  const useAi = ai && ai !== entry.damage_class ? { label: USE_LABELS[ai], body: build(ai) } : null;
  return { approve, useAi };
}

/* ---------- Ask for photos ---------- */

export type AskForPhotosResult = { ok: true; already: boolean } | { ok: false; error: "not_found" | "not_in_review" };

/**
 * Keeps the entry in needs_review and writes the request to the audit trail.
 * Asking again while the first request stands writes nothing, so a double tap
 * leaves one row.
 */
export function askForPhotos(db: Db, entryId: string, now: Date = new Date()): AskForPhotosResult {
  const entry = db.select({ id: entries.id, status: entries.status, ai_need_more: entries.ai_need_more }).from(entries).where(eq(entries.id, entryId)).get();
  if (!entry) return { ok: false, error: "not_found" };
  if (entry.status !== "needs_review") return { ok: false, error: "not_in_review" };

  return db.transaction((tx) => {
    const asked = tx
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.entity, "entry"), eq(events.entity_id, entryId), eq(events.type, PHOTOS_REQUESTED)))
      .limit(1)
      .get();
    if (asked) return { ok: true, already: true } as const;
    tx.insert(events)
      .values({ entity: "entry", entity_id: entryId, type: PHOTOS_REQUESTED, actor: "staff", data: { need_more: entry.ai_need_more }, at: now.toISOString() })
      .run();
    return { ok: true, already: false } as const;
  });
}
