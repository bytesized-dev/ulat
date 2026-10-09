import { shadeByTotals } from "../../components/map/shading";
import type { BarangayShading, MapPin, PinKind } from "../../components/map/types";
import type { BarangayRow } from "../contracts/schemas";
import { routes } from "../contracts/routes";
import type { MapPoint } from "./map-pins";

// The layer toggles on the hub map and the pin selection that goes with them.
// Every number here is a count of what the server read from SQL; nothing is
// estimated. docs/SPEC.md section 8 lists the layers.

export type MapLayer = "shading" | "confirmed" | "unvisited" | "relief" | "shelter" | "hazard";

export type LayerVisibility = Readonly<Record<MapLayer, boolean>>;

type LayerInfo = { layer: MapLayer; label: string; /** The mark drawn beside the label, the same as the legend. */ swatch: PinKind | "shade" };

/** In the order the rail lists them. The labels are the ones in design/screens/hub/map.html. */
export const LAYERS: readonly LayerInfo[] = [
  { layer: "shading", label: "Barangay shading", swatch: "shade" },
  { layer: "confirmed", label: "Confirmed", swatch: "total" },
  { layer: "unvisited", label: "Not visited", swatch: "unvisited" },
  { layer: "relief", label: "Relief", swatch: "relief" },
  { layer: "shelter", label: "Shelters", swatch: "shelter" },
  { layer: "hazard", label: "Hazards", swatch: "hazard" },
];

export const ALL_LAYERS_ON: LayerVisibility = {
  shading: true,
  confirmed: true,
  unvisited: true,
  relief: true,
  shelter: true,
  hazard: true,
};

/** The layer a pin belongs to. Totally and partially damaged houses are one layer, Confirmed. "you" is a phone's own spot and has none. */
export function layerOf(kind: PinKind): Exclude<MapLayer, "shading"> | null {
  switch (kind) {
    case "total":
    case "partial":
      return "confirmed";
    case "unvisited":
    case "relief":
    case "shelter":
    case "hazard":
      return kind;
    default:
      return null;
  }
}

/** Each barangay's shade, from its totally damaged count in the summary. */
export function shadingFromRows(rows: readonly BarangayRow[]): BarangayShading {
  return shadeByTotals(Object.fromEntries(rows.map((r) => [r.barangay, r.totally])));
}

export function toggleLayer(visibility: LayerVisibility, layer: MapLayer): LayerVisibility {
  return { ...visibility, [layer]: !visibility[layer] };
}

/**
 * How many things each toggle controls: pins for the pin layers, shaded
 * barangays for shading. Counted whether or not the layer is on, so a
 * hidden layer still says what it would show.
 */
export function layerCounts(points: readonly MapPoint[], shading: BarangayShading): Record<MapLayer, number> {
  const counts: Record<MapLayer, number> = { shading: Object.keys(shading).length, confirmed: 0, unvisited: 0, relief: 0, shelter: 0, hazard: 0 };
  for (const { pin } of points) {
    const layer = layerOf(pin.kind);
    if (layer) counts[layer] += 1;
  }
  return counts;
}

function isShown(point: MapPoint, visibility: LayerVisibility): boolean {
  const layer = layerOf(point.pin.kind);
  return layer !== null && visibility[layer];
}

/** The pins of the layers that are on. */
export function visiblePins(points: readonly MapPoint[], visibility: LayerVisibility): MapPin[] {
  return points.filter((point) => isShown(point, visibility)).map((point) => point.pin);
}

/**
 * The point to show in the rail. Nothing when no pin is picked, when the
 * point is gone after a refresh, or when its layer has been turned off.
 */
export function selectedPoint(points: readonly MapPoint[], visibility: LayerVisibility, selectedId: string | null): MapPoint | null {
  if (selectedId === null) return null;
  const point = points.find((p) => p.pin.id === selectedId);
  return point && isShown(point, visibility) ? point : null;
}

/** Picking the pin that is already selected clears the selection. */
export function nextSelection(current: string | null, picked: string): string | null {
  return current === picked ? null : picked;
}

export type PointSummary = {
  /** The pill text under the heading. */
  status: string;
  tone: "danger" | "warning" | "primary" | "muted-soft";
  /** Where the rail links. Places have no page of their own. */
  action: { label: string; href: string } | null;
};

/** What the rail says about a selected point, by what kind of point it is. */
export function summarizePoint(point: MapPoint): PointSummary {
  switch (point.pin.kind) {
    case "total":
      return { status: "Totally damaged", tone: "danger", action: { label: "Open entry", href: routes.hub.entry(point.ref) } };
    case "partial":
      return { status: "Partially damaged", tone: "warning", action: { label: "Open entry", href: routes.hub.entry(point.ref) } };
    case "unvisited":
      return { status: "Not visited", tone: "muted-soft", action: { label: "Open family reports", href: routes.hub.familyReports } };
    case "relief":
      return { status: "Relief point", tone: "primary", action: null };
    case "shelter":
      return { status: "Shelter", tone: "muted-soft", action: null };
    case "hazard":
      return { status: "Hazard", tone: "warning", action: null };
    default:
      return { status: "Position", tone: "muted-soft", action: null };
  }
}
