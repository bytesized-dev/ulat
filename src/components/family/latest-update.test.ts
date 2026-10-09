import { describe, expect, it } from "vitest";
import { latestUpdate } from "./latest-update";

const older = { headline: "Elementary school is full", posted_at: "2026-10-10T13:10:00+08:00" };
const newest = { headline: "Water at the town plaza", posted_at: "2026-10-10T14:30:00+08:00" };

describe("latestUpdate", () => {
  it("picks the newest update whatever the order", () => {
    expect(latestUpdate([older, newest])?.headline).toBe(newest.headline);
    expect(latestUpdate([newest, older])?.headline).toBe(newest.headline);
  });

  it("reads a list wrapped in an object", () => {
    expect(latestUpdate({ updates: [older, newest] })?.headline).toBe(newest.headline);
  });

  it("skips entries that do not fit and extra fields", () => {
    expect(latestUpdate([{ headline: "", posted_at: newest.posted_at }, { ...older, message: "x" }, null, 3])?.headline).toBe(older.headline);
    expect(latestUpdate([{ headline: "No time", posted_at: "not a date" }])).toBeNull();
  });

  it("is null for nothing usable", () => {
    expect(latestUpdate([])).toBeNull();
    expect(latestUpdate(null)).toBeNull();
    expect(latestUpdate({ error: "no" })).toBeNull();
  });
});
