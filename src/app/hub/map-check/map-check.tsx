"use client";

import { useState } from "react";
import { MapView, type MapPin, shadeByTotals } from "@/components/map";
import {
  damagePins,
  legends,
  placePins,
  reportPins,
  standInBarangays,
  standInBbox,
  totalsByBarangay,
  youPin,
} from "./stand-in";

export type MapCheckView = "hub" | "family" | "responder";

const shading = shadeByTotals(totalsByBarangay);

// Families never see household pins or shading. See docs/SPEC.md 8.
const pinsFor: Record<MapCheckView, MapPin[]> = {
  hub: [...reportPins, ...damagePins, ...placePins],
  family: placePins,
  responder: [...reportPins, ...damagePins, ...placePins.filter((p) => p.kind === "hazard"), youPin],
};

export function MapCheck({ view }: { view: MapCheckView }) {
  const [selected, setSelected] = useState<MapPin | undefined>(damagePins[0]);

  return (
    <MapView
      layout={view === "hub" ? "hub" : "phone"}
      label="Town map"
      bbox={standInBbox}
      barangays={standInBarangays}
      shading={view === "family" ? undefined : shading}
      pins={pinsFor[view]}
      legend={legends[view]}
      selectedId={selected?.id}
      onSelect={setSelected}
      className="h-full"
    />
  );
}
