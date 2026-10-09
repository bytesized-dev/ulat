"use client";

import { useState } from "react";
import { type BarangayCollection, type BarangayShading, type LegendItem, MapView, type MapPin } from "@/components/map";
import type { Bbox } from "@/lib/hub/map-projection";

export type MapCheckView = "hub" | "family" | "responder";

export function MapCheck({
  view,
  initialSelectedId,
  ...map
}: {
  view: MapCheckView;
  bbox: Bbox;
  barangays: BarangayCollection;
  shading?: BarangayShading;
  pins: MapPin[];
  legend: LegendItem[];
  initialSelectedId?: string;
}) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);

  return (
    <MapView
      layout={view === "hub" ? "hub" : "phone"}
      label="Dapitan City map"
      selectedId={selectedId}
      onSelect={(pin) => setSelectedId(pin.id)}
      className="h-full"
      {...map}
    />
  );
}
