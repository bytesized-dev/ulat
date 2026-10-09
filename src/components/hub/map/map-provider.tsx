"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLiveRefresh } from "@/components/hub/use-live-refresh";
import type { BarangayShading, MapPin } from "@/components/map";
import type { BarangayRow } from "@/lib/contracts";
import { changesMap } from "@/lib/hub/live-refresh";
import {
  ALL_LAYERS_ON,
  type LayerVisibility,
  type MapLayer,
  layerCounts,
  nextSelection,
  selectedPoint,
  shadingFromRows,
  toggleLayer,
  visiblePins,
} from "@/lib/hub/map-layers";
import type { MapPoint } from "@/lib/hub/map-pins";
import type { Bbox } from "@/lib/hub/map-projection";

// The map sits in the page and the layers and selected pin in the rail, so the
// state they share lives in this provider around the whole hub shell, like the
// add a point page. The page passes what the server read; a live event asks
// the server for it again and the props change under the same state, so the
// toggles and the selected pin stay where they are.

type HubMapState = {
  bbox: Bbox;
  pins: MapPin[];
  /** The shade of each barangay, or nothing when the Barangay shading layer is off. */
  shading: BarangayShading;
  counts: Record<MapLayer, number>;
  layers: LayerVisibility;
  toggle: (layer: MapLayer) => void;
  selected: MapPoint | null;
  select: (pin: MapPin) => void;
};

const HubMapContext = React.createContext<HubMapState | null>(null);

export function useHubMap(): HubMapState {
  const value = React.useContext(HubMapContext);
  if (!value) throw new Error("Wrap the hub map page in HubMapProvider.");
  return value;
}

type HubMapProviderProps = {
  /** The town's box from the map_bbox setting. */
  bbox: Bbox;
  points: MapPoint[];
  /** The barangay rows from the summary, which decide the shading. */
  rows: BarangayRow[];
  children: React.ReactNode;
};

export function HubMapProvider({ bbox, points, rows, children }: HubMapProviderProps) {
  const router = useRouter();
  const [layers, setLayers] = React.useState<LayerVisibility>(ALL_LAYERS_ON);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  useLiveRefresh(changesMap, () => router.refresh());

  const value = React.useMemo<HubMapState>(() => {
    const shading = shadingFromRows(rows);
    return {
      bbox,
      pins: visiblePins(points, layers),
      shading: layers.shading ? shading : {},
      counts: layerCounts(points, shading),
      layers,
      toggle: (layer) => setLayers((current) => toggleLayer(current, layer)),
      selected: selectedPoint(points, layers, selectedId),
      select: (pin) => setSelectedId((current) => nextSelection(current, pin.id)),
    };
  }, [bbox, points, rows, layers, selectedId]);

  return <HubMapContext.Provider value={value}>{children}</HubMapContext.Provider>;
}
