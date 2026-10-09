// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { freshDb } from "./test-setup";

// Detection and merging run on a fresh database file, never on data/ulat.db.

let db: Awaited<ReturnType<typeof freshDb>>["db"];
let schema: Awaited<ReturnType<typeof freshDb>>["schema"];
let lib: typeof import("./duplicates");
let statusView: typeof import("@/app/api/reports/_lib/view").statusView;

beforeAll(async () => {
  ({ db, schema } = await freshDb("duplicates"));
  lib = await import("./duplicates");
  ({ statusView } = await import("@/app/api/reports/_lib/view"));
});

beforeEach(() => {
  db.delete(schema.events).run();
  db.delete(schema.duplicates).run();
  db.delete(schema.entries).run();
  db.delete(schema.reports).run();
  db.delete(schema.responders).run();
  db.insert(schema.responders).values({ id: "r1", name: "Ana" }).run();
});

// 0.00036 degrees of latitude is about 40 m, 0.00054 is about 60 m.
const HERE = { lat: 10.3, lng: 123.9 };
const NEAR = { lat: 10.3 + 0.00036, lng: 123.9 };
const FAR = { lat: 10.3 + 0.00054, lng: 123.9 };

// Codes use the report alphabet, since the status view validates them.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let counter = 0;
const code = () => {
  const n = counter++;
  return `K${[(n >> 10) % 32, (n >> 5) % 32, n % 32].map((i) => ALPHABET[i]).join("")}`;
};

type ReportInput = Partial<typeof schema.reports.$inferInsert>;

function report(over: ReportInput = {}) {
  const row = {
    id: crypto.randomUUID(),
    code: code(),
    source: "family" as const,
    household_head: "Ramil Aquino",
    barangay: "Santa Cruz",
    status: "waiting" as const,
    created_at: "2026-10-09T06:36:00.000Z",
    updated_at: "2026-10-09T06:36:00.000Z",
    ...over,
  };
  db.insert(schema.reports).values(row).run();
  return row;
}

function entry(over: Partial<typeof schema.entries.$inferInsert> = {}) {
  const row = {
    id: crypto.randomUUID(),
    number: ++counter,
    responder_id: "r1",
    barangay: "Santa Cruz",
    household_head: "Ramil Aquino",
    status: "needs_review" as const,
    created_at: "2026-10-09T06:50:00.000Z",
    ...over,
  };
  db.insert(schema.entries).values(row).run();
  return row;
}

const all = () => db.select().from(schema.duplicates).all();

describe("name rule", () => {
  it("lowercases and trims, and nothing else", () => {
    expect(lib.normalizeName("  Ramil AQUINO ")).toBe("ramil aquino");
    expect(lib.normalizeName(null)).toBe("");
  });

  it("flags names that match after lowercasing and trimming", () => {
    report({ household_head: "Ramil Aquino" });
    report({ household_head: "  ramil AQUINO  " });
    expect(lib.detectDuplicates(db)).toBe(1);
  });

  it("compares names with a trailing household word removed", () => {
    report({ household_head: "Aquino household" });
    report({ household_head: "  aquino HOUSEHOLD " });
    report({ household_head: "Aquino" });
    expect(lib.detectDuplicates(db)).toBe(3);
  });

  it("matches a desk full name to a surname household in the same barangay", () => {
    report({ household_head: "Santiago household" });
    report({ household_head: "Pedro Santiago", source: "desk" });
    expect(lib.detectDuplicates(db)).toBe(1);
  });

  it("does not match two full names that only share a surname", () => {
    report({ household_head: "Pedro Santiago" });
    report({ household_head: "Maria Santiago" });
    report({ household_head: "Santiago Reyes household" });
    expect(lib.detectDuplicates(db)).toBe(0);
  });

  it("does not flag different names, or two empty names", () => {
    report({ household_head: "Ramil Aquino" });
    report({ household_head: "Ramil Aquino Jr" });
    report({ household_head: "   " });
    report({ household_head: "" });
    expect(lib.detectDuplicates(db)).toBe(0);
  });
});

