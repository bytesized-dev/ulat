import { describe, expect, it } from "vitest";
import { barangayName, shadeByTotals, shadingFillColor } from "./shading";

describe("shadeByTotals", () => {
  it("gives the most totally damaged barangays the darkest shade", () => {
    expect(shadeByTotals({ "San Isidro": 9, "Santa Cruz": 4, Mabini: 1, Rizal: 0 })).toEqual({
      "San Isidro": 1,
      "Santa Cruz": 2,
      Mabini: 3,
    });
  });

  it("shades nothing when no house is totally damaged", () => {
    expect(shadeByTotals({ Poblacion: 0 })).toEqual({});
    expect(shadeByTotals({})).toEqual({});
  });
});

describe("shadingFillColor", () => {
  const colors = { 1: "shade-1", 2: "shade-2", 3: "shade-3" } as const;

  it("matches each barangay by name and falls back to no fill", () => {
    expect(shadingFillColor({ Mabini: 3, Poblacion: 1 }, "name", colors, "none")).toEqual([
      "match",
      ["get", "name"],
      "Mabini",
      "shade-3",
      "Poblacion",
      "shade-1",
      "none",
    ]);
  });

  it("is a plain value when nothing is shaded, since match needs at least one pair", () => {
    expect(shadingFillColor({}, "name", colors, "none")).toEqual(["literal", "none"]);
  });
});

describe("barangayName", () => {
  it("reads the name property and ignores anything that is not text", () => {
    expect(barangayName({ name: "Rizal" }, "name")).toBe("Rizal");
    expect(barangayName({ name: 4 }, "name")).toBeUndefined();
    expect(barangayName({}, "name")).toBeUndefined();
  });
});
