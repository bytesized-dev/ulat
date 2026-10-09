"use client";

import * as React from "react";
import { MapView, type BarangayCollection, type MapPin } from "@/components/map";
import { Pill } from "@/components/ui/pill";
import type { Bbox } from "@/lib/hub/map-projection";
import { AddPointForm } from "./add-point-form";

type Position = { lat: number; lng: number } | null;

// The map sits in the page and the form in the rail, so the pin position they
// share lives in this provider around the whole shell. Staff move the map
// under the center pin, as families do for their home, and the spot under the
// pin is the position Save sends. Save stays off until the map has reported one.

const PositionContext = React.createContext<{ position: Position; setPosition: (position: Position) => void } | null>(null);

function usePosition() {
  const value = React.useContext(PositionContext);
  if (!value) throw new Error("Wrap the add a point page in AddPointProvider.");
  return value;
}

export function AddPointProvider({ children }: { children: React.ReactNode }) {
  const [position, setPosition] = React.useState<Position>(null);
  return <PositionContext.Provider value={{ position, setPosition }}>{children}</PositionContext.Provider>;
}

type AddPointMapProps = {
  /** The town, from the map_bbox setting. */
  bbox: Bbox;
  barangays: BarangayCollection | undefined;
  /** The points already on the map, so staff do not stack a new one on top. */
  pins: readonly MapPin[];
};

export function AddPointMap({ bbox, barangays, pins }: AddPointMapProps) {
  const { setPosition } = usePosition();
  return (
    <div className="relative aspect-3/2 w-full">
      <MapView
        layout="hub"
        bbox={bbox}
        barangays={barangays}
        pins={pins}
        label="Map. Move it to put the pin where the point goes."
        onMove={setPosition}
        centerPin
        className="h-full"
      />
      <Pill className="absolute top-3.5 left-1/2 h-8.5 -translate-x-1/2 bg-ink px-3.5 text-canvas">Drag to place</Pill>
    </div>
  );
}

export function AddPointRail() {
  const { position } = usePosition();
  return <AddPointForm position={position} />;
}
