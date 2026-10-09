"use client";

import { distanceMeters, formatDistance, type Point } from "./to-visit-order";
import { useOwnPosition } from "./use-position";

type ReportDistanceProps = { place: string; home: Point | null };

// "San Isidro, Purok 3. 350 m away." Without permission or a home location the
// distance is left out.
function ReportDistance({ place, home }: ReportDistanceProps) {
  const position = useOwnPosition();
  const meters = home && position ? distanceMeters(position, home) : null;

  return (
    <p className="mt-1 text-body-sm text-body">
      {place}.{meters !== null ? ` ${formatDistance(meters)} away.` : ""}
    </p>
  );
}

export { ReportDistance };
