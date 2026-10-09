"use client";

import * as React from "react";
import { AddPointForm } from "./add-point-form";

type Position = { lat: number; lng: number } | null;

// The map sits in the page and the form in the rail, so the pin position they
// share lives in this provider around the whole shell. The map comes with
// BYT-40: a MapView with a draggable pin goes in AddPointMap and calls
// setPosition. Until then the panel is empty and Save stays off.

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

export function AddPointMap() {
  return <div role="img" aria-label="Map" className="aspect-3/2 w-full rounded-lg bg-surface-soft" />;
}

export function AddPointRail() {
  const { position } = usePosition();
  return <AddPointForm position={position} />;
}
