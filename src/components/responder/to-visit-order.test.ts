import { describe, expect, it } from "vitest";
import { assignmentLabel, assignmentOf, assignmentTag, distanceMeters, filterToVisit, formatDistance, nextPosition, orderToVisit, withDistance, type ToVisitReport } from "./to-visit-order";

const here = { lat: 10.0, lng: 124.0 };

function report(code: string, over: Partial<ToVisitReport> = {}): ToVisitReport {
  return {
    code,
    household_head: `${code} household`,
    barangay: "Sinonoc",
    purok: null,
    lat: 10.0,
    lng: 124.0,
    hurt: 0,
    missing: 0,
    created_at: "2026-10-09T08:00:00.000Z",
    ...over,
  };
}

// About 111 m per 0.001 degree of latitude.
const at = (metres: number) => ({ lat: 10.0 + metres / 111_195, lng: 124.0 });

describe("distance", () => {
  it("is zero for the same point and close to the real distance", () => {
    expect(distanceMeters(here, here)).toBe(0);
    expect(Math.round(distanceMeters(here, at(1000)))).toBeGreaterThan(995);
    expect(Math.round(distanceMeters(here, at(1000)))).toBeLessThan(1005);
  });

  it("formats metres and kilometres", () => {
    expect(formatDistance(347)).toBe("350 m");
    expect(formatDistance(990)).toBe("990 m");
    expect(formatDistance(1234)).toBe("1.2 km");
    expect(formatDistance(2000)).toBe("2.0 km");
  });

  it("never shows 1000 m, it switches to km where the rounding reaches 1000", () => {
    for (const meters of [995, 996, 999, 999.9, 1000]) expect(formatDistance(meters)).toBe("1.0 km");
    expect(formatDistance(994)).toBe("990 m");
  });
});

describe("order to visit", () => {
  const reports = [
    report("NEAR", { ...at(100) }),
    report("FAR1", { ...at(2000), hurt: 1 }),
    report("MISS", { ...at(600), missing: 1 }),
    report("MID1", { ...at(450) }),
  ];

  it("urgent first puts hurt or missing on top, then distance", () => {
    const order = orderToVisit(withDistance(reports, here), "urgent").map((r) => r.code);
    expect(order).toEqual(["MISS", "FAR1", "NEAR", "MID1"]);
  });

  it("nearest ignores hurt and missing", () => {
    const order = orderToVisit(withDistance(reports, here), "nearest").map((r) => r.code);
    expect(order).toEqual(["NEAR", "MID1", "MISS", "FAR1"]);
  });

  it("puts houses without a distance last and keeps urgent ones first", () => {
    const list = [
      report("NOGP", { lat: null, lng: null, created_at: "2026-10-09T09:00:00.000Z" }),
      report("HURT", { lat: null, lng: null, hurt: 2 }),
      report("NEAR", { ...at(100) }),
    ];
    expect(orderToVisit(withDistance(list, here), "urgent").map((r) => r.code)).toEqual(["HURT", "NEAR", "NOGP"]);
    expect(orderToVisit(withDistance(list, here), "nearest").map((r) => r.code)).toEqual(["NEAR", "HURT", "NOGP"]);
  });

  it("without the responder's location, falls back to urgent then oldest", () => {
    const list = [
      report("LATE", { created_at: "2026-10-09T10:00:00.000Z" }),
      report("OLD", { created_at: "2026-10-09T07:00:00.000Z" }),
      report("HURT", { hurt: 1, created_at: "2026-10-09T11:00:00.000Z" }),
    ];
    const items = withDistance(list, null);
    expect(items.every((i) => i.distance_m === null)).toBe(true);
    expect(orderToVisit(items, "urgent").map((r) => r.code)).toEqual(["HURT", "OLD", "LATE"]);
  });

  it("does not change the list it was given", () => {
    const items = withDistance(reports, here);
    const before = items.map((i) => i.code);
    orderToVisit(items, "urgent");
    expect(items.map((i) => i.code)).toEqual(before);
  });
});

