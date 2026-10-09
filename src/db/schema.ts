import { index, integer, real, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { z } from "zod";
import {
  CantAssessReason,
  Confidence,
  ConfirmedDamageClass,
  DamageClass,
  Language,
  Material,
  Need,
  PlaceType,
  ReportSource,
  ReportStatus,
  EntryStatus,
  SafeCheckin,
  UpdateType,
  AssessmentStatus,
  Urgency,
  type HubSummary,
} from "../lib/contracts/schemas";

// docs/SPEC.md section 3. IDs are UUID strings. Timestamps are ISO strings in
// UTC. Enum values come from the Zod enums in src/lib/contracts, so the
// database and the API bodies cannot drift apart.

/** Drizzle wants a non-empty tuple, and Zod types `.options` as a plain array. */
const values = <T extends string>(options: readonly T[]) => options as unknown as [T, ...T[]];

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());

/** Hub settings as key and value. Lists and objects are stored as JSON. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const responders = sqliteTable("responders", {
  id: id(),
  name: text("name").notNull(),
  team: text("team"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  /** Stored in lower case. A responder with no email or no password hash cannot sign in. */
  email: text("email").unique(),
  password_hash: text("password_hash"),
});

export const reports = sqliteTable(
  "reports",
  {
    id: id(),
    code: text("code").notNull().unique(),
    source: text("source", { enum: values(ReportSource.options) }).notNull(),
    household_head: text("household_head").notNull(),
    reporter_name: text("reporter_name"),
    reporter_where: text("reporter_where"),
    barangay: text("barangay").notNull(),
    purok: text("purok"),
    lat: real("lat"),
    lng: real("lng"),
    people: integer("people").notNull().default(0),
    hurt: integer("hurt").notNull().default(0),
    missing: integer("missing").notNull().default(0),
    what_happened: text("what_happened"),
    needs: text("needs", { mode: "json" }).$type<z.infer<typeof Need>[]>().notNull().$defaultFn(() => []),
    /** What a help desk voice note said, and its English. A family report has none. */
    transcript: text("transcript"),
    transcript_en: text("transcript_en"),
    language: text("language", { enum: values(Language.options) }),
    photo_path: text("photo_path"),
    /**
     * The hub's reading of the family photo, made in the background after the
     * report is saved. Null when there is no photo. A failed reading stores
     * unclear with low confidence, like an entry draft. Urgency is not stored:
     * src/lib/reports/assessment.ts computes it when a screen reads the report.
     */
    ai_status: text("ai_status", { enum: values(AssessmentStatus.options) }),
    ai_class: text("ai_class", { enum: values(DamageClass.options) }),
    ai_confidence: text("ai_confidence", { enum: values(Confidence.options) }),
    ai_reason: text("ai_reason"),
    ai_hazards: text("ai_hazards", { mode: "json" }).$type<string[]>(),
    /** When the reading was queued or finished, so a stalled one can be run again. */
    ai_at: text("ai_at"),
    /** A responder's or staff member's own reading. It wins over the AI on every screen and never changes a total. */
    verdict_class: text("verdict_class", { enum: values(ConfirmedDamageClass.options) }),
    verdict_urgency: text("verdict_urgency", { enum: values(Urgency.options) }),
    verdict_note: text("verdict_note"),
    /** A responder id, or "staff". */
    verdict_by: text("verdict_by"),
    verdict_at: text("verdict_at"),
    status: text("status", { enum: values(ReportStatus.options) }).notNull().default("waiting"),
    assigned_to: text("assigned_to").references(() => responders.id),
    cant_reason: text("cant_reason", { enum: values(CantAssessReason.options) }),
    cant_note: text("cant_note"),
    merged_into: text("merged_into").references((): AnySQLiteColumn => reports.id),
    /** Set by a phone so a resend of the same tap finds the report it already made. Null for seed and desk reports. */
    client_id: text("client_id"),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at").notNull(),
  },
  (t) => [index("reports_status_idx").on(t.status), uniqueIndex("reports_client_id_unique").on(t.client_id)],
);

