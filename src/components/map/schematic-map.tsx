"use client";

import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { barangayNameProperty } from "@/lib/hub/map-assets";
import {
  type Bbox,
  type LngLat,
  type Percent,
  bboxCenter,
  fitBbox,
  fromPercent,
  inside,
  moveBbox,
  toPercent,
  zoomBbox,
} from "@/lib/hub/map-projection";
import { cn } from "@/lib/utils";
import { PinTarget } from "./pin-mark";
import { barangayName } from "./shading";
import type { BarangayFeature, MapEngineHandle, MapEngineProps, PinKind } from "./types";

/*
  The map without tiles: barangay outlines, shading, names and pins drawn in
  plain SVG and HTML over the land color. MapView uses it until MapLibre is
  in, and keeps it as the fallback for phones that cannot run WebGL. It takes
  the same props as the MapLibre engine, so screens never know which one drew.
*/

const maxZoom = 8;

// How far a pointer travels, in px, before a press is a drag and not a tap.
const dragSlop = 4;

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
  focus,
  onMove,
  label,
}: MapEngineProps & { ref?: Ref<MapEngineHandle> }) {
  const [zoom, setZoom] = useState(1);
  // Where the view is centered. Null until panned or focused, which keeps the town bbox as it was.
  const [middle, setMiddle] = useState<LngLat | null>(null);
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

  const fitted = fitBbox(bbox, aspect);
  const view = zoomBbox(middle ? moveBbox(fitted, middle) : fitted, zoom);
  const center = bboxCenter(view);

  // A GPS fix or saved spot moves the view there, close in. Compared by value, and
  // adjusted while rendering so the map never draws one frame at the old spot.
  const focusKey = focus ? `${focus.lng},${focus.lat}` : "";
  const [seenFocus, setSeenFocus] = useState("");
  if (focusKey !== seenFocus) {
    setSeenFocus(focusKey);
    if (focus) {
      setMiddle({ lng: focus.lng, lat: focus.lat });
      setZoom(maxZoom);
    }
  }

  // Tell the screen where the middle is, so a center pin can read the spot under it.
  const moved = useRef(onMove);
  useEffect(() => {
    moved.current = onMove;
  });
  useEffect(() => {
    if (aspect > 0) moved.current?.({ lng: center.lng, lat: center.lat });
  }, [aspect, center.lng, center.lat]);

  // Dragging slides the view the way a thumb would, so the point under the pointer stays put.
  // The frame takes the pointer once it has moved, so a release outside the frame still
  // ends the drag. Not at pointerdown: a tap on a pin would then click the frame, not the pin.
  const drag = useRef<{ id: number; x: number; y: number; captured: boolean } | null>(null);
  function pan(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    const el = frame.current;
    if (!start || !el || event.pointerId !== start.id) return;
    if (!start.captured) {
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < dragSlop) return;
      el.setPointerCapture(event.pointerId);
      start.captured = true;
    }
    const { width, height } = el.getBoundingClientRect();
    if (!(width > 0) || !(height > 0)) return;
    const dx = ((event.clientX - start.x) / width) * 100;
    const dy = ((event.clientY - start.y) / height) * 100;
    drag.current = { ...start, x: event.clientX, y: event.clientY };
    setMiddle(fromPercent({ x: 50 - dx, y: 50 - dy }, view));
  }
  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const features = barangays?.features ?? [];
  const ordered = [...pins].sort(
    (a, b) =>
      Number(a.id === selectedId) - Number(b.id === selectedId) || stacking.indexOf(a.kind) - stacking.indexOf(b.kind),
  );

  return (
    <div
      ref={frame}
      role="group"
      aria-label={label}
      className="absolute inset-0 touch-none overflow-hidden bg-map-land"
      onPointerDown={(event) => {
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, captured: false };
      }}
      onPointerMove={pan}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
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
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-caption font-semibold whitespace-nowrap text-muted-foreground"
          >
            {name}
          </span>
        );
      })}

      {ordered.map((pin) => {
        const at = toPercent(pin, view);
        if (!inside(at)) return null;
        return (
          <PinTarget
            key={pin.id}
            ref={placeAt(at)}
            pin={pin}
            selected={pin.id === selectedId}
            onSelect={onSelect}
            className="absolute -translate-x-1/2 -translate-y-1/2"
          />
        );
      })}
    </div>
  );
}
