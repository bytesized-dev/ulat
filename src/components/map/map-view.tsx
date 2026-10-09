"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { MapLegend } from "./map-legend";
import { SchematicMap } from "./schematic-map";
import type { LegendItem, MapEngineHandle, MapEngineProps } from "./types";
import { ZoomControls } from "./zoom-controls";

export type MapViewProps = MapEngineProps & {
  /** Phones show the legend as a card over the map with full bleed edges. The hub rounds the map and puts the legend in a row below. */
  layout?: "phone" | "hub";
  legend?: readonly LegendItem[];
  zoomControls?: boolean;
  className?: string;
};

/*
  The one map for the family, responder and hub screens. Screens pass pins,
  shading and a legend; the engine underneath draws them.

  Engine: SchematicMap until maplibre-gl and pmtiles are added (BYT-4 needs
  them from Platform). Then MaplibreMap renders the local PMTiles with the
  same MapEngineProps, and SchematicMap stays as the fallback when WebGL is
  missing. Screens do not change when the engine does.
*/
export function MapView({ layout = "phone", legend = [], zoomControls = true, className, ...engine }: MapViewProps) {
  const engineRef = useRef<MapEngineHandle>(null);

  return (
    <div className={cn("flex min-h-0 flex-col", layout === "hub" && "gap-6", className)}>
      <div className={cn("relative min-h-0 flex-1 overflow-hidden", layout === "hub" && "rounded-lg")}>
        <SchematicMap ref={engineRef} {...engine} />
        {layout === "phone" && <MapLegend items={legend} placement="card" />}
        {zoomControls && (
          <ZoomControls
            onZoomIn={() => engineRef.current?.zoomIn()}
            onZoomOut={() => engineRef.current?.zoomOut()}
          />
        )}
      </div>
      {layout === "hub" && <MapLegend items={legend} placement="row" />}
    </div>
  );
}
