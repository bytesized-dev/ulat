"use client";

import { useEffect, useState } from "react";
import type { BarangayCollection } from "@/components/map";
import { mapAssets } from "@/lib/hub/map-assets";
import { barangayAt, insideTown } from "./home-location";

// The outlines are fetched once, and only after the phone has a position.
let outlines: Promise<BarangayCollection | undefined> | undefined;

function loadOutlines(): Promise<BarangayCollection | undefined> {
  outlines ??= fetch(mapAssets.barangays)
    .then((res) => (res.ok ? (res.json() as Promise<BarangayCollection>) : undefined))
    .catch(() => undefined);
  return outlines;
}

/**
 * The barangay the phone is in, from its own GPS and the town's outlines on the
 * hub. The position never leaves the phone. Until there is a fix, or without
 * permission, or outside every barangay, it shows the fallback.
 */
function CurrentPlace({ fallback }: { fallback: string }) {
  const [barangay, setBarangay] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        if (!insideTown(point)) return;
        void loadOutlines().then((collection) => {
          const found = barangayAt(point, collection);
          if (!cancelled && found) setBarangay(found);
        });
      },
      () => {},
      { maximumAge: 60_000, timeout: 15_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{barangay ?? fallback}</>;
}

export { CurrentPlace };