describe("same barangay", () => {
  it("only flags households in the same barangay", () => {
    report({ barangay: "Santa Cruz" });
    report({ barangay: "San Isidro" });
    expect(lib.detectDuplicates(db)).toBe(0);
    report({ barangay: " santa cruz " });
    expect(lib.detectDuplicates(db)).toBe(1);
  });
});

describe("50 m with and without GPS", () => {
  it("flags two positions within 50 m and stores the distance", () => {
    report(HERE);
    report(NEAR);
    expect(lib.detectDuplicates(db)).toBe(1);
    const [row] = all();
    expect(row.distance_m).toBeGreaterThan(35);
    expect(row.distance_m).toBeLessThan(45);
    expect(row.status).toBe("open");
  });

  it("does not flag positions farther than 50 m apart", () => {
    report(HERE);
    report(FAR);
    expect(lib.detectDuplicates(db)).toBe(0);
  });

  it("flags on name and barangay alone when either side has no GPS", () => {
    report(HERE);
    report({});
    report({ lat: 10.5, lng: 124.2 });
    // The second has no position, so it pairs with both. The first and third both have GPS and are far apart.
    expect(lib.detectDuplicates(db)).toBe(2);
    expect(all().map((r) => r.distance_m).sort()).toEqual([null, null]);
  });

  it("measures distance in meters", () => {
    expect(lib.distanceMeters(HERE, NEAR)).toBeCloseTo(40, 0);
    expect(lib.distanceMeters(HERE, HERE)).toBe(0);
  });
});

describe("report and entry", () => {
  it("flags an entry for the same household as a report", () => {
    const r = report(HERE);
    const e = entry(NEAR);
    expect(lib.detectDuplicates(db)).toBe(1);
    expect(all()[0]).toMatchObject({ a_type: "report", a_id: r.id, b_type: "entry", b_id: e.id });
  });

  it("does not flag the entry a responder opened from that report", () => {
    const r = report(HERE);
    entry({ ...NEAR, report_id: r.id });
    expect(lib.detectDuplicates(db)).toBe(0);
  });

  it("does not flag two entries for the same household", () => {
    entry({ household_head: "Solo Household" });
    entry({ household_head: "Solo Household" });
    expect(lib.detectDuplicates(db)).toBe(0);
  });

  it("ignores a merged report", () => {
    const first = report();
    report({ status: "merged", merged_into: first.id });
    expect(lib.detectDuplicates(db)).toBe(0);
  });

  it("does not flag an entry for a report that was merged into the one it is compared with", () => {
    const first = report();
    const gone = report({ status: "merged", merged_into: first.id });
    entry({ report_id: gone.id });
    expect(lib.detectDuplicates(db)).toBe(0);
  });
});

describe("no repeats", () => {
  it("stores each pair once, however often detection runs", () => {
    report(HERE);
    report(NEAR);
    entry(NEAR);
    expect(lib.detectDuplicates(db)).toBe(3);
    expect(lib.detectDuplicates(db)).toBe(0);
    expect(lib.detectDuplicates(db)).toBe(0);
    expect(all()).toHaveLength(3);
  });

  it("does not flag a resolved pair again", () => {
    report();
    report();
    lib.detectDuplicates(db);
    expect(lib.resolveDuplicate(db, all()[0].id, "kept", "staff")).toEqual({ ok: true });
    expect(lib.detectDuplicates(db)).toBe(0);
    expect(all()).toHaveLength(1);
  });

  it("adds only the new pairs when another report comes in", () => {
    report();
    report();
    lib.detectDuplicates(db);
    report();
    expect(lib.detectDuplicates(db)).toBe(2);
  });

  it("orders two reports oldest first", () => {
    const late = report({ created_at: "2026-10-09T06:40:00.000Z" });
    const early = report({ created_at: "2026-10-09T06:36:00.000Z" });
    lib.detectDuplicates(db);
    expect(all()[0]).toMatchObject({ a_id: early.id, b_id: late.id });
  });
});

