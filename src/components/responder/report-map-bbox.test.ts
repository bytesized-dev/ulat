import { describe, expect, it } from "vitest";
import { reportMapBbox } from "./report-map-bbox";

const home = { lat: 8.65, lng: 123.42 };

describe("reportMapBbox", () => {
  it("frames the house alone without a position", () => {
    const [west, south, east, north] = reportMapBbox(home, null);
    expect(west).toBeLessThan(home.lng);
    expect(east).toBeGreaterThan(home.lng);
    expect(south).toBeLessThan(home.lat);
    expect(north).toBeGreaterThan(home.lat);
    expect(east - west).toBeCloseTo(0.003);
  });

  it("frames the house and a responder nearby, with room around both", () => {
    const you = { lat: 8.66, lng: 123.43 };
    const [west, south, east, north] = reportMapBbox(home, you);
    expect(west).toBeLessThan(home.lng);
    expect(east).toBeGreaterThan(you.lng);
    expect(south).toBeLessThan(home.lat);
    expect(north).toBeGreaterThan(you.lat);
  });

  it("leaves out a responder more than 10 km away", () => {
    expect(reportMapBbox(home, { lat: 9.5, lng: 124 })).toEqual(reportMapBbox(home, null));
  });
});
