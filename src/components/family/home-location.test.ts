import { describe, expect, it } from "vitest";
import type { BarangayCollection } from "@/components/map";
import { barangayAt, homeChange, insideTown, placeLine, savedHome } from "./home-location";

const square = (west: number, south: number, east: number, north: number) => [
  [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ],
];

const barangays: BarangayCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { name: "San Isidro" }, geometry: { type: "Polygon", coordinates: square(123.1, 8.5, 123.2, 8.6) } },
    {
      type: "Feature",
      properties: { name: "Santa Cruz" },
      geometry: { type: "MultiPolygon", coordinates: [square(123.3, 8.5, 123.4, 8.6), square(123.5, 8.5, 123.52, 8.6)] },
    },
    { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: square(123.25, 8.7, 123.26, 8.71) } },
  ],
};

describe("barangayAt", () => {
  it("finds the barangay that holds the point", () => {
    expect(barangayAt({ lng: 123.15, lat: 8.55 }, barangays)).toBe("San Isidro");
  });

  it("reads every part of a multi-part barangay", () => {
    expect(barangayAt({ lng: 123.35, lat: 8.55 }, barangays)).toBe("Santa Cruz");
    expect(barangayAt({ lng: 123.51, lat: 8.55 }, barangays)).toBe("Santa Cruz");
  });

  it("gives null outside every outline, for a nameless outline and with no data", () => {
    expect(barangayAt({ lng: 123.45, lat: 8.55 }, barangays)).toBeNull();
    expect(barangayAt({ lng: 123.255, lat: 8.705 }, barangays)).toBeNull();
    expect(barangayAt({ lng: 123.15, lat: 8.55 }, undefined)).toBeNull();
  });
});

describe("placeLine", () => {
  it("joins the barangay and the purok", () => {
    expect(placeLine("San Isidro", "Purok 3")).toBe("San Isidro, Purok 3");
  });

  it("shows whichever half is known", () => {
    expect(placeLine("San Isidro", "  ")).toBe("San Isidro");
    expect(placeLine(null, "Purok 3")).toBe("Purok 3");
  });

  it("says so when the pin is in no barangay and there is no purok", () => {
    expect(placeLine(null, "")).toBe("Not in a barangay");
  });
});

describe("insideTown", () => {
  it("accepts a point on the offline map and rejects one far away", () => {
    expect(insideTown({ lng: 123.3, lat: 8.7 })).toBe(true);
    expect(insideTown({ lng: 121.0, lat: 14.6 })).toBe(false);
  });
});

describe("savedHome", () => {
  it("is the draft position, or null until both halves are set", () => {
    expect(savedHome({ lat: 8.5, lng: 123.2 })).toEqual({ lat: 8.5, lng: 123.2 });
    expect(savedHome({ lat: 8.5, lng: null })).toBeNull();
    expect(savedHome({ lat: null, lng: null })).toBeNull();
  });
});

describe("homeChange", () => {
  const hub = ["San Isidro", "Santa Cruz"];

  it("saves the rounded position and the barangay when the hub lists it", () => {
    expect(homeChange({ lng: 123.1234567891, lat: 8.5555555555 }, "San Isidro", hub)).toEqual({
      lat: 8.555556,
      lng: 123.123457,
      barangay: "San Isidro",
    });
  });

  it("uses the hub's spelling", () => {
    expect(homeChange({ lng: 123.15, lat: 8.55 }, "SAN ISIDRO", hub).barangay).toBe("San Isidro");
  });

  it("keeps the family's barangay when the pin is in one the hub does not list, or in none", () => {
    expect(homeChange({ lng: 123.15, lat: 8.55 }, "Mabini", hub)).toEqual({ lat: 8.55, lng: 123.15 });
    expect(homeChange({ lng: 123.15, lat: 8.55 }, null, hub)).toEqual({ lat: 8.55, lng: 123.15 });
  });
});
