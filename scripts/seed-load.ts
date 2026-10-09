import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { map } from "../src/config";
import { db } from "../src/db/client";
import {
  duplicates,
  entries,
  events,
  photos,
  places,
  reports,
  responders,
  safe_checkins,
  settings,
  sitreps,
  updates,
} from "../src/db/schema";
import {
  Confidence,
  ConfirmedDamageClass,
  DamageClass,
  EntryStatus,
  Language,
  Material,
  Need,
  PlaceType,
  ReportCode,
  ReportSource,
  ReportStatus,
  SafeCheckin,
  UpdateType,
} from "../src/lib/contracts";
import { hashPin } from "../src/lib/pin";

// Loads seed/simulation.json, the same data the canvas shows. scripts/seed.ts
// runs it for db:seed and scripts/demo-reset.ts runs it after clearing. It wipes every
// data table and reloads it in one transaction, so running it twice gives the
// same totals. Settings are upserted, not wiped.

// Entries in the seed that have no confirmed_at get a time on the drill day.
// The canvas shows 0238 at 2:51 PM.
const REVIEW_TIMES: Record<number, string> = { 238: "14:51", 239: "14:44", 241: "14:47" };
const FALLBACK_TIME = "14:30";

const BBox = z.object({ west: z.number(), south: z.number(), east: z.number(), north: z.number() });
type BBox = z.infer<typeof BBox>;

/** [x%, y%] from the top left of the map area. */
const Pos = z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]);
const Time = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "not a date");

const Seed = z.object({
  settings: z.record(z.string(), z.unknown()),
  responders: z.array(z.object({ id: z.string(), name: z.string(), team: z.string() })),
  entries: z.array(
    z.object({
      number: z.number().int(),
      household_head: z.string(),
      barangay: z.string(),
      purok: z.string(),
      pos: Pos,
      families: z.number().int(),
      people: z.number().int(),
      hurt: z.number().int(),
      missing: z.number().int(),
      damage_class: ConfirmedDamageClass,
      ai_class: DamageClass,
      ai_confidence: Confidence,
      ai_reason: z.string().optional(),
      material: Material,
      hazards: z.array(z.string()),
      needs: z.array(Need),
      responder_id: z.string(),
      confirmed_at: Time.optional(),
      status: EntryStatus,
      review_reason: z.string().optional(),
      report_code: ReportCode.nullable(),
    }),
  ),
  reports: z.array(
    z.object({
      code: ReportCode,
      source: ReportSource,
      household_head: z.string(),
      barangay: z.string(),
      purok: z.string(),
      people: z.number().int(),
      hurt: z.number().int(),
      missing: z.number().int(),
      needs: z.array(Need),
      status: ReportStatus,
      assigned_to: z.string().nullable(),
      created_at: Time,
      pos: Pos,
      transcript: z.string().optional(),
      english: z.string().optional(),
      language: Language.optional(),
      what_happened: z.string().optional(),
    }),
  ),
  places: z.array(
    z.object({
      type: PlaceType,
      name: z.string(),
      details: z.string().nullable(),
      when_text: z.string().nullable(),
      pos: Pos,
    }),
  ),
  updates: z.array(
    z.object({
      type: UpdateType,
      headline: z.string(),
      message: z.string(),
      posted_at: Time,
      seen_count: z.number().int(),
    }),
  ),
  safe_checkins: z.array(
    z.object({
      name: z.string(),
      barangay: z.string(),
      staying_at: z.string(),
      at: Time,
      source: SafeCheckin.shape.source,
    }),
  ),
});

const seed = Seed.parse(JSON.parse(readFileSync("seed/simulation.json", "utf8")));

const iso = (value: string) => new Date(value).toISOString();

const drillDay = seed.reports[0].created_at.slice(0, 10);
const drillTime = (hhmm: string) => iso(`${drillDay}T${hhmm}:00+08:00`);

function settingText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** The bbox from the seed, else the one already in the database, else the placeholder. */
function resolveBBox(seedValue: unknown): BBox {
  if (seedValue !== null && seedValue !== undefined) return BBox.parse(seedValue);
  // The BYT-1 seed stored the string "null" here, and a hand edit can leave text
  // that is not JSON. A stored value only counts when it parses as a bbox.
  const existing = db.select().from(settings).where(eq(settings.key, "map_bbox")).get();
  let stored: unknown = null;
  try {
    stored = existing ? JSON.parse(existing.value) : null;
  } catch {
    // Not JSON, so there is no stored bbox.
  }
  const parsed = BBox.safeParse(stored);
  return parsed.success ? parsed.data : map.placeholderBbox;
}

const bbox = resolveBBox(seed.settings.map_bbox);

function toLatLng([x, y]: [number, number]) {
  const round = (n: number) => Number(n.toFixed(6));
  return {
    lng: round(bbox.west + (x / 100) * (bbox.east - bbox.west)),
    lat: round(bbox.north - (y / 100) * (bbox.north - bbox.south)),
  };
}

