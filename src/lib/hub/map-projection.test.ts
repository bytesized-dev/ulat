import { describe, expect, it } from "vitest";
import { mapAssets } from "./map-assets";
import { type Bbox, bboxCenter, fitBbox, fromPercent, inRing, inside, moveBbox, toPercent, zoomBbox } from "./map-projection";

// A stand-in town bbox, about 4 by 3 km, until the real town is picked.
const bbox: Bbox = [124.0, 10.0, 124.04, 10.03];

describe("toPercent", () => {
  it("puts the corners at 0 and 100", () => {
    expect(toPercent({ lng: 124.0, lat: 10.03 }, bbox)).toEqual({ x: 0, y: 0 });
    const se = toPercent({ lng: 124.04, lat: 10.0 }, bbox);
    expect(se.x).toBeCloseTo(100);
    expect(se.y).toBeCloseTo(100);
  });

  it("grows y southwards like the screen", () => {
    const north = toPercent({ lng: 124.02, lat: 10.025 }, bbox);
    const south = toPercent({ lng: 124.02, lat: 10.005 }, bbox);
    expect(south.y).toBeGreaterThan(north.y);
  });
});

describe("fromPercent", () => {
  it("round trips with toPercent, so seed positions land where the canvas shows them", () => {
    for (const pos of [
      { x: 58.8, y: 45.2 },
      { x: 0, y: 100 },
      { x: 29, y: 44.6 },
    ]) {
      const back = toPercent(fromPercent(pos, bbox), bbox);
      expect(back.x).toBeCloseTo(pos.x, 6);
      expect(back.y).toBeCloseTo(pos.y, 6);
    }
  });
});

describe("zoomBbox", () => {
  it("keeps the center and halves the span at factor 2", () => {
    const z = zoomBbox(bbox, 2);
    const center = toPercent({ lng: (z[0] + z[2]) / 2, lat: (z[1] + z[3]) / 2 }, bbox);
    expect(center.x).toBeCloseTo(50, 1);
    expect(center.y).toBeCloseTo(50, 1);
    expect(z[2] - z[0]).toBeCloseTo((bbox[2] - bbox[0]) / 2);
  });

  it("is the same bbox at factor 1", () => {
    zoomBbox(bbox, 1).forEach((v, i) => expect(v).toBeCloseTo(bbox[i]));
  });
});

describe("bboxCenter and moveBbox", () => {
  it("finds the middle of the bbox", () => {
    const mid = bboxCenter(bbox);
    expect(mid.lng).toBeCloseTo(124.02);
    expect(mid.lat).toBeCloseTo(10.015, 3);
  });

  it("slides the bbox to a new center without changing its size", () => {
    const moved = moveBbox(bbox, { lng: 124.1, lat: 10.1 });
    const mid = bboxCenter(moved);
    expect(mid.lng).toBeCloseTo(124.1);
    expect(mid.lat).toBeCloseTo(10.1);
    expect(moved[2] - moved[0]).toBeCloseTo(bbox[2] - bbox[0]);
  });
});

describe("fitBbox", () => {
  it("widens a bbox for a wide frame and keeps the whole town in view", () => {
    const wide = fitBbox(bbox, 3);
    const nw = toPercent({ lng: bbox[0], lat: bbox[3] }, wide);
    const se = toPercent({ lng: bbox[2], lat: bbox[1] }, wide);
    expect(nw.y).toBeCloseTo(0);
    expect(se.y).toBeCloseTo(100);
    expect(nw.x).toBeGreaterThan(0);
    expect(se.x).toBeLessThan(100);
  });

  it("makes a phone shaped frame taller instead", () => {
    const tall = fitBbox(bbox, 390 / 844);
    expect(tall[3] - tall[1]).toBeGreaterThan(bbox[3] - bbox[1]);
    expect(tall[2] - tall[0]).toBeCloseTo(bbox[2] - bbox[0]);
  });

  it("leaves the bbox alone before the frame has a size", () => {
    expect(fitBbox(bbox, 0)).toBe(bbox);
  });
});

describe("inRing", () => {
  const square = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ];

  it("finds points inside and outside a ring", () => {
    expect(inRing({ lng: 0.5, lat: 0.5 }, square)).toBe(true);
    expect(inRing({ lng: 1.5, lat: 0.5 }, square)).toBe(false);
  });
});

describe("inside", () => {
  it("is true only within the map area", () => {
    expect(inside({ x: 50, y: 50 })).toBe(true);
    expect(inside({ x: -1, y: 50 })).toBe(false);
    expect(inside({ x: 50, y: 101 })).toBe(false);
  });
});

describe("mapAssets", () => {
  it("serves every map file from the hub, never from the internet", () => {
    for (const url of Object.values(mapAssets)) {
      expect(url.startsWith("/map/")).toBe(true);
      expect(url).not.toMatch(/^[a-z]+:\/\//);
    }
  });
});
