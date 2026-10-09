import { describe, expect, it } from "vitest";
import { changesReview } from "./review-refresh";

const id = "6f1c2c1e-6a3b-4f6e-9a55-0d6b2b9d2c11";

describe("which events refresh the second look list", () => {
  it("refreshes when an entry needs review or is confirmed", () => {
    expect(changesReview({ type: "entry.needs_review", entry_id: id })).toBe(true);
    expect(changesReview({ type: "entry.confirmed", entry_id: id, report_code: null })).toBe(true);
  });

  it("ignores everything else", () => {
    expect(changesReview(null)).toBe(false);
    expect(changesReview({ type: "report.created", code: "ABCD", urgent: false })).toBe(false);
    expect(changesReview({ type: "place.saved", place_id: id })).toBe(false);
  });
});
