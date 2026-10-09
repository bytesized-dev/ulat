"use client";

import { useEffect, useState } from "react";
import { distanceMeters, formatDistance, type Point } from "./to-visit-order";

type ReportDistanceProps = { place: string; home: Point | null };

// "San Isidro, Purok 3. 350 m away." The responder's position stays on the
// phone. Without permission or a home location the distance is left out.
function ReportDistance({ place, home }: ReportDistanceProps) {
  const [meters, setMeters] = useState<number | null>(null);
  useEffect(() => {
    if (!home || !("geolocation" in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      (p) => setMeters(distanceMeters({ lat: p.coords.latitude, lng: p.coords.longitude }, home)),
      (error) => {
        // A timeout or a lost fix keeps the last distance. Only a refusal clears it.
        if (error.code === error.PERMISSION_DENIED) setMeters(null);
      },
      { maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [home]);

  return (
    <p className="mt-1 text-body-sm text-body">
      {place}.{meters !== null ? ` ${formatDistance(meters)} away.` : ""}
    </p>
  );
}

export { ReportDistance };
