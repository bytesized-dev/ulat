"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  addProtocol,
  type ExpressionSpecification,
  type GeoJSONSource,
  Map as MapLibre,
  Marker,
  setWorkerUrl,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import { type Ref, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { barangayNameProperty, mapAssets, tilesBounds } from "@/lib/hub/map-assets";
import type { Bbox } from "@/lib/hub/map-projection";
import { type MapPalette, mapStyle } from "@/lib/hub/map-style";
import { readPalette } from "./map-palette";
import { PinTarget } from "./pin-mark";
import { shadingFillColor } from "./shading";
import type { MapEngineHandle, MapEngineProps, PinKind } from "./types";

/*
  The real map: the town's PMTiles drawn by MapLibre, all served by the hub.
  Barangay shading sits under the roads, outlines and names on top. Pins are
  the same React marks as the schematic engine, placed with MapLibre markers.
*/

// Later kinds draw on top: reports under damage, damage under places, you on top.
const stacking: PinKind[] = ["unvisited", "partial", "total", "shelter", "relief", "hazard", "you"];

const padding = 16;
const transparent = "rgba(0, 0, 0, 0)";

let prepared = false;
function prepare() {
  if (prepared) return;
  setWorkerUrl(mapAssets.worker);
  addProtocol("pmtiles", new Protocol().tile);
  prepared = true;
}

const asBounds = (b: Bbox): [number, number, number, number] => [b[0], b[1], b[2], b[3]];

export function MaplibreMap({
  ref,
  bbox,
  pins,
  barangays,
  shading = {},
  selectedId,
  onSelect,
  label,
  onFail,
}: MapEngineProps & { ref?: Ref<MapEngineHandle>; onFail: () => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibre | null>(null);
  const [palette, setPalette] = useState<MapPalette | null>(null);
  const start = useRef({ bbox, onFail });

  useEffect(() => {
    const container = frame.current;
    if (!container) return;
    prepare();
    const colors = readPalette();
    let instance: MapLibre;
    try {
      instance = new MapLibre({
        container,
        style: mapStyle(window.location.origin, colors),
        bounds: asBounds(start.current.bbox),
        fitBoundsOptions: { padding },
        maxBounds: asBounds(tilesBounds),
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      // No WebGL on this phone. MapView falls back to the schematic map.
      start.current.onFail();
      return;
    }
    instance.touchZoomRotate.disableRotation();
    instance.on("load", () => {
      setPalette(colors);
      setMap(instance);
    });
    return () => instance.remove();
  }, []);

  useImperativeHandle(ref, () => ({ zoomIn: () => map?.zoomIn(), zoomOut: () => map?.zoomOut() }), [map]);

  // A new bbox, for example another barangay, moves the map there.
  const bboxKey = bbox.join(",");
  useEffect(() => {
    map?.fitBounds(asBounds(bbox), { padding, animate: false });
    // bbox is compared by value through bboxKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, bboxKey]);

  // Barangay outlines, names and shading.
  useEffect(() => {
    if (!map || !palette) return;
    const empty = { type: "FeatureCollection" as const, features: [] };
    const data = barangays ?? empty;
    const source = map.getSource<GeoJSONSource>("barangays");
    if (source) {
      source.setData(data);
    } else {
      map.addSource("barangays", { type: "geojson", data });
      // Under water and roads, so shaded barangays keep their streets and coast.
      map.addLayer({ id: "barangay-fill", type: "fill", source: "barangays", paint: { "fill-color": transparent } }, "water");
      map.addLayer({
        id: "barangay-line",
        type: "line",
        source: "barangays",
        paint: { "line-color": palette.boundary, "line-width": 1, "line-dasharray": [3, 2] },
      });
      map.addLayer({
        id: "barangay-name",
        type: "symbol",
        source: "barangays",
        layout: {
          "text-field": ["get", barangayNameProperty],
          "text-font": ["Noto Sans Medium"],
          "text-size": 13,
          "text-max-width": 8,
        },
        paint: { "text-color": palette.label, "text-halo-color": palette.halo, "text-halo-width": 1.5 },
      });
    }
    const fill = shadingFillColor(
      shading,
      barangayNameProperty,
      { 1: palette.shade1, 2: palette.shade2, 3: palette.shade3 },
      transparent,
    );
    map.setPaintProperty("barangay-fill", "fill-color", fill as ExpressionSpecification | string);
  }, [map, palette, barangays, shading]);

  // One element per pin, in stacking order. React renders each pin into its
  // element through a portal, and a MapLibre marker places the element.
  const targets = useMemo(
    () =>
      [...pins]
        .sort((a, b) => stacking.indexOf(a.kind) - stacking.indexOf(b.kind))
        .map((pin) => ({ pin, element: document.createElement("div") })),
    [pins],
  );
  useEffect(() => {
    if (!map) return;
    const markers = targets.map(({ pin, element }) =>
      new Marker({ element, anchor: "center" }).setLngLat([pin.lng, pin.lat]).addTo(map),
    );
    return () => markers.forEach((marker) => marker.remove());
  }, [map, targets]);

  // The selected pin draws above the rest. Set on the marker, which MapLibre positions.
  useEffect(() => {
    for (const { pin, element } of targets) element.classList.toggle("z-10", pin.id === selectedId);
  }, [targets, selectedId]);

  return (
    <div role="group" aria-label={label} className="absolute inset-0 bg-map-land">
      {/* MapLibre makes its container position: relative, so it gets its own box that fills the frame. */}
      <div ref={frame} className="size-full" />
      {targets.map(({ pin, element }) =>
        createPortal(<PinTarget pin={pin} selected={pin.id === selectedId} onSelect={onSelect} />, element, pin.id),
      )}
    </div>
  );
}
