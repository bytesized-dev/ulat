"use client";

import { useEffect, useState } from "react";
import { nextPosition, type Point } from "./to-visit-order";

// The responder's position stays on the phone. A timeout under a roof keeps the
// last good position. Only a refusal clears it, and small moves are ignored so
// rows do not shift while the responder walks.
export function useOwnPosition(): Point | null {
  const [position, setPosition] = useState<Point | null>(null);
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      (p) => setPosition((current) => nextPosition(current, { lat: p.coords.latitude, lng: p.coords.longitude })),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setPosition(null);
      },
      { maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);
  return position;
}
