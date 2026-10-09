// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { settings, sitreps } from "../../db/schema";
import { smsSegments } from "../sms";
import { freshDb } from "./test-setup";

type Fresh = Awaited<ReturnType<typeof freshDb>>;
let db: Fresh["db"];
let schema: Fresh["schema"];
let lib: typeof import("./sitreps");

const at = (iso: string) => new Date(iso);
// 3:00 PM in Manila, which is UTC+8.
const THREE_PM = "2026-10-10T07:00:00.000Z";

function entry(number: number, over: Partial<typeof schema.entries.$inferInsert> = {}) {
  return {
    number,
    responder_id: "r1",
    barangay: "Sinonoc",
    created_at: THREE_PM,
    status: "confirmed" as const,
    damage_class: "total" as const,
    people: 4,
    hurt: 1,
    missing: 0,
    needs: ["water"] as ("water" | "food" | "tarp")[],
    ...over,
  };
}

beforeAll(async () => {
  ({ db, schema } = await freshDb("sitreps"));
  lib = await import("./sitreps");
  db.insert(schema.responders).values({ id: "r1", name: "Ana" }).run();
  db.insert(schema.settings)
    .values([
      { key: "town", value: "Dapitan City" },
      { key: "barangays", value: JSON.stringify(["Sinonoc", "Dawo (Pob.)"]) },
      { key: "simulation", value: "true" },
    ])
    .run();
});

describe("createSitrep", () => {
  it("saves the first report as number 1 with an empty snapshot and its SMS", () => {
    const first = lib.createSitrep(db, at(THREE_PM));
    expect(first.number).toBe(1);
    expect(first.created_at).toBe(THREE_PM);
    expect(first.snapshot).toMatchObject({ houses_checked: 0, people: 0, in_review: 0, as_of: THREE_PM });
    expect(first.sms).toBe(
      "SIMULATION DAPITAN CITY SITREP 1, 3PM: 0 houses checked, 0 totally, 0 partially damaged. " +
        "0 fam, 0 persons affected. 0 hurt, 0 missing. Needs: water 0 HH, food 0, tarp 0. 0 reports not yet visited. MDRRMO",
    );
  });

  it("snapshots the confirmed totals and leaves review entries out", () => {
    db.insert(schema.entries)
      .values([
        entry(1),
        entry(2, { damage_class: "partial", hurt: 0, missing: 1, needs: ["water", "food"] }),
        entry(3, { status: "needs_review" }),
      ])
      .run();
    const second = lib.createSitrep(db, at("2026-10-10T09:30:00.000Z"));
    expect(second.number).toBe(2);
    expect(second.snapshot).toMatchObject({
      houses_checked: 2,
      totally: 1,
      partially: 1,
      people: 8,
      hurt: 1,
      missing: 1,
      in_review: 1,
      needs: { water: 2, food: 1, tarp: 0 },
    });
    expect(second.sms).toContain("SITREP 2, 5:30PM:");
    expect(second.sms).toContain("2 houses checked, 1 totally, 1 partially damaged.");
    expect(second.sms).toContain("1 hurt, 1 missing.");
    expect(second.sms).toContain("Priority: Sinonoc.");
    expect(second.sms).toContain("Needs: water 2 HH, food 1, tarp 0.");
    expect(second.sms.length).toBeGreaterThan(160);
    expect(smsSegments(second.sms)).toBe(2);
  });

  it("keeps a saved snapshot when the totals change later", () => {
    db.insert(schema.entries).values(entry(5, { people: 10 })).run();
    const third = lib.createSitrep(db, at("2026-10-10T10:00:00.000Z"));
    expect(third.number).toBe(3);
    expect(third.snapshot.people).toBe(18);
    expect(lib.getSitrep(db, 2)?.snapshot.people).toBe(8);
  });

  it("numbers by the highest saved number, so a gap never repeats one", () => {
    db.delete(schema.sitreps).where(eq(sitreps.number, 2)).run();
    expect(lib.createSitrep(db, at("2026-10-10T11:00:00.000Z")).number).toBe(4);
  });

  it("leaves the SIMULATION mark off when simulation is off and falls back without a town", () => {
    db.update(schema.settings).set({ value: "false" }).where(eq(settings.key, "simulation")).run();
    db.delete(schema.settings).where(eq(settings.key, "town")).run();
    const report = lib.createSitrep(db, at("2026-10-10T12:00:00.000Z"));
    expect(report.sms.startsWith("TOWN SITREP 5, 8PM:")).toBe(true);
    expect(lib.readTown(db)).toBe("Town");
  });
});

describe("reading reports", () => {
  it("loads one report by number and null for a missing one", () => {
    expect(lib.getSitrep(db, 3)?.number).toBe(3);
    expect(lib.getSitrep(db, 2)).toBeNull();
    expect(lib.getSitrep(db, 99)).toBeNull();
  });

  it("returns the latest report and the earlier ones, newest first", () => {
    expect(lib.getLatestSitrep(db)?.number).toBe(5);
    expect(lib.listEarlierSitreps(db, 5).map((r) => r.number)).toEqual([4, 3, 1]);
    expect(lib.listEarlierSitreps(db, 1)).toEqual([]);
  });
});

