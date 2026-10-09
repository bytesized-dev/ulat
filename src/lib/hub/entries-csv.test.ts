// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { ENTRY_CSV_COLUMNS, buildEntriesCsv, csvCell, loadEntryCsvRows, type EntryCsvRow } from "./entries-csv";
import { freshDb } from "./test-setup";

const row = (over: Partial<EntryCsvRow> = {}): EntryCsvRow => ({
  number: 231,
  household_head: "Maria Santos",
  barangay: "Sinonoc",
  purok: "Purok 3",
  damage_class: "total",
  people: 5,
  hurt: 1,
  missing: 0,
  needs: ["water", "food"],
  material: "light",
  hazards: ["fallen power line"],
  responder: "Ana Reyes",
  confirmed_at: "2026-10-10T07:00:00.000Z",
  report_code: "K7MP",
  lat: 8.65,
  lng: -123.42,
  ...over,
});

describe("csvCell", () => {
  it("leaves plain text and numbers alone and writes null as empty", () => {
    expect(csvCell("Sinonoc")).toBe("Sinonoc");
    expect(csvCell(12)).toBe("12");
    expect(csvCell(-123.42)).toBe("-123.42");
    expect(csvCell(null)).toBe("");
  });
  it("quotes commas, quotes and line breaks, and doubles inner quotes", () => {
    expect(csvCell("Cruz, Juan")).toBe('"Cruz, Juan"');
    expect(csvCell('Juan "Jun" Cruz')).toBe('"Juan ""Jun"" Cruz"');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(csvCell("line one\r\nline two")).toBe('"line one\r\nline two"');
  });
  it("stops a spreadsheet reading text as a formula", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+63917")).toBe("'+63917");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@home")).toBe("'@home");
  });
});

describe("buildEntriesCsv", () => {
  it("writes the SPEC 7 columns in order", () => {
    const [header] = buildEntriesCsv([]).split("\r\n");
    expect(header).toBe(
      "Entry number,Household head,Barangay,Purok,Damage class,People,Hurt,Missing,Needs,Material,Hazards,Responder,Confirmed at,Linked report code,Latitude,Longitude",
    );
    expect(ENTRY_CSV_COLUMNS).toHaveLength(16);
  });

  it("writes one line per row, with the entry number as people see it", () => {
    const lines = buildEntriesCsv([row(), row({ number: 12, report_code: null, lat: null, lng: null, purok: null })]).split("\r\n");
    expect(lines[1]).toBe(
      "0231,Maria Santos,Sinonoc,Purok 3,total,5,1,0,water; food,light,fallen power line,Ana Reyes,2026-10-10T07:00:00.000Z,K7MP,8.65,-123.42",
    );
    expect(lines[2]).toBe("0012,Maria Santos,Sinonoc,,total,5,1,0,water; food,light,fallen power line,Ana Reyes,2026-10-10T07:00:00.000Z,,,");
    expect(lines[3]).toBe("");
  });

  it("escapes a household name and a hazard list with commas, quotes and new lines", () => {
    const csv = buildEntriesCsv([row({ household_head: 'Cruz, "Jun"', hazards: ["leak,\ngas", "wire"] })]);
    expect(csv).toContain('"Cruz, ""Jun"""');
    expect(csv).toContain('"leak,\ngas; wire"');
  });
});

describe("loadEntryCsvRows", () => {
  let rows: EntryCsvRow[];

  beforeAll(async () => {
    const { db, schema } = await freshDb("entries-csv");
    db.insert(schema.responders).values({ id: "r1", name: "Ana Reyes" }).run();
    db.insert(schema.reports)
      .values({ id: "rep1", code: "K7MP", source: "family", household_head: "Maria", barangay: "Sinonoc", created_at: "x", updated_at: "x" })
      .run();
    const base = { responder_id: "r1", barangay: "Sinonoc", created_at: "2026-10-10T06:00:00.000Z" };
    db.insert(schema.entries)
      .values([
        { ...base, number: 9, status: "confirmed", damage_class: "partial", household_head: "Later", confirmed_at: "2026-10-10T08:00:00.000Z" },
        { ...base, number: 2, status: "confirmed", damage_class: "total", household_head: "Earlier", report_id: "rep1", needs: ["tarp"], hazards: ["landslide"] },
        { ...base, number: 3, status: "needs_review", damage_class: "total", household_head: "In review" },
      ])
      .run();
    rows = loadEntryCsvRows(db);
  });

  it("returns confirmed entries only, in entry number order", () => {
    expect(rows.map((r) => r.household_head)).toEqual(["Earlier", "Later"]);
  });

  it("joins the responder name and the linked report code", () => {
    expect(rows[0]).toMatchObject({ number: 2, responder: "Ana Reyes", report_code: "K7MP", needs: ["tarp"], hazards: ["landslide"] });
    expect(rows[1]).toMatchObject({ number: 9, report_code: null });
  });
});
