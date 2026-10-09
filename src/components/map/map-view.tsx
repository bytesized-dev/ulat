"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MapLegend } from "./map-legend";
import { SchematicMap } from "./schematic-map";
import type { LegendItem, MapEngineHandle, MapEngineProps } from "./types";
import { ZoomControls } from "./zoom-controls";

// MapLibre needs the browser and WebGL, so it loads on the client only.
const MaplibreMap = dynamic(() => import("./maplibre-map").then((m) => m.MaplibreMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map-land" />,
});

/**
 * The pin's tip sits on the exact middle of the map, so the spot under the tip is the map center.
 * The tip is at y=21 of the 24 unit box, so the pin rises 7/8 of its height, not all of it.
 */
function CenterPin() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      className="pointer-events-none absolute top-1/2 left-1/2 size-11 -translate-x-1/2 -translate-y-7/8 fill-primary text-canvas"
    >
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" stroke="currentColor" />
      <circle cx="12" cy="9.5" r="2.5" className="fill-canvas" />
    </svg>
  );
}

export type MapViewProps = MapEngineProps & {
  /** Phones show the legend as a card over the map with full bleed edges. The hub rounds the map and puts the legend in a row below. */
  layout?: "phone" | "hub";
  legend?: readonly LegendItem[];
  zoomControls?: boolean;
  /** A pin fixed at the middle of the map, for picking a spot by moving the map under it. Read the spot with onMove. */
  centerPin?: boolean;
  className?: string;
};

/*
  The one map for the family, responder and hub screens. Screens pass pins,
  shading and a legend; the engine underneath draws them.

  MaplibreMap draws the town's offline tiles. Where WebGL is missing, as on
  some older phones, SchematicMap draws the same props without tiles.
*/
export function MapView({ layout = "phone", legend = [], zoomControls = true, centerPin = false, className, ...engine }: MapViewProps) {
  const engineRef = useRef<MapEngineHandle>(null);
  const [noWebGL, setNoWebGL] = useState(false);

  return (
    <div className={cn("flex min-h-0 flex-col", layout === "hub" && "gap-6", className)}>
      <div className={cn("relative min-h-0 flex-1 overflow-hidden", layout === "hub" && "rounded-lg")}>
        {noWebGL ? (
          <SchematicMap ref={engineRef} {...engine} />
        ) : (
          <MaplibreMap ref={engineRef} {...engine} onFail={() => setNoWebGL(true)} />
        )}
        {/* ODbL needs the OpenStreetMap credit and CC BY-IGO needs the boundary credit, wherever the map shows. */}
        <p className="pointer-events-none absolute right-16 bottom-1 left-2 w-fit rounded-sm bg-canvas/80 px-1 text-caption-strong text-body">
          © OpenStreetMap contributors. Boundaries: OCHA, PSA, NAMRIA
        </p>
        {centerPin && <CenterPin />}
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
