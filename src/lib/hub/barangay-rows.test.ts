import { describe, expect, it } from "vitest";
import type { BarangayRow } from "../contracts/schemas";
import { barangaysWithData } from "./barangay-rows";

const row = (r: Partial<BarangayRow> & { barangay: string }): BarangayRow => ({
  totally: 0, partially: 0, none: 0, families: 0, people: 0, hurt: 0, missing: 0, waiting: 0, priority: "low", ...r,
});

describe("barangays with data", () => {
  it("keeps rows with a confirmed entry or an open report, in order", () => {
    const rows = [
      row({ barangay: "A", totally: 1 }),
      row({ barangay: "B" }),
      row({ barangay: "C", waiting: 2 }),
      row({ barangay: "D", none: 1 }),
      row({ barangay: "E", partially: 3 }),
    ];
    expect(barangaysWithData(rows).map((r) => r.barangay)).toEqual(["A", "C", "D", "E"]);
  });

  it("is empty when no barangay has data", () => {
    expect(barangaysWithData([row({ barangay: "A" }), row({ barangay: "B" })])).toEqual([]);
  });
});