describe("search", () => {
  const items = withDistance(
    [
      report("D4F5", { household_head: "Dela Cruz household", barangay: "Sinonoc", purok: "Purok 3" }),
      report("G6H7", { household_head: "Garcia household", barangay: "Mabini", purok: null }),
      report("B3N6", { household_head: "Bautista household", barangay: "Sinonoc", purok: "Purok 1" }),
    ],
    here,
  );

  it("returns everything for an empty or blank search", () => {
    expect(filterToVisit(items, "")).toHaveLength(3);
    expect(filterToVisit(items, "   ")).toHaveLength(3);
  });

  it("matches household, barangay, purok and code without caring about case", () => {
    expect(filterToVisit(items, "garcia").map((i) => i.code)).toEqual(["G6H7"]);
    expect(filterToVisit(items, "MABINI").map((i) => i.code)).toEqual(["G6H7"]);
    expect(filterToVisit(items, "cruz purok 3").map((i) => i.code)).toEqual(["D4F5"]);
    expect(filterToVisit(items, "b3n6").map((i) => i.code)).toEqual(["B3N6"]);
  });

  it("needs every word to match", () => {
    expect(filterToVisit(items, "sinonoc purok 1").map((i) => i.code)).toEqual(["B3N6"]);
    expect(filterToVisit(items, "sinonoc mabini")).toEqual([]);
  });
});

describe("next position", () => {
  it("takes the first fix", () => {
    expect(nextPosition(null, here)).toEqual(here);
  });

  it("keeps the old position for a move under 25 m and takes it from 25 m", () => {
    expect(nextPosition(here, at(10))).toEqual(here);
    expect(nextPosition(here, at(30))).toEqual(at(30));
  });
});

describe("assignment", () => {
  it("tells yours from someone else's from nobody's", () => {
    expect(assignmentOf({ assigned_to: null, assignee_name: null }, "r1")).toBeNull();
    expect(assignmentOf({}, "r1")).toBeNull();
    expect(assignmentOf({ assigned_to: "r1", assignee_name: "Carlo Mendoza" }, "r1")).toEqual({ kind: "mine" });
    expect(assignmentOf({ assigned_to: "r2", assignee_name: "Mae Santos" }, "r1")).toEqual({ kind: "other", name: "Mae Santos" });
    expect(assignmentOf({ assigned_to: "r2", assignee_name: null }, "r1")).toEqual({ kind: "other", name: "Another responder" });
  });

  it("words the row tag and the report page line", () => {
    expect(assignmentTag({ kind: "mine" })).toBe("Yours");
    expect(assignmentTag({ kind: "other", name: "Mae Santos" })).toBe("Mae Santos");
    expect(assignmentLabel({ kind: "mine" })).toBe("Assigned to you");
    expect(assignmentLabel({ kind: "other", name: "Mae Santos" })).toBe("Assigned to Mae Santos");
    expect(assignmentTag({ kind: "other", name: "Another responder" })).toBe("Another responder");
    expect(assignmentLabel({ kind: "other", name: "Another responder" })).toBe("Assigned to another responder");
  });

  const reports = [
    report("NEAR", { ...at(100) }),
    report("MINE", { ...at(900), assigned_to: "r1" }),
    report("THEM", { ...at(200), assigned_to: "r2" }),
    report("HURT", { ...at(2000), hurt: 1 }),
    report("HMNE", { ...at(1500), hurt: 1, assigned_to: "r1" }),
  ];

  it("urgent first keeps urgency on top, then puts the responder's own reports first within each group", () => {
    const order = orderToVisit(withDistance(reports, here), "urgent", "r1").map((r) => r.code);
    expect(order).toEqual(["HMNE", "HURT", "MINE", "NEAR", "THEM"]);
  });

  it("does not move own reports without a responder id, and nearest ignores them", () => {
    const urgent = orderToVisit(withDistance(reports, here), "urgent").map((r) => r.code);
    expect(urgent).toEqual(["HMNE", "HURT", "NEAR", "THEM", "MINE"]);
    const nearest = orderToVisit(withDistance(reports, here), "nearest", "r1").map((r) => r.code);
    expect(nearest).toEqual(["NEAR", "THEM", "MINE", "HMNE", "HURT"]);
  });
});
