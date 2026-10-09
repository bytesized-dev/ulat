import { describe, expect, it } from "vitest";
import type { BarangayRow } from "../contracts/schemas";
import { hasData, rowsWithData } from "./barangay-rows";

const empty: BarangayRow = { barangay: "Aliguay", totally: 0, partially: 0, none: 0, families: 0, people: 0, hurt: 0, missing: 0, waiting: 0, priority: "low" };
const row = (barangay: string, change: Partial<BarangayRow>): BarangayRow => ({ ...empty, barangay, ...change });

describe("hasData", () => {
  it("is false for a barangay with no entry and no open report", () => {
    expect(hasData(empty)).toBe(false);
  });

  it("is true for a confirmed entry of any damage class", () => {
    expect(hasData({ ...empty, totally: 1 })).toBe(true);
    expect(hasData({ ...empty, partially: 1 })).toBe(true);
    expect(hasData({ ...empty, none: 1 })).toBe(true);
  });

  it("is true for an open report with no entry yet", () => {
    expect(hasData({ ...empty, waiting: 2 })).toBe(true);
  });
});

describe("rowsWithData", () => {
  it("drops the empty barangays and keeps the order", () => {
    const rows = [row("Sinonoc", { hurt: 2, totally: 3 }), row("Aliguay", {}), row("Dawo (Pob.)", { waiting: 1 }), row("Banbanan", {})];
    expect(rowsWithData(rows).map((r) => r.barangay)).toEqual(["Sinonoc", "Dawo (Pob.)"]);
  });

  it("returns nothing when no barangay has data", () => {
    expect(rowsWithData([empty, row("Banbanan", {})])).toEqual([]);
  });
});