describe("listing", () => {
  it("lists open pairs with both sides and leaves out resolved ones", () => {
    report({ ...HERE, hurt: 0, needs: ["water", "food"] });
    report({ ...NEAR, hurt: 1, needs: ["water", "food", "medicine"], source: "neighbor", created_at: "2026-10-09T06:40:00.000Z" });
    lib.detectDuplicates(db);
    const [pair] = lib.listOpenDuplicates(db);
    expect(pair.mergeable).toBe(true);
    expect(pair.a.hurt).toBe(0);
    expect(pair.b).toMatchObject({ hurt: 1, sent_by: "neighbor" });
    expect(lib.needsLabel(pair.b.needs)).toBe("Water, food, medicine");
    lib.resolveDuplicate(db, pair.id, "mistake", "staff");
    expect(lib.listOpenDuplicates(db)).toEqual([]);
  });

  it("cannot merge a report with an entry", () => {
    report();
    entry();
    lib.detectDuplicates(db);
    const [pair] = lib.listOpenDuplicates(db);
    expect(pair.mergeable).toBe(false);
    expect(lib.mergeDuplicate(db, pair.id, "staff")).toEqual({ ok: false, error: "not_mergeable" });
  });

  it("labels distances", () => {
    expect(lib.distanceLabel(29.6)).toBe("30 m apart");
    expect(lib.distanceLabel(null)).toBe("No GPS");
    expect(lib.needsLabel([])).toBe("None");
  });
});

describe("resolve", () => {
  it("keeps both or dismisses, and touches no report", () => {
    const a = report();
    const b = report({ hurt: 2 });
    lib.detectDuplicates(db);
    const id = all()[0].id;
    expect(lib.resolveDuplicate(db, id, "mistake", "staff")).toEqual({ ok: true });

    const row = all()[0];
    expect(row).toMatchObject({ status: "mistake", resolved_by: "staff" });
    expect(row.resolved_at).toBeTruthy();
    expect(db.select().from(schema.reports).where(eq(schema.reports.id, b.id)).get()).toMatchObject({ status: "waiting", hurt: 2 });
    const log = db.select().from(schema.events).all();
    expect(log.map((e) => [e.entity, e.entity_id, e.type, e.actor]).sort()).toEqual(
      [
        ["report", a.id, "duplicate.mistake", "staff"],
        ["report", b.id, "duplicate.mistake", "staff"],
      ].sort(),
    );
  });

  it("will not resolve a pair twice, or one that is not there", () => {
    report();
    report();
    lib.detectDuplicates(db);
    const id = all()[0].id;
    lib.resolveDuplicate(db, id, "kept", "staff");
    expect(lib.resolveDuplicate(db, id, "mistake", "staff")).toEqual({ ok: false, error: "already_resolved" });
    expect(lib.resolveDuplicate(db, crypto.randomUUID(), "kept", "staff")).toEqual({ ok: false, error: "not_found" });
    expect(all()[0].status).toBe("kept");
  });
});

