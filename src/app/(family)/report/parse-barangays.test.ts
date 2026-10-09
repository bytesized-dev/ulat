import { describe, expect, it } from "vitest";
import { parseBarangays } from "./parse-barangays";

describe("parseBarangays", () => {
  it("returns the saved list in order", () => {
    expect(parseBarangays('["San Isidro","Santa Cruz","Mabini"]')).toEqual(["San Isidro", "Santa Cruz", "Mabini"]);
  });

  it("drops repeats", () => {
    expect(parseBarangays('["Mabini","Mabini","Rizal"]')).toEqual(["Mabini", "Rizal"]);
  });

  it("gives an empty list when the setting is missing", () => {
    expect(parseBarangays(undefined)).toEqual([]);
  });

  it("gives an empty list for a value that is not a list of names", () => {
    expect(parseBarangays("not json")).toEqual([]);
    expect(parseBarangays('{"a":1}')).toEqual([]);
    expect(parseBarangays("[1,2]")).toEqual([]);
    expect(parseBarangays('[""]')).toEqual([]);
  });
});
