import { describe, expect, it } from "vitest";
import { filterPlaces, parseMapBbox, parsePlaces, placeLine, placePins } from "./map-places";

const row = (id: string, type: string) => ({ id, type, name: `Place ${id}`, details: "Town plaza", when_text: "Today, 3 to 5 PM", lat: 8.6, lng: 123.4, visible: true, created_at: "x" });

describe("places", () => {
  const places = parsePlaces({ places: [row("a", "relief"), row("b", "shelter"), row("c", "hazard"), row("d", "household"), { id: "e" }] });

  it("keeps only relief points, shelters and hazards", () => {
    expect(places.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("skips a place MDRRMO hid, which the route still returns to a staff session", () => {
    const list = parsePlaces({ places: [row("a", "relief"), { ...row("h", "shelter"), visible: false }, { ...row("m", "hazard"), visible: undefined }] });
    expect(list.map((p) => p.id)).toEqual(["a"]);
  });

  it("filters by kind", () => {
    expect(filterPlaces(places, "all")).toHaveLength(3);
    expect(filterPlaces(places, "shelter").map((p) => p.id)).toEqual(["b"]);
  });

  it("makes a pin of the same kind for each place", () => {
    expect(placePins(places).map((p) => p.kind)).toEqual(["relief", "shelter", "hazard"]);
  });

  it("gives an empty list for a bad body", () => {
    expect(parsePlaces(null)).toEqual([]);
  });
});

describe("placeLine", () => {
  it("joins the details and the time", () => {
    expect(placeLine({ details: "Town plaza", when_text: "Today, 3 to 5 PM" })).toBe("Town plaza. Today, 3 to 5 PM.");
    expect(placeLine({ details: "Town plaza.", when_text: null })).toBe("Town plaza.");
    expect(placeLine({ details: null, when_text: " " })).toBeNull();
  });
});

describe("parseMapBbox", () => {
  const fallback = { west: 1, south: 2, east: 3, north: 4 };
  it("reads a good setting and falls back otherwise", () => {
    expect(parseMapBbox(JSON.stringify({ west: 10, south: 20, east: 30, north: 40 }), fallback)).toEqual([10, 20, 30, 40]);
    expect(parseMapBbox("nope", fallback)).toEqual([1, 2, 3, 4]);
    expect(parseMapBbox(JSON.stringify({ west: 30, south: 20, east: 10, north: 40 }), fallback)).toEqual([1, 2, 3, 4]);
    expect(parseMapBbox(undefined, fallback)).toEqual([1, 2, 3, 4]);
  });
});