describe("merge", () => {
  function pair() {
    const first = report({
      ...HERE,
      people: 6,
      hurt: 0,
      missing: 0,
      what_happened: "Roof came off.",
      transcript: "Naguba ang atop.",
      needs: ["water", "food"],
      created_at: "2026-10-09T06:36:00.000Z",
    });
    const later = report({
      ...NEAR,
      source: "neighbor",
      people: 6,
      hurt: 1,
      missing: 1,
      what_happened: "Grandfather has a cut on his leg.",
      transcript: "Naay samad ang lolo.",
      needs: ["water", "food", "medicine"],
      created_at: "2026-10-09T06:40:00.000Z",
    });
    lib.detectDuplicates(db);
    return { first, later, id: all()[0].id };
  }

  const read = (id: string) => db.select().from(schema.reports).where(eq(schema.reports.id, id)).get()!;

  it("keeps both notes and the higher hurt count on the first report", () => {
    const { first, later, id } = pair();
    const result = lib.mergeDuplicate(db, id, "staff");
    expect(result.ok).toBe(true);

    expect(read(first.id)).toMatchObject({
      hurt: 1,
      missing: 1,
      people: 6,
      needs: ["water", "food", "medicine"],
      what_happened: "Roof came off.\n\nGrandfather has a cut on his leg.",
      transcript: "Naguba ang atop.\n\nNaay samad ang lolo.",
      status: "waiting",
    });
    // The later report is not edited, so nothing is lost.
    expect(read(later.id)).toMatchObject({ hurt: 1, what_happened: "Grandfather has a cut on his leg." });
  });

  it("never lowers a count when the later report has fewer", () => {
    const { first, id } = pair();
    db.update(schema.reports).set({ hurt: 3 }).where(eq(schema.reports.id, first.id)).run();
    lib.mergeDuplicate(db, id, "staff");
    expect(read(first.id).hurt).toBe(3);
  });

  it("keeps one copy when both notes say the same thing", () => {
    const { first, later, id } = pair();
    db.update(schema.reports).set({ what_happened: "Same words." }).where(eq(schema.reports.id, first.id)).run();
    db.update(schema.reports).set({ what_happened: " Same words. " }).where(eq(schema.reports.id, later.id)).run();
    lib.mergeDuplicate(db, id, "staff");
    expect(read(first.id).what_happened).toBe("Same words.");
  });

  it("keeps the first code, merges the later report into it, and the later code still resolves", () => {
    const { first, later, id } = pair();
    const result = lib.mergeDuplicate(db, id, "staff");
    expect(result).toMatchObject({ ok: true, kept: first.code, merged: later.code });

    expect(read(first.id).code).toBe(first.code);
    expect(read(later.id)).toMatchObject({ status: "merged", merged_into: first.id, code: later.code });
    // The family that sent the later report can still look its code up.
    const byCode = db.select().from(schema.reports).where(eq(schema.reports.code, later.code)).get()!;
    expect(statusView(db, byCode).code).toBe(later.code);
    expect(all()[0]).toMatchObject({ status: "merged", resolved_by: "staff" });
  });

  it("writes events for both reports and returns the live events to publish", () => {
    const { first, later, id } = pair();
    const result = lib.mergeDuplicate(db, id, "staff");
    if (!result.ok) throw new Error("merge failed");

    const log = db.select().from(schema.events).all();
    const merged = log.find((e) => e.entity_id === first.id && e.type === "report.merged");
    expect(merged).toMatchObject({ entity: "report", actor: "staff" });
    expect(merged?.data).toMatchObject({ merged: later.code, duplicate_id: id, hurt: 1 });
    const moved = log.find((e) => e.entity_id === later.id && e.type === "report.status_changed");
    expect(moved).toMatchObject({ entity: "report", actor: "staff" });
    expect(moved?.data).toMatchObject({ status: "merged", merged_into: first.code });

    expect(result.events).toEqual([
      { type: "report.updated", code: first.code, status: "waiting" },
      { type: "report.updated", code: later.code, status: "merged" },
    ]);
  });

  it("closes other open pairs that name the merged report", () => {
    const { first, id } = pair();
    const third = report({ ...HERE, created_at: "2026-10-09T06:45:00.000Z" });
    lib.detectDuplicates(db);
    // first with later, first with third, later with third.
    expect(all().filter((r) => r.status === "open")).toHaveLength(3);

    lib.mergeDuplicate(db, id, "staff");
    // first with third stays open, the two that name the merged report are closed.
    const open = all().filter((r) => r.status === "open");
    expect(open).toHaveLength(1);
    expect([open[0].a_id, open[0].b_id].sort()).toEqual([first.id, third.id].sort());
  });

  it("is refused a second time and changes nothing", () => {
    const { first, id } = pair();
    lib.mergeDuplicate(db, id, "staff");
    const before = read(first.id);
    expect(lib.mergeDuplicate(db, id, "staff")).toEqual({ ok: false, error: "already_resolved" });
    expect(read(first.id)).toEqual(before);
    expect(db.select().from(schema.events).all().filter((e) => e.type === "report.merged")).toHaveLength(1);
  });

  it("writes nothing when the merge fails halfway", () => {
    const { first, later, id } = pair();
    // Break the audit insert: an events row needs a non-null actor.
    expect(() => lib.mergeDuplicate(db, id, null as unknown as string)).toThrow();
    expect(read(first.id)).toMatchObject({ hurt: 0, needs: ["water", "food"] });
    expect(read(later.id).status).toBe("waiting");
    expect(all()[0].status).toBe("open");
    expect(db.select().from(schema.events).all()).toEqual([]);
  });
});
