import { describe, expect, it } from "vitest";
import type { PinKind } from "../../components/map/types";
import { routes } from "../contracts/routes";
import {
  ALL_LAYERS_ON,
  LAYERS,
  layerCounts,
  layerOf,
  nextSelection,
  selectedPoint,
  selectionAfterHide,
  shadingFromRows,
  summarizePoint,
  toggleLayer,
  visiblePins,
} from "./map-layers";
import type { MapPoint } from "./map-pins";

const entryId = "6f1c2c1e-6a3b-4f6e-9a55-0d6b2b9d2c11";

function point(kind: PinKind, id: string, extra: Partial<MapPoint> = {}): MapPoint {
  const source = kind === "unvisited" ? "report" : kind === "total" || kind === "partial" ? "entry" : "place";
  return {
    pin: { id: `${source}-${id}`, kind, lat: 8.65, lng: 123.42, label: id },
    source,
    ref: id,
    title: id,
    detail: null,
    ...extra,
  };
}

const points = [
  point("total", entryId),
  point("total", "b"),
  point("partial", "c"),
  point("unvisited", "ABCD"),
  point("relief", "d"),
  point("shelter", "e"),
  point("shelter", "f"),
  point("hazard", "g"),
];

describe("which layer a pin belongs to", () => {
  it("puts totally and partially damaged houses in Confirmed", () => {
    expect(layerOf("total")).toBe("confirmed");
    expect(layerOf("partial")).toBe("confirmed");
  });

  it("gives reports and places their own layers", () => {
    expect(layerOf("unvisited")).toBe("unvisited");
    expect(layerOf("relief")).toBe("relief");
    expect(layerOf("shelter")).toBe("shelter");
    expect(layerOf("hazard")).toBe("hazard");
  });

  it("gives a phone's own position none", () => {
    expect(layerOf("you")).toBeNull();
  });

  it("lists every layer once, with a toggle for each", () => {
    expect(new Set(LAYERS.map((l) => l.layer))).toEqual(new Set(Object.keys(ALL_LAYERS_ON)));
    expect(LAYERS).toHaveLength(Object.keys(ALL_LAYERS_ON).length);
  });
});

describe("shading", () => {
  const row = (barangay: string, totally: number) =>
    ({ barangay, totally, partially: 0, none: 0, families: 0, people: 0, hurt: 0, missing: 0, waiting: 0, priority: "low" }) as const;

  it("shades barangays by their totally damaged count and leaves the rest bare", () => {
    expect(shadingFromRows([row("Sinonoc", 6), row("Napo", 1), row("Dampalan", 0)])).toEqual({ Sinonoc: 1, Napo: 3 });
  });
});

