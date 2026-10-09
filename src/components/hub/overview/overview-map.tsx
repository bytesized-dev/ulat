"use client";

import { useEffect, useMemo, useState } from "react";
import { type BarangayCollection, type LegendItem, MapView, type MapPin, shadeByTotals } from "@/components/map";
import type { BarangayRow } from "@/lib/contracts";
import { mapAssets } from "@/lib/hub/map-assets";
import type { Bbox } from "@/lib/hub/map-projection";

// The hub legend from design/screens/hub/overview.html.
const legend: LegendItem[] = [
  { kind: "shade", label: "More damage" },
  { kind: "total", label: "Totally" },
  { kind: "partial", label: "Partially" },
  { kind: "unvisited", label: "Not visited" },
  { kind: "relief", label: "Relief" },
  { kind: "shelter", label: "Shelter" },
  { kind: "hazard", label: "Hazard" },
];

// The boundaries are about 86 KB and never change during a storm, so they load
// once per tab from the hub instead of riding along with every live refresh.
let boundaries: Promise<BarangayCollection | undefined> | null = null;

function loadBoundaries(): Promise<BarangayCollection | undefined> {
  boundaries ??= fetch(mapAssets.barangays)
    .then((response) => (response.ok ? (response.json() as Promise<BarangayCollection>) : undefined))
    .catch(() => {
      boundaries = null;
      return undefined;
    });
  return boundaries;
}

type OverviewMapProps = {
  bbox: Bbox;
  pins: MapPin[];
  /** The live rows from the summary. Shading follows each barangay's totally damaged count. */
  rows: BarangayRow[];
};

/** Damage by barangay: shading, entry and report dots, and places. */
export function OverviewMap({ bbox, pins, rows }: OverviewMapProps) {
  const [barangays, setBarangays] = useState<BarangayCollection>();

  useEffect(() => {
    let live = true;
    void loadBoundaries().then((collection) => {
      if (live && collection) setBarangays(collection);
    });
    return () => {
      live = false;
    };
  }, []);

  const shading = useMemo(() => shadeByTotals(Object.fromEntries(rows.map((r) => [r.barangay, r.totally]))), [rows]);

  return (
    <MapView
      layout="hub"
      label="Damage by barangay map"
      bbox={bbox}
      pins={pins}
      barangays={barangays}
      shading={shading}
      legend={legend}
      className="h-144"
    />
  );
}