describe("getHazardLines", () => {
  const place = { lat: 1, lng: 2, created_at: THREE_PM, type: "hazard" } as const;
  const lines = (name: string) => lib.getHazardLines(db).filter((l) => l.toLowerCase().includes(name.toLowerCase()));

  it("is empty when nothing is listed", () => {
    expect(lib.getHazardLines(db)).toEqual([]);
  });

  it("lists visible hazard places, then entry hazards with where they are", () => {
    db.insert(schema.places)
      .values([
        { ...place, name: "Landslide", details: "upper Sinonoc road" },
        { ...place, name: "Hidden flood", details: null, visible: false },
        { ...place, name: "Covered court", type: "shelter" },
      ])
      .run();
    db.insert(schema.entries)
      .values([
        entry(6, { hazards: ["Leaning post", "  "], purok: "Purok 5" }),
        entry(8, { status: "needs_review", hazards: ["Not counted"] }),
      ])
      .run();
    expect(lib.getHazardLines(db)).toEqual(["Landslide, upper Sinonoc road", "Leaning post, Purok 5, Sinonoc"]);
  });

  it("shows one line when a place names the entry's barangay and purok, whatever the case and spacing", () => {
    db.insert(schema.places).values({ ...place, name: "Cracked culvert", details: "Purok 4, Sinonoc" }).run();
    db.insert(schema.entries).values(entry(9, { hazards: ["  cracked  CULVERT"], purok: "purok  4" })).run();
    expect(lines("culvert")).toEqual(["Cracked culvert, Purok 4, Sinonoc"]);
  });

  it("treats (Pob.) as optional on either side", () => {
    db.insert(schema.places)
      .values([
        { ...place, name: "Gas leak", details: "Purok 6, Dawo" },
        { ...place, name: "Broken gate", details: "Purok 7, Banonong (Pob.)" },
      ])
      .run();
    db.insert(schema.entries)
      .values([
        entry(10, { hazards: ["Gas leak"], purok: "Purok 6", barangay: "Dawo (Pob.)" }),
        entry(11, { hazards: ["Broken gate"], purok: "Purok 7", barangay: "Banonong" }),
      ])
      .run();
    expect(lines("gas leak")).toEqual(["Gas leak, Purok 6, Dawo"]);
    expect(lines("broken gate")).toEqual(["Broken gate, Purok 7, Banonong (Pob.)"]);
  });

  it("matches on the barangay alone when the entry has no purok", () => {
    db.insert(schema.places).values({ ...place, name: "Broken pole", details: "near Dawo market" }).run();
    db.insert(schema.entries).values(entry(12, { hazards: ["Broken pole"], purok: null, barangay: "Dawo (Pob.)" })).run();
    expect(lines("broken pole")).toEqual(["Broken pole, near Dawo market"]);
  });

  it("keeps both lines when the place is in a barangay with no confirmed entries", () => {
    db.insert(schema.places).values({ ...place, name: "Tilted pole", details: "Purok 2, Potol (Pob.)" }).run();
    db.insert(schema.entries).values(entry(13, { hazards: ["Tilted pole"], purok: "Purok 2" })).run();
    expect(lines("tilted pole")).toEqual(["Tilted pole, Purok 2, Potol (Pob.)", "Tilted pole, Purok 2, Sinonoc"]);
  });

  it("keeps both lines when the place spells the barangay another way", () => {
    db.insert(schema.places).values({ ...place, name: "Sinkhole", details: "Purok 3, Dawo" }).run();
    db.insert(schema.entries).values(entry(14, { hazards: ["Sinkhole"], purok: "Purok 3" })).run();
    expect(lines("sinkhole")).toEqual(["Sinkhole, Purok 3, Dawo", "Sinkhole, Purok 3, Sinonoc"]);
  });

  it("keeps both lines when the place does not name a barangay, or names another purok", () => {
    db.insert(schema.places)
      .values([
        { ...place, name: "Fallen power line", details: "Purok 3" },
        { ...place, name: "Open drain", details: "Purok 30, Sinonoc" },
        { ...place, name: "Bridge out", details: " " },
      ])
      .run();
    db.insert(schema.entries)
      .values([
        entry(15, { hazards: ["Fallen power line"], purok: "Purok 3" }),
        entry(16, { hazards: ["Open drain"], purok: "Purok 3" }),
        entry(17, { hazards: ["Bridge out"], purok: "Purok 2" }),
      ])
      .run();
    expect(lines("power line")).toEqual(["Fallen power line, Purok 3", "Fallen power line, Purok 3, Sinonoc"]);
    expect(lines("open drain")).toEqual(["Open drain, Purok 30, Sinonoc", "Open drain, Purok 3, Sinonoc"]);
    expect(lines("bridge out")).toEqual(["Bridge out", "Bridge out, Purok 2, Sinonoc"]);
  });

  it("shows the same entry hazard twice across puroks and barangays, and once for one spot", () => {
    db.insert(schema.entries)
      .values([
        entry(18, { hazards: ["Leaning tree"], purok: "Purok 5" }),
        entry(19, { hazards: ["Leaning tree"], purok: "Purok 5", barangay: "Dawo (Pob.)" }),
        entry(20, { hazards: ["leaning tree"], purok: "Purok 9" }),
        entry(21, { hazards: ["LEANING  TREE"], purok: "purok 5" }),
      ])
      .run();
    expect(lines("leaning tree")).toEqual([
      "Leaning tree, Purok 5, Sinonoc",
      "Leaning tree, Purok 5, Dawo (Pob.)",
      "Leaning tree, Purok 9, Sinonoc",
    ]);
  });
});

describe("smsTimeLabel", () => {
  it("writes the hour without minutes and keeps real minutes", () => {
    expect(lib.smsTimeLabel(at(THREE_PM))).toBe("3PM");
    expect(lib.smsTimeLabel(at("2026-10-10T09:05:00.000Z"))).toBe("5:05PM");
  });
});
