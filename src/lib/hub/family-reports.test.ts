import { describe, expect, it } from "vitest";
import { parseFilter, statusLabel, urgentLabel } from "./family-reports";

describe("labels", () => {
  it("says why a report could not be assessed", () => {
    expect(statusLabel({ status: "cant_assess", cant_reason: "cant_find" })).toEqual({ label: "Can't find", tone: "warning" });
    expect(statusLabel({ status: "cant_assess", cant_reason: "road_blocked" }).label).toBe("Road blocked");
  });

  it("uses the canvas label for a can't assess status with no reason", () => {
    expect(statusLabel({ status: "cant_assess", cant_reason: null })).toEqual({ label: "Can't find", tone: "warning" });
    expect(statusLabel({ status: "waiting", cant_reason: null })).toEqual({ label: "Waiting", tone: "muted-soft" });
    expect(statusLabel({ status: "on_the_way", cant_reason: null }).label).toBe("On the way");
  });

  it("names who is hurt or missing", () => {
    expect(urgentLabel({ hurt: 2, missing: 0 })).toBe("2 hurt");
    expect(urgentLabel({ hurt: 0, missing: 1 })).toBe("1 missing");
    expect(urgentLabel({ hurt: 1, missing: 1 })).toBe("1 hurt, 1 missing");
    expect(urgentLabel({ hurt: 0, missing: 0 })).toBeNull();
  });

  it("reads the filter from the query string", () => {
    expect(parseFilter("problems")).toBe("problems");
    expect(parseFilter("nope")).toBe("all");
    expect(parseFilter(undefined)).toBe("all");
    expect(parseFilter(["problems"])).toBe("all");
  });
});
