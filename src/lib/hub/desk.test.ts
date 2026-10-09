// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { lastName } from "./desk-name";
import { freshDb } from "./test-setup";

describe("lastName", () => {
  it("takes the last word", () => {
    expect(lastName("Pedro Santiago")).toBe("Santiago");
    expect(lastName("  Maria  dela Cruz ")).toBe("Cruz");
    expect(lastName("Ramos")).toBe("Ramos");
    expect(lastName("")).toBe("");
  });

  it("ignores a trailing household word", () => {
    expect(lastName("Aquino household")).toBe("Aquino");
    expect(lastName("  Pedro Santiago Household ")).toBe("Santiago");
    expect(lastName("household")).toBe("household");
  });
});

describe("desk reads", () => {
  let desk: typeof import("./desk");
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  let schema: Awaited<ReturnType<typeof freshDb>>["schema"];

  beforeAll(async () => {
    ({ db, schema } = await freshDb("desk"));
    desk = await import("./desk");
  });

  it("reads barangays, and gives none for a missing or broken setting", () => {
    expect(desk.readBarangays(db)).toEqual([]);
    db.insert(schema.settings).values({ key: "barangays", value: "not json" }).run();
    expect(desk.readBarangays(db)).toEqual([]);
    db.update(schema.settings).set({ value: JSON.stringify(["Sinonoc", " Dawo (Pob.) ", "Sinonoc", 7, ""]) }).run();
    expect(desk.readBarangays(db)).toEqual(["Sinonoc", "Dawo (Pob.)"]);
  });

  it("lists visible shelters, then the two places that are never on the map", () => {
    const place = { details: null, when_text: null, lat: 8.65, lng: 123.42, created_at: "2026-10-10T05:00:00.000Z" };
    db.insert(schema.places)
      .values([
        { id: crypto.randomUUID(), type: "shelter", name: "Covered court", visible: true, ...place },
        { id: crypto.randomUUID(), type: "shelter", name: "Hidden hall", visible: false, ...place },
        { id: crypto.randomUUID(), type: "relief", name: "Water point", visible: true, ...place },
        { id: crypto.randomUUID(), type: "shelter", name: "At home", visible: true, ...place },
      ])
      .run();
    expect(desk.stayingOptions(db)).toEqual(["Covered court", "At home", "With relatives"]);
  });

  it("mixes desk reports and desk check-ins, newest first, and skips family ones", () => {
    const report = (code: string, source: "desk" | "family", head: string, at: string) => ({
      id: crypto.randomUUID(),
      code,
      source,
      household_head: head,
      barangay: "Sinonoc",
      status: "waiting" as const,
      created_at: at,
      updated_at: at,
    });
    db.insert(schema.reports)
      .values([
        report("Q3B7", "desk", "Pedro Santiago", "2026-10-10T07:02:00.000Z"),
        report("H2C9", "desk", "Ana Belen", "2026-10-10T06:31:00.000Z"),
        report("K5M2", "family", "Jose Lim", "2026-10-10T07:10:00.000Z"),
      ])
      .run();
    db.insert(schema.safe_checkins)
      .values([
        { id: crypto.randomUUID(), name: "Luz Ramos", barangay: "Sinonoc", staying_at: "At home", message: null, source: "desk", at: "2026-10-10T06:47:00.000Z" },
        { id: crypto.randomUUID(), name: "Phone Person", barangay: "Sinonoc", staying_at: "At home", message: null, source: "phone", at: "2026-10-10T07:05:00.000Z" },
      ])
      .run();
    expect(desk.recentDesk(db)).toEqual([
      { kind: "report", code: "Q3B7", label: "Santiago", at: "2026-10-10T07:02:00.000Z" },
      { kind: "safe", label: "Ramos, safe list", at: "2026-10-10T06:47:00.000Z" },
      { kind: "report", code: "H2C9", label: "Belen", at: "2026-10-10T06:31:00.000Z" },
    ]);
  });
});
