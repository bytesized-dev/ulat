"use client";

import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { barangayNameProperty } from "@/lib/hub/map-assets";
import { type Bbox, type Percent, fitBbox, inside, toPercent, zoomBbox } from "@/lib/hub/map-projection";
import { cn } from "@/lib/utils";
import { PinMark } from "./pin-mark";
import { barangayName } from "./shading";
import type { BarangayFeature, MapEngineHandle, MapEngineProps, MapPin, PinKind } from "./types";

/*
  The map without tiles: barangay outlines, shading, names and pins drawn in
  plain SVG and HTML over the land color. MapView uses it until MapLibre is
  in, and keeps it as the fallback for phones that cannot run WebGL. It takes
  the same props as the MapLibre engine, so screens never know which one drew.
*/

const maxZoom = 8;

const shadeFill = {
  1: "fill-map-shade-1",
  2: "fill-map-shade-2",
  3: "fill-map-shade-3",
} as const;

// Later kinds draw on top: reports under damage, damage under places, you on top.
const stacking: PinKind[] = ["unvisited", "partial", "total", "shelter", "relief", "hazard", "you"];

/**
 * Pins and labels sit at a geographic position the engine works out each
 * render, the same way MapLibre places its markers. It is data, not a design
 * value, so it is set on the element rather than written as a class.
 */
function placeAt(point: Percent) {
  return (el: HTMLElement | null) => {
    if (!el) return;
    el.style.left = `${point.x}%`;
    el.style.top = `${point.y}%`;
  };
}

function outerRings(feature: BarangayFeature): number[][][] {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates[0]]
    : feature.geometry.coordinates.map((polygon) => polygon[0]);
}

function ringPoints(ring: number[][], view: Bbox): string {
  return ring
    .map(([lng, lat]) => {
      const p = toPercent({ lng, lat }, view);
      // Rounded so the server and browser math agree, and the markup stays small.
      return `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    })
    .join(" ");
}

/** Average of the largest outer ring's corners. Good enough for a label on a town map. */
function labelPoint(feature: BarangayFeature, view: Bbox): Percent {
  const ring = outerRings(feature).reduce((a, b) => (b.length > a.length ? b : a));
  const sum = ring.reduce((acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }), { lng: 0, lat: 0 });
  return toPercent({ lng: sum.lng / ring.length, lat: sum.lat / ring.length }, view);
}

export function SchematicMap({
  ref,
  bbox,
  pins,
  barangays,
  shading = {},
  selectedId,
  onSelect,
  label,
}: MapEngineProps & { ref?: Ref<MapEngineHandle> }) {
  const [zoom, setZoom] = useState(1);
  useImperativeHandle(ref, () => ({
    zoomIn: () => setZoom((z) => Math.min(z * 2, maxZoom)),
    zoomOut: () => setZoom((z) => Math.max(z / 2, 1)),
  }));

  // Fit the town to the frame's shape so nothing is stretched, then zoom about the center.
  const frame = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(0);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setAspect(height > 0 ? width / height : 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const view = zoomBbox(fitBbox(bbox, aspect), zoom);
  const features = barangays?.features ?? [];
  const ordered = [...pins].sort(
    (a, b) =>
      Number(a.id === selectedId) - Number(b.id === selectedId) || stacking.indexOf(a.kind) - stacking.indexOf(b.kind),
  );

  return (
    <div ref={frame} role="group" aria-label={label} className="absolute inset-0 overflow-hidden bg-map-land">
      <svg aria-hidden className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {features.map((feature, i) => {
          const name = barangayName(feature.properties, barangayNameProperty);
          const level = name ? shading[name] : undefined;
          return outerRings(feature).map((ring, j) => (
            <polygon
              key={`${name ?? i}-${j}`}
              points={ringPoints(ring, view)}
              className={cn(level ? shadeFill[level] : "fill-transparent", "stroke-map-boundary")}
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          ));
        })}
      </svg>

      {features.map((feature, i) => {
        const name = barangayName(feature.properties, barangayNameProperty);
        const at = labelPoint(feature, view);
        if (!name || !inside(at)) return null;
        return (
          <span
            key={`${name}-${i}`}
            ref={placeAt(at)}
            aria-hidden
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-caption font-semibold whitespace-nowrap text-body"
          >
            {name}
          </span>
        );
      })}

      {ordered.map((pin) => {
        const at = toPercent(pin, view);
        if (!inside(at)) return null;
        return (
          <PinButton key={pin.id} pin={pin} at={at} selected={pin.id === selectedId} onSelect={onSelect} />
        );
      })}
    </div>
  );
}

function PinButton({
  pin,
  at,
  selected,
  onSelect,
}: {
  pin: MapPin;
  at: Percent;
  selected: boolean;
  onSelect?: (pin: MapPin) => void;
}) {
  const mark = <PinMark kind={pin.kind} at={selected ? "selected" : "map"} />;
  const position = "absolute -translate-x-1/2 -translate-y-1/2";
  if (!onSelect) {
    return (
      <span ref={placeAt(at)} title={pin.label} className={cn(position, "pointer-events-none")}>
        {mark}
      </span>
    );
  }
  return (
    <button
      type="button"
      ref={placeAt(at)}
      title={pin.label}
      aria-label={pin.label}
      aria-pressed={selected}
      onClick={() => onSelect(pin)}
      className={cn(position, "flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary")}
    >
      {mark}
    </button>
  );
}
