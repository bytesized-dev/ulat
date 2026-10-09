"use client";

import { type BarangayShading, type LegendItem, MapView, type MapPin } from "@/components/map";
import type { Bbox } from "@/lib/hub/map-projection";
import { useBarangays } from "./use-barangays";

// The hub legend from design/screens/hub/overview.html and map.html.
const legend: LegendItem[] = [
  { kind: "shade", label: "More damage" },
  { kind: "total", label: "Totally" },
  { kind: "partial", label: "Partially" },
  { kind: "unvisited", label: "Not visited" },
  { kind: "relief", label: "Relief" },
  { kind: "shelter", label: "Shelter" },
  { kind: "hazard", label: "Hazard" },
];

type DamageMapProps = {
  bbox: Bbox;
  pins: readonly MapPin[];
  /** Each barangay's shade, from its totally damaged count. Left out, nothing is shaded. */
  shading?: BarangayShading;
  /** With onSelect, pins are buttons and the selected one is drawn larger. */
  selectedId?: string;
  onSelect?: (pin: MapPin) => void;
  className?: string;
};

/** Damage by barangay: shading, entry and report dots, and places. Shared by the overview and the map page. */
export function DamageMap({ bbox, pins, shading, selectedId, onSelect, className }: DamageMapProps) {
  const barangays = useBarangays();
  return (
    <MapView
      layout="hub"
      label="Damage by barangay map"
      bbox={bbox}
      pins={pins}
      barangays={barangays}
      shading={shading}
      selectedId={selectedId}
      onSelect={onSelect}
      legend={legend}
      className={className}
    />
  );
}
