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
        entry(4, { status: "draft", damage_class: null }),
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

describe("smsTimeLabel and smsCounts", () => {
  it("writes the hour without minutes and keeps real minutes", () => {
    expect(lib.smsTimeLabel(at(THREE_PM))).toBe("3PM");
    expect(lib.smsTimeLabel(at("2026-10-10T09:05:00.000Z"))).toBe("5:05PM");
  });
  it("counts characters and texts", () => {
    expect(lib.smsCounts("a".repeat(161))).toEqual({ characters: 161, texts: 2 });
  });
});
