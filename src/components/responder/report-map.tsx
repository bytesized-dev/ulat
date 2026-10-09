"use client";

import { useMemo, useState } from "react";
import { MapView, type LegendItem, type MapPin } from "@/components/map";
import { reportMapBbox } from "./report-map-bbox";
import type { Point } from "./to-visit-order";
import { useOwnPosition } from "./use-position";

const LEGEND: LegendItem[] = [
  { kind: "unvisited", label: "House" },
  { kind: "you", label: "You" },
];

type ReportMapProps = { home: Point; household: string };

// The house and the responder on one small map. It frames both the first time
// the phone knows where it is, then leaves the view to the responder.
function ReportMap({ home, household }: ReportMapProps) {
  const position = useOwnPosition();
  const [framedWith, setFramedWith] = useState<Point | null>(null);
  if (position && !framedWith) setFramedWith(position);
  const bbox = useMemo(() => reportMapBbox(home, framedWith), [home, framedWith]);

  const pins = useMemo<MapPin[]>(
    () => [
      { id: "home", kind: "unvisited", label: `${household}, the house`, ...home },
      ...(position ? [{ id: "you", kind: "you" as const, label: "You", ...position }] : []),
    ],
    [home, household, position],
  );

  return (
    <MapView
      layout="phone"
      className="mt-6 h-72 overflow-hidden rounded-lg"
      bbox={bbox}
      pins={pins}
      selectedId="home"
      legend={LEGEND}
      label={`Map of ${household} and you`}
    />
  );
}

export { ReportMap };
