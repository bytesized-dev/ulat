// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { freshDb } from "./test-setup";

describe("safeCounts", () => {
  let safeCounts: typeof import("./safe").safeCounts;
  let db: Awaited<ReturnType<typeof freshDb>>["db"];
  let schema: Awaited<ReturnType<typeof freshDb>>["schema"];

  beforeAll(async () => {
    ({ db, schema } = await freshDb("safe-counts"));
    ({ safeCounts } = await import("./safe"));
  });

  const checkin = (name: string, staying_at: string, at: string) =>
    ({ id: crypto.randomUUID(), name, barangay: "Sinonoc", staying_at, message: null, source: "phone", at }) as const;

  it("is zero on an empty list", () => {
    expect(safeCounts(db)).toEqual({ total: 0, staying: [] });
  });

  it("counts everyone and groups by where they stay, biggest first", () => {
    db.insert(schema.safe_checkins)
      .values([
        checkin("Ernesto Bautista", "Covered court", "2026-10-10T05:42:00.000Z"),
        checkin("Lorna Bautista", "With relatives", "2026-10-10T06:05:00.000Z"),
        checkin("Rogelio Bautista", "Covered court", "2026-10-10T06:18:00.000Z"),
        checkin("Marivic Cruz", "At home", "2026-10-10T06:31:00.000Z"),
        checkin("Jomar Cruz", "At home", "2026-10-10T06:40:00.000Z"),
        checkin("Teresita Cruz", "Covered court", "2026-10-10T06:52:00.000Z"),
      ])
      .run();
    expect(safeCounts(db)).toEqual({
      total: 6,
      staying: [
        { staying_at: "Covered court", count: 3 },
        { staying_at: "At home", count: 2 },
        { staying_at: "With relatives", count: 1 },
      ],
    });
  });
});
