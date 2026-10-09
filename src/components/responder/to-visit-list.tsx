"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HouseIcon } from "lucide-react";
import { AppTopBar } from "@/components/ui/app-top-bar";
import { IconPlate } from "@/components/ui/icon-plate";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { routes } from "@/lib/contracts";
import {
  assignmentOf,
  assignmentTag,
  filterByAssignment,
  filterToVisit,
  formatDistance,
  orderToVisit,
  withDistance,
  type ToVisitItem,
  type ToVisitReport,
  type ToVisitSort,
} from "./to-visit-order";
import { TextToggle } from "./text-toggle";
import { useOwnPosition } from "./use-position";
import { useVisitFilters, VisitFilterChips } from "./visit-filters";

type ToVisitListProps = { responderId: string; responderName: string; team: string | null; reports: ToVisitReport[] };

function place(item: ToVisitItem): string {
  return item.purok ? `${item.barangay}, ${item.purok}` : item.barangay;
}

// Hurt and missing are named, never only coloured. A house with neither shows
// its code, which the family can read out on the phone.
function Concern({ item }: { item: ToVisitItem }) {
  const parts: string[] = [];
  if (item.hurt > 0) parts.push(`${item.hurt} hurt`);
  if (item.missing > 0) parts.push(`${item.missing} missing`);
  if (parts.length === 0) return <span className="font-mono text-mono-xs text-muted-text">{item.code}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-caption-strong text-danger">
      <StatusDot tone="danger" />
      {parts.join(", ")}
    </span>
  );
}

function ToVisitRow({ item, responderId }: { item: ToVisitItem; responderId: string }) {
  const assignment = assignmentOf(item, responderId);
  return (
    <Link href={routes.responder.report(item.code)} className="flex min-h-16 items-center gap-4 border-b border-hairline-soft py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <IconPlate>
        <HouseIcon />
      </IconPlate>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-md font-medium text-ink">{item.household_head}</span>
        <span className="truncate text-body-sm text-body">{place(item)}</span>
        {assignment ? (
          <Pill dot={assignment.kind === "mine" ? "primary" : undefined} className="mt-1 max-w-full self-start">
            <span className="truncate">{assignmentTag(assignment)}</span>
          </Pill>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        {item.distance_m !== null ? <span className="font-mono text-mono-sm text-ink">{formatDistance(item.distance_m)}</span> : null}
        <Concern item={item} />
      </span>
    </Link>
  );
}

// Without permission the list still works, ordered by urgency and then by how
// long the report has waited.
function ToVisitList({ responderId, responderName, team, reports }: ToVisitListProps) {
  const [sort, setSort] = useState<ToVisitSort>("urgent");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useVisitFilters();
  const position = useOwnPosition();
  const shown = useMemo(() => filterByAssignment(reports, filters, responderId, team), [reports, filters, responderId, team]);
  const items = useMemo(() => orderToVisit(filterToVisit(withDistance(shown, position), query), sort, responderId), [shown, position, query, sort, responderId]);

  return (
    <>
      <AppTopBar name={responderName} searchLabel="Search reports" searchProps={{ value: query, onChange: (e) => setQuery(e.target.value) }} />
      <main className="flex-1 px-gutter pb-24 pt-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-title-page text-ink">To visit</h1>
          <span className="font-mono text-mono-sm text-muted-text">{shown.length}</span>
        </div>
        {/* Plain text, not buttons. Sort has an underline under the chosen one, the filters show a check when on. */}
        <div role="group" aria-label="Sort" className="mt-2 flex gap-x-5 border-b border-hairline-soft">
          <TextToggle indicator="underline" pressed={sort === "urgent"} onPressedChange={() => setSort("urgent")}>
            Urgent first
          </TextToggle>
          <TextToggle indicator="underline" pressed={sort === "nearest"} onPressedChange={() => setSort("nearest")}>
            Nearest
          </TextToggle>
        </div>
        <VisitFilterChips variant="text" filters={filters} onChange={setFilters} team={team} />
        <div className="mt-4 flex flex-col">
          {items.map((item) => (
            <ToVisitRow key={item.code} item={item} responderId={responderId} />
          ))}
        </div>
        {items.length === 0 ? (
          <p className="py-8 text-center text-body-md text-body">{query.trim() ? "No reports match your search" : "No reports match your filters"}</p>
        ) : null}
      </main>
    </>
  );
}

export { ToVisitList };
