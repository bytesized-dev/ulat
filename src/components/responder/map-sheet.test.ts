import { describe, expect, it } from "vitest";
import { compassPoint, howFar, parseBbox } from "./map-sheet";

const here = { lat: 8.65, lng: 123.42 };
const fallback = { west: 1, south: 2, east: 3, north: 4 };

describe("compassPoint", () => {
  it("names the cardinal and diagonal directions", () => {
    expect(compassPoint(here, { lat: 8.66, lng: 123.42 })).toBe("north");
    expect(compassPoint(here, { lat: 8.66, lng: 123.43 })).toBe("north-east");
    expect(compassPoint(here, { lat: 8.65, lng: 123.43 })).toBe("east");
    expect(compassPoint(here, { lat: 8.64, lng: 123.42 })).toBe("south");
    expect(compassPoint(here, { lat: 8.65, lng: 123.41 })).toBe("west");
  });
});

describe("howFar", () => {
  it("joins distance and direction", () => {
    expect(howFar(here, { lat: 8.6532, lng: 123.4232 })).toMatch(/^\d+ m north-east$/);
  });

  it("is null without a position", () => {
    expect(howFar(null, here)).toBeNull();
    expect(howFar(here, null)).toBeNull();
  });
});

describe("parseBbox", () => {
  it("reads the setting", () => {
    expect(parseBbox('{"west":5,"south":6,"east":7,"north":8}', fallback)).toEqual([5, 6, 7, 8]);
  });

  it("falls back on a missing, broken or upside down value", () => {
    expect(parseBbox(undefined, fallback)).toEqual([1, 2, 3, 4]);
    expect(parseBbox("nope", fallback)).toEqual([1, 2, 3, 4]);
    expect(parseBbox('{"west":9,"south":6,"east":7,"north":8}', fallback)).toEqual([1, 2, 3, 4]);
  });
});
