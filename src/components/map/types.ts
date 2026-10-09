import type { z } from "zod";
import type { ConfirmedDamageClass, PlaceType } from "@/lib/contracts/schemas";
import type { Bbox, LngLat } from "@/lib/hub/map-projection";

/**
 * What a pin stands for. Damage classes and place types come from the
 * contracts. "none" has no pin, "unvisited" is a family report waiting for a
 * responder, and "you" is the phone's own position.
 */
export type PinKind =
  | Exclude<z.infer<typeof ConfirmedDamageClass>, "none">
  | z.infer<typeof PlaceType>
  | "unvisited"
  | "you";

export type MapPin = LngLat & {
  id: string;
  kind: PinKind;
  /** Read out by screen readers and shown on hover. */
  label: string;
};

/** 1 is the most totally damaged, 3 the least. Barangays left out get no shade. */
export type ShadeLevel = 1 | 2 | 3;

/** Barangay name, as in the `barangays` setting, to its shade. */
export type BarangayShading = Readonly<Record<string, ShadeLevel>>;

export type LegendItem = { kind: PinKind | "shade"; label: string };

/** Barangay outlines. Only the parts the map reads, so any GeoJSON file fits. */
export type BarangayFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
};

export type BarangayCollection = { type: "FeatureCollection"; features: BarangayFeature[] };

/** What MapView hands to whichever engine draws the map. */
export type MapEngineProps = {
  bbox: Bbox;
  pins: readonly MapPin[];
  barangays?: BarangayCollection;
  shading?: BarangayShading;
  selectedId?: string;
  onSelect?: (pin: MapPin) => void;
  label: string;
};

/** Zoom buttons call these, so they work the same on every engine. */
export type MapEngineHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
};