describe("layer counts", () => {
  it("counts the pins in each layer and the shaded barangays", () => {
    expect(layerCounts(points, { Sinonoc: 1, Napo: 3 }, 3)).toEqual({
      shading: 2,
      confirmed: 3,
      unvisited: 1,
      relief: 1,
      shelter: 2,
      hazard: 1,
    });
  });

  it("is zero everywhere when nothing is confirmed or on the map", () => {
    expect(Object.values(layerCounts([], {}, 0))).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("counts Confirmed from confirmed entries, including houses with no pin", () => {
    // 3 pins on the map, 5 confirmed entries: two have damage class none.
    const counts = layerCounts(points, {}, 5);
    expect(counts.confirmed).toBe(5);
    expect(visiblePins(points, ALL_LAYERS_ON).filter((p) => layerOf(p.kind) === "confirmed")).toHaveLength(3);
  });

  it("still counts the other layers from their pins", () => {
    expect(layerCounts(points, {}, 5)).toMatchObject({ unvisited: 1, relief: 1, shelter: 2, hazard: 1 });
  });

  it("does not change when a layer is turned off", () => {
    const off = toggleLayer(ALL_LAYERS_ON, "shelter");
    expect(visiblePins(points, off)).toHaveLength(6);
    expect(layerCounts(points, {}, 3).shelter).toBe(2);
  });
});

describe("visible pins", () => {
  it("shows every pin with every layer on", () => {
    expect(visiblePins(points, ALL_LAYERS_ON)).toHaveLength(points.length);
  });

  it("hides the pins of a layer that is off, damage dots together", () => {
    const off = toggleLayer(ALL_LAYERS_ON, "confirmed");
    expect(visiblePins(points, off).map((p) => p.kind).sort()).toEqual(["hazard", "relief", "shelter", "shelter", "unvisited"]);
  });

  it("leaves the pins alone when only shading is off", () => {
    expect(visiblePins(points, toggleLayer(ALL_LAYERS_ON, "shading"))).toHaveLength(points.length);
  });

  it("toggles one layer and leaves the others", () => {
    const off = toggleLayer(ALL_LAYERS_ON, "hazard");
    expect(off.hazard).toBe(false);
    expect(off.relief).toBe(true);
    expect(toggleLayer(off, "hazard")).toEqual(ALL_LAYERS_ON);
    expect(ALL_LAYERS_ON.hazard).toBe(true);
  });
});

describe("selection", () => {
  const id = `entry-${entryId}`;

  it("finds the selected point", () => {
    expect(selectedPoint(points, ALL_LAYERS_ON, id)?.ref).toBe(entryId);
  });

  it("selects nothing without a pick", () => {
    expect(selectedPoint(points, ALL_LAYERS_ON, null)).toBeNull();
  });

  it("selects nothing when the point is gone after a refresh", () => {
    expect(selectedPoint(points.slice(1), ALL_LAYERS_ON, id)).toBeNull();
  });

  it("selects nothing when its layer is off", () => {
    expect(selectedPoint(points, toggleLayer(ALL_LAYERS_ON, "confirmed"), id)).toBeNull();
  });

  it("clears the selection when the selected pin's layer goes off, so it stays cleared when the layer returns", () => {
    expect(selectionAfterHide(points, id, "confirmed")).toBeNull();
    // Off, then on again: nothing is selected, where selectedPoint alone would bring the pin back.
    const back = ALL_LAYERS_ON;
    expect(selectedPoint(points, back, selectionAfterHide(points, id, "confirmed"))).toBeNull();
    expect(selectedPoint(points, back, id)?.ref).toBe(entryId);
  });

  it("keeps the selection when another layer goes off", () => {
    expect(selectionAfterHide(points, id, "hazard")).toBe(id);
    expect(selectionAfterHide(points, id, "shading")).toBe(id);
    expect(selectionAfterHide(points, null, "confirmed")).toBeNull();
  });

  it("picks a pin, clears it when picked again, and moves to another", () => {
    expect(nextSelection(null, "a")).toBe("a");
    expect(nextSelection("a", "a")).toBeNull();
    expect(nextSelection("a", "b")).toBe("b");
  });
});

describe("what the rail says about a point", () => {
  it("links a confirmed entry to its page", () => {
    expect(summarizePoint(point("total", entryId))).toEqual({
      status: "Totally damaged",
      tone: "danger",
      action: { label: "Open entry", href: routes.hub.entry(entryId) },
    });
    expect(summarizePoint(point("partial", entryId))).toMatchObject({ status: "Partially damaged", tone: "warning" });
  });

  it("sends a report to the family reports", () => {
    expect(summarizePoint(point("unvisited", "ABCD"))).toMatchObject({
      status: "Not visited",
      action: { label: "Open family reports", href: routes.hub.familyReports },
    });
  });

  it("names a place by its type and gives it no link", () => {
    expect(summarizePoint(point("relief", "x"))).toMatchObject({ status: "Relief point", action: null });
    expect(summarizePoint(point("shelter", "x"))).toMatchObject({ status: "Shelter", action: null });
    expect(summarizePoint(point("hazard", "x"))).toMatchObject({ status: "Hazard", action: null });
  });
});
