import { and, asc, desc, eq, lt, max } from "drizzle-orm";
import type { Db } from "../../db/client";
import { entries, places, settings, sitreps } from "../../db/schema";
import { HubSummary } from "../contracts/schemas";
import { buildSms, smsSegments, type SmsSnapshot } from "../sms";
import { formatTime } from "../time";
import { getHubSummary } from "./summary";

// docs/SPEC.md section 7. A situation report is a frozen copy of the hub
// summary plus the SMS built from it. Reports are numbered 1, 2, 3 in the order
// they are created. Callers pass the database so tests can use their own file.

export type Sitrep = typeof sitreps.$inferSelect;

/** The shown town when the hub has none set yet. */
const FALLBACK_TOWN = "Town";

function readText(db: Db, key: string): string | undefined {
  return db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).get()?.value;
}

/** The hub's town name, for the report heading and the SMS. */
export function readTown(db: Db): string {
  return readText(db, "town")?.trim() || FALLBACK_TOWN;
}

/** "3:00 PM" becomes "3PM", the short form the SMS header uses. */
export function smsTimeLabel(at: Date): string {
  return formatTime(at).replace(":00", "").replace(" ", "");
}

/** The numbers the SMS needs, taken straight from the snapshot. Nothing is counted here. */
export function smsSnapshot(
  summary: HubSummary,
  meta: { town: string; simulation: boolean; number: number; at: Date },
): SmsSnapshot {
  return {
    simulation: meta.simulation,
    town: meta.town,
    number: meta.number,
    timeLabel: smsTimeLabel(meta.at),
    housesChecked: summary.houses_checked,
    totally: summary.totally,
    partially: summary.partially,
    families: summary.families,
    people: summary.people,
    hurt: summary.hurt,
    missing: summary.missing,
    // The summary is already ranked, so the first two that are not low come first.
    priority: summary.barangays.filter((b) => b.priority !== "low").map((b) => b.barangay),
    needs: { water: summary.needs.water ?? 0, food: summary.needs.food ?? 0, tarp: summary.needs.tarp ?? 0 },
    notYetVisited: summary.not_yet_visited,
  };
}

/**
 * Snapshot the totals as the next numbered report and save it with its SMS.
 * The number is read and written in one immediate transaction, so two staff
 * pressing the button together get two different numbers.
 */
export function createSitrep(db: Db, at: Date = new Date()): Sitrep {
  const summary = getHubSummary(db, at);
  const town = readTown(db);
  const simulation = readText(db, "simulation") === "true";

  return db.transaction(
    (tx) => {
      const last = tx.select({ n: max(sitreps.number) }).from(sitreps).get()?.n ?? 0;
      const number = last + 1;
      const sms = buildSms(smsSnapshot(summary, { town, simulation, number, at }));
      return tx.insert(sitreps).values({ number, created_at: at.toISOString(), snapshot: summary, sms }).returning().get();
    },
    { behavior: "immediate" },
  );
}

/** A saved report with its snapshot checked against the contract. */
function parse(row: Sitrep): Sitrep {
  return { ...row, snapshot: HubSummary.parse(row.snapshot) };
}

/** One report by its number, or null. BYTE-43's print page loads a report with this. */
export function getSitrep(db: Db, number: number): Sitrep | null {
  const row = db.select().from(sitreps).where(eq(sitreps.number, number)).get();
  return row ? parse(row) : null;
}

/** The newest report, or null before the first one. */
export function getLatestSitrep(db: Db): Sitrep | null {
  const row = db.select().from(sitreps).orderBy(desc(sitreps.number)).limit(1).get();
  return row ? parse(row) : null;
}

/** Number and time of every report before the one shown, newest first. */
export function listEarlierSitreps(db: Db, before: number): { number: number; created_at: string }[] {
  return db
    .select({ number: sitreps.number, created_at: sitreps.created_at })
    .from(sitreps)
    .where(lt(sitreps.number, before))
    .orderBy(desc(sitreps.number))
    .all();
}

/** How many characters and how many texts an SMS takes. */
export function smsCounts(text: string): { characters: number; texts: number } {
  return { characters: text.length, texts: smsSegments(text) };
}

const upperFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Hazard lines for the report, as people wrote them. HubSummary has no hazards,
 * so these are read live and not frozen in the snapshot. First the visible
 * hazard places as "name, details". Then hazards typed on confirmed entries
 * that no place already names, with the barangay so the line says where.
 */
export function getHazardLines(db: Db): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  const placeRows = db
    .select({ name: places.name, details: places.details })
    .from(places)
    .where(and(eq(places.type, "hazard"), eq(places.visible, true)))
    .orderBy(asc(places.created_at), asc(places.name))
    .all();
  for (const { name, details } of placeRows) {
    const line = [name, details].map((t) => t?.trim()).filter(Boolean).join(", ");
    if (!line) continue;
    seen.add(name.trim().toLowerCase());
    lines.push(upperFirst(line));
  }

  const entryRows = db
    .select({ hazards: entries.hazards, barangay: entries.barangay, purok: entries.purok })
    .from(entries)
    .where(eq(entries.status, "confirmed"))
    .orderBy(asc(entries.number))
    .all();
  for (const { hazards, barangay, purok } of entryRows) {
    for (const raw of hazards) {
      const text = raw.trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      lines.push(`${upperFirst(text)}, ${[purok?.trim(), barangay].filter(Boolean).join(", ")}`);
    }
  }
  return lines;
}