export const entries = sqliteTable(
  "entries",
  {
    id: id(),
    /** Shown to people as 0231. */
    number: integer("number").notNull().unique(),
    report_id: text("report_id").references(() => reports.id),
    responder_id: text("responder_id")
      .notNull()
      .references(() => responders.id),
    barangay: text("barangay").notNull(),
    purok: text("purok"),
    household_head: text("household_head"),
    lat: real("lat"),
    lng: real("lng"),
    gps_accuracy_m: real("gps_accuracy_m"),
    /** More than 1 when families share a house. */
    families: integer("families").notNull().default(1),
    people: integer("people").notNull().default(0),
    hurt: integer("hurt").notNull().default(0),
    missing: integer("missing").notNull().default(0),
    needs: text("needs", { mode: "json" }).$type<z.infer<typeof Need>[]>().notNull().$defaultFn(() => []),
    material: text("material", { enum: values(Material.options) }),
    hazards: text("hazards", { mode: "json" }).$type<string[]>().notNull().$defaultFn(() => []),
    /** The responder's class. No AI reads a responder's photos, so there is no AI class here. */
    damage_class: text("damage_class", { enum: values(ConfirmedDamageClass.options) }).notNull(),
    /** The responder's voice note, kept as audio. Nothing transcribes it. */
    note_path: text("note_path"),
    /** Set when the entry is saved, confirmed or held for a second look. There is no default. */
    status: text("status", { enum: values(EntryStatus.options) }).notNull(),
    review_reason: text("review_reason"),
    confirmed_by: text("confirmed_by"),
    confirmed_at: text("confirmed_at"),
    /** Set by a phone so a resend of the same entry finds the one it already made. Null for seed entries. */
    client_id: text("client_id"),
    created_at: text("created_at").notNull(),
  },
  (t) => [index("entries_status_idx").on(t.status), uniqueIndex("entries_client_id_unique").on(t.client_id)],
);

export const photos = sqliteTable("photos", {
  id: id(),
  entry_id: text("entry_id").references(() => entries.id),
  report_id: text("report_id").references(() => reports.id),
  path: text("path").notNull(),
  label: text("label"),
  taken_at: text("taken_at"),
});

/** Which kind of row an audit event or a duplicate flag points at. */
export const eventEntities = ["report", "entry", "update", "place", "safe", "ai"] as const;
export const duplicateSides = ["report", "entry"] as const;
export const duplicateStatuses = ["open", "merged", "kept", "mistake"] as const;

/** The audit trail. Every write adds a row with the actor. */
export const events = sqliteTable("events", {
  id: id(),
  entity: text("entity", { enum: eventEntities }).notNull(),
  entity_id: text("entity_id").notNull(),
  type: text("type").notNull(),
  actor: text("actor").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, unknown>>(),
  at: text("at").notNull(),
});

export const places = sqliteTable("places", {
  id: id(),
  type: text("type", { enum: values(PlaceType.options) }).notNull(),
  name: text("name").notNull(),
  details: text("details"),
  when_text: text("when_text"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at").notNull(),
});

export const updates = sqliteTable("updates", {
  id: id(),
  type: text("type", { enum: values(UpdateType.options) }).notNull(),
  headline: text("headline").notNull(),
  message: text("message").notNull(),
  message_ceb: text("message_ceb"),
  message_tl: text("message_tl"),
  place_id: text("place_id"),
  expires_at: text("expires_at"),
  seen_count: integer("seen_count").notNull().default(0),
  posted_at: text("posted_at").notNull(),
});

export const safe_checkins = sqliteTable("safe_checkins", {
  id: id(),
  name: text("name").notNull(),
  barangay: text("barangay").notNull(),
  staying_at: text("staying_at").notNull(),
  message: text("message"),
  source: text("source", { enum: values(SafeCheckin.shape.source.options) }).notNull(),
  at: text("at").notNull(),
});

export const duplicates = sqliteTable("duplicates", {
  id: id(),
  a_type: text("a_type", { enum: duplicateSides }).notNull(),
  a_id: text("a_id").notNull(),
  b_type: text("b_type", { enum: duplicateSides }).notNull(),
  b_id: text("b_id").notNull(),
  distance_m: real("distance_m"),
  status: text("status", { enum: duplicateStatuses }).notNull().default("open"),
  resolved_by: text("resolved_by"),
  resolved_at: text("resolved_at"),
});

export const sitreps = sqliteTable("sitreps", {
  id: id(),
  number: integer("number").notNull().unique(),
  created_at: text("created_at").notNull(),
  /** The totals at the moment of the report. */
  snapshot: text("snapshot", { mode: "json" }).$type<HubSummary>().notNull(),
  sms: text("sms").notNull(),
});
