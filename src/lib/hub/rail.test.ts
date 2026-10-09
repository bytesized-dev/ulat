import { describe, expect, it } from "vitest";
import type { BarangayRow } from "../contracts/schemas";
import { goFirst, goFirstReason, needBars } from "./rail";

const row = (r: Partial<BarangayRow> & { barangay: string }): BarangayRow => ({
  totally: 0, partially: 0, none: 0, families: 0, people: 0, hurt: 0, missing: 0, waiting: 0, priority: "low", ...r,
});

describe("go first", () => {
  it("keeps the summary order and leaves out low priority", () => {
    const rows = [
      row({ barangay: "A", priority: "high" }),
      row({ barangay: "B", priority: "high" }),
      row({ barangay: "C", priority: "medium" }),
      row({ barangay: "D", priority: "medium" }),
      row({ barangay: "E", priority: "low" }),
    ];
    expect(goFirst(rows).map((r) => r.barangay)).toEqual(["A", "B", "C"]);
    expect(goFirst([row({ barangay: "E" })])).toEqual([]);
  });

  it("says who is hurt or missing, or else the totally damaged count", () => {
    expect(goFirstReason(row({ barangay: "A", hurt: 3, missing: 1 }))).toBe("3 hurt, 1 missing");
    expect(goFirstReason(row({ barangay: "A", hurt: 2 }))).toBe("2 hurt");
    expect(goFirstReason(row({ barangay: "A", missing: 1 }))).toBe("1 missing");
    expect(goFirstReason(row({ barangay: "A", totally: 2 }))).toBe("2 totally damaged");
  });
});

describe("need bars", () => {
  it("lists needs most first as a share of houses checked, skipping zeros", () => {
    const bars = needBars({ houses_checked: 46, needs: { water: 41, food: 38, tarp: 33, medicine: 9, hygiene_kit: 0, baby_needs: 0 } });
    expect(bars.map((b) => [b.label, b.households, b.percent])).toEqual([
      ["Water", 41, 89],
      ["Food", 38, 83],
      ["Tarp", 33, 72],
      ["Medicine", 9, 20],
    ]);
  });

  it("draws empty bars for an empty hub", () => {
    expect(needBars({ houses_checked: 0, needs: { water: 0, food: 0, tarp: 0, medicine: 0, hygiene_kit: 0, baby_needs: 0 } })).toEqual([]);
  });
});
