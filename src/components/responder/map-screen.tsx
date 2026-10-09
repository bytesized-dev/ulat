"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapView, type BarangayCollection, type LegendItem, type MapPin } from "@/components/map";
import { buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { routes } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { howFar } from "./map-sheet";
import { filterByAssignment, type ToVisitReport } from "./to-visit-order";
import { useOwnPosition } from "./use-position";
import { useVisitFilters, VisitFilterChips } from "./visit-filters";

export type MapEntry = { id: string; household_head: string | null; damage_class: "partial" | "total"; lat: number; lng: number };

export type MapHazard = { id: string; name: string; details: string | null; lat: number; lng: number };

type MapScreenProps = {
  responderId: string;
  /** The responder's team barangay, for the area filter. */
  team: string | null;
  bbox: [number, number, number, number];
  barangays?: BarangayCollection;
  reports: ToVisitReport[];
  entries: MapEntry[];
  hazards: MapHazard[];
};

const LEGEND: LegendItem[] = [
  { kind: "unvisited", label: "Report" },
  { kind: "total", label: "Totally" },
  { kind: "partial", label: "Partially" },
  { kind: "you", label: "You" },
];

const CLASS_LABEL = { total: "Totally damaged", partial: "Partially damaged" } as const;

// Unvisited reports, confirmed houses, hazards and you. Tapping a pin fills the
// sheet under the map. Only reports offer "Open report", since confirmed houses are done.
export function MapScreen({ responderId, team, bbox, barangays, reports, entries, hazards }: MapScreenProps) {
  const position = useOwnPosition();
  const [filters, setFilters] = useVisitFilters();
  // The filters narrow the reports only. Confirmed houses and hazards stay, so the responder still sees what is around.
  const shown = useMemo(() => filterByAssignment(reports, filters, responderId, team), [reports, filters, responderId, team]);
  const placed = useMemo(() => shown.filter((r) => r.lat !== null && r.lng !== null), [shown]);
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    const first = reports.find((r) => r.lat !== null && r.lng !== null);
    return first ? `report-${first.code}` : undefined;
  });

  const pins = useMemo<MapPin[]>(
    () => [
      ...placed.map((r) => ({ id: `report-${r.code}`, kind: "unvisited" as const, label: `${r.household_head}, not visited`, lat: r.lat!, lng: r.lng! })),
      ...entries.map((e) => ({
        id: `entry-${e.id}`,
        kind: e.damage_class,
        label: `${e.household_head ?? "House"}, ${CLASS_LABEL[e.damage_class].toLowerCase()}`,
        lat: e.lat,
        lng: e.lng,
      })),
      ...hazards.map((h) => ({ id: `hazard-${h.id}`, kind: "hazard" as const, label: `Hazard, ${h.name}`, lat: h.lat, lng: h.lng })),
      ...(position ? [{ id: "you", kind: "you" as const, label: "You", ...position }] : []),
    ],
    [placed, entries, hazards, position],
  );

  const report = placed.find((r) => `report-${r.code}` === selectedId);
  const entry = entries.find((e) => `entry-${e.id}` === selectedId);
  const hazard = hazards.find((h) => `hazard-${h.id}` === selectedId);
  const away = report ? howFar(position, { lat: report.lat!, lng: report.lng! }) : null;

  return (
    <>
      <header className="flex items-center justify-between px-gutter py-3">
        <span className="text-title-bar text-ink">Map</span>
        <Pill>{shown.length} to visit</Pill>
      </header>
      <VisitFilterChips filters={filters} onChange={setFilters} team={team} className="px-gutter pb-3" />
      <MapView
        layout="phone"
        className="flex-1"
        bbox={bbox}
        barangays={barangays}
        pins={pins}
        selectedId={selectedId}
        onSelect={(pin) => {
          if (pin.kind !== "you") setSelectedId(pin.id);
        }}
        legend={LEGEND}
        label="Map of reports and confirmed houses"
      />
      <section aria-live="polite" className="border-t border-hairline bg-canvas px-gutter pb-4 pt-3 shadow-float">
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-pill bg-hairline" />
        {report ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body-md font-medium text-ink">{report.household_head}</span>
                {away ? <span className="text-body-sm text-body">{away}</span> : null}
              </span>
              {report.hurt > 0 || report.missing > 0 ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-caption-strong text-danger">
                  <StatusDot tone="danger" />
                  {[report.hurt > 0 && `${report.hurt} hurt`, report.missing > 0 && `${report.missing} missing`].filter(Boolean).join(", ")}
                </span>
              ) : null}
            </div>
            <Link href={routes.responder.report(report.code)} className={cn(buttonVariants(), "mt-3 w-full")}>
              Open report
            </Link>
          </>
        ) : entry ? (
          <div className="flex items-center justify-between gap-3 pb-1">
            <span className="truncate text-body-md font-medium text-ink">
              {entry.household_head ?? "House with no report"}
            </span>
            <Pill dot={entry.damage_class === "total" ? "danger" : "warning"}>{entry.damage_class === "total" ? "Totally" : "Partially"}</Pill>
          </div>
        ) : hazard ? (
          <div className="flex items-center justify-between gap-3 pb-1">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body-md font-medium text-ink">{hazard.name}</span>
              {hazard.details ? <span className="text-body-sm text-body">{hazard.details}</span> : null}
            </span>
            <Pill>Hazard</Pill>
          </div>
        ) : (
          <p className="pb-1 text-body-md text-body">Tap a pin to see the house.</p>
        )}
      </section>
    </>
  );
}
