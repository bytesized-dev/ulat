// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { freshDb } from "./test-setup";

// getReviewCount is the number on the sidebar Review item. It has to equal the
// Review tabs: second look entries plus open duplicates, never family reports.

let getReviewCount: () => number;
let getUnassignedFamilyReportCount: () => number;
let countReview: typeof import("./family-reports").countReview;
let db: Awaited<ReturnType<typeof freshDb>>["db"];
let schemaRef: Awaited<ReturnType<typeof freshDb>>["schema"];

beforeAll(async () => {
  const fresh = await freshDb("review-count");
  db = fresh.db;
  const { schema } = fresh;
  schemaRef = schema;
  ({ getReviewCount, getUnassignedFamilyReportCount } = await import("./review-count"));
  ({ countReview } = await import("./family-reports"));

  const now = "2026-10-09T08:00:00.000Z";
  db.insert(schema.responders).values({ id: "r1", name: "Ana" }).run();
  const entry = (n: number, status: "needs_review" | "confirmed") =>
    db.insert(schema.entries).values({ number: n, responder_id: "r1", barangay: "Mabini", damage_class: "partial", status, created_at: now }).run();
  entry(1, "needs_review");
  entry(2, "needs_review");
  entry(3, "confirmed");

  const dupe = (n: number, status: "open" | "merged") =>
    db.insert(schema.duplicates).values({ a_type: "entry", a_id: `a${n}`, b_type: "entry", b_id: `b${n}`, status }).run();
  dupe(1, "open");
  dupe(2, "open");
  dupe(3, "open");
  dupe(4, "merged");

  db.insert(schema.reports)
    .values({ code: "T5H8", source: "family", household_head: "Reyes household", barangay: "Santa Cruz", status: "waiting", created_at: now, updated_at: now })
    .run();
});

describe("getReviewCount", () => {
  it("adds second look entries and open duplicates", () => {
    expect(getReviewCount()).toBe(2 + 3);
  });

  it("does not count family reports, only the tab for them", () => {
    const review = countReview(db);
    expect(review.family_reports).toBe(1);
    expect(getReviewCount()).toBe(review.second_look + review.duplicates);
  });

  it("counts the family reports nobody is assigned to for the Family reports item", () => {
    expect(getUnassignedFamilyReportCount()).toBe(countReview(db).family_reports);
  });

  it("flags new duplicates first, so the badge counts them before anyone opens the tab", () => {
    const before = getReviewCount();
    const now = "2026-10-09T09:00:00.000Z";
    for (const code of ["W6K4", "W6K5"]) {
      db.insert(schemaRef.reports)
        .values({ code, source: "family", household_head: "Ramil Aquino", barangay: "Santa Cruz", status: "waiting", created_at: now, updated_at: now })
        .run();
    }
    expect(getReviewCount()).toBe(before + 1);
    expect(getReviewCount()).toBe(before + 1);
  });
});