const responderIds = new Map(seed.responders.map((r) => [r.id, randomUUID()]));
const responderNames = new Map(seed.responders.map((r) => [r.id, r.name]));
const reportIds = new Map(seed.reports.map((r) => [r.code, randomUUID()]));

function responderId(seedId: string): string {
  const found = responderIds.get(seedId);
  if (!found) throw new Error(`Unknown responder ${seedId} in seed/simulation.json`);
  return found;
}

const confirmedAtByReport = new Map<string, string>();
for (const e of seed.entries) {
  if (e.report_code && e.confirmed_at) confirmedAtByReport.set(e.report_code, iso(e.confirmed_at));
}

async function buildSettingRows() {
  return Promise.all(
    Object.entries({ ...seed.settings, map_bbox: bbox }).map(async ([key, value]) => {
      if (key === "team_pin") return { key: "team_pin_hash", value: await hashPin(String(value)) };
      if (key === "staff_pin") return { key: "staff_pin_hash", value: await hashPin(String(value)) };
      return { key, value: settingText(value) };
    }),
  );
}

export async function loadSeed() {
  // Hash first. The transaction below is synchronous and must not wait.
  const settingRows = await buildSettingRows();

  db.transaction((tx) => {
    // Children first, so foreign keys hold.
    for (const table of [photos, duplicates, entries, reports, events, updates, places, safe_checkins, sitreps, responders]) {
      tx.delete(table).run();
    }

    for (const row of settingRows) {
      tx.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: { value: row.value } }).run();
    }

    tx.insert(responders)
      .values(seed.responders.map((r) => ({ id: responderId(r.id), name: r.name, team: r.team, active: true })))
      .run();

    tx.insert(reports)
      .values(
        seed.reports.map((r) => ({
          id: reportIds.get(r.code)!,
          code: r.code,
          source: r.source,
          household_head: r.household_head,
          barangay: r.barangay,
          purok: r.purok,
          ...toLatLng(r.pos),
          people: r.people,
          hurt: r.hurt,
          missing: r.missing,
          what_happened: r.what_happened ?? null,
          needs: r.needs,
          transcript: r.transcript ?? null,
          transcript_en: r.english ?? null,
          language: r.language ?? null,
          status: r.status,
          assigned_to: r.assigned_to ? responderId(r.assigned_to) : null,
          created_at: iso(r.created_at),
          updated_at: confirmedAtByReport.get(r.code) ?? iso(r.created_at),
        })),
      )
      .run();

    tx.insert(entries)
      .values(
        seed.entries.map((e) => {
          const confirmedAt = e.confirmed_at ? iso(e.confirmed_at) : null;
          const reviewAt = drillTime(REVIEW_TIMES[e.number] ?? FALLBACK_TIME);
          return {
            number: e.number,
            report_id: e.report_code ? (reportIds.get(e.report_code) ?? null) : null,
            responder_id: responderId(e.responder_id),
            barangay: e.barangay,
            purok: e.purok,
            household_head: e.household_head,
            ...toLatLng(e.pos),
            families: e.families,
            people: e.people,
            hurt: e.hurt,
            missing: e.missing,
            needs: e.needs,
            material: e.material,
            hazards: e.hazards,
            damage_class: e.damage_class,
            ai_class: e.ai_class,
            ai_confidence: e.ai_confidence,
            ai_reason: e.ai_reason ?? null,
            status: e.status,
            review_reason: e.review_reason ?? null,
            confirmed_by: confirmedAt ? (responderNames.get(e.responder_id) ?? null) : null,
            confirmed_at: confirmedAt,
            created_at: confirmedAt ?? reviewAt,
          };
        }),
      )
      .run();

    tx.insert(places)
      .values(
        seed.places.map((p) => ({
          type: p.type,
          name: p.name,
          details: p.details,
          when_text: p.when_text,
          ...toLatLng(p.pos),
          visible: true,
          created_at: drillTime("12:00"),
        })),
      )
      .run();

    tx.insert(updates)
      .values(
        seed.updates.map((u) => ({
          type: u.type,
          headline: u.headline,
          message: u.message,
          seen_count: u.seen_count,
          posted_at: iso(u.posted_at),
        })),
      )
      .run();

    tx.insert(safe_checkins)
      .values(
        seed.safe_checkins.map((c) => ({
          name: c.name,
          barangay: c.barangay,
          staying_at: c.staying_at,
          source: c.source,
          at: iso(c.at),
        })),
      )
      .run();
  });

  console.log(
    `Seeded ${settingRows.length} settings, ${seed.responders.length} responders, ${seed.reports.length} reports, ` +
      `${seed.entries.length} entries, ${seed.places.length} places, ${seed.updates.length} updates, ` +
      `${seed.safe_checkins.length} check-ins.`,
  );
}
