"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HouseIcon } from "lucide-react";
import { AppTopBar } from "@/components/ui/app-top-bar";
import { Chip } from "@/components/ui/chip";
import { IconPlate } from "@/components/ui/icon-plate";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { routes } from "@/lib/contracts";
import {
  assignmentOf,
  assignmentTag,
  filterToVisit,
  formatDistance,
  orderToVisit,
  withDistance,
  type ToVisitItem,
  type ToVisitReport,
  type ToVisitSort,
} from "./to-visit-order";
import { useOwnPosition } from "./use-position";

type ToVisitListProps = { responderId: string; responderName: string; reports: ToVisitReport[] };

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
function ToVisitList({ responderId, responderName, reports }: ToVisitListProps) {
  const [sort, setSort] = useState<ToVisitSort>("urgent");
  const [query, setQuery] = useState("");
  const position = useOwnPosition();
  const items = useMemo(() => orderToVisit(filterToVisit(withDistance(reports, position), query), sort, responderId), [reports, position, query, sort, responderId]);

  return (
    <>
      <AppTopBar name={responderName} searchLabel="Search reports" searchProps={{ value: query, onChange: (e) => setQuery(e.target.value) }} />
      <main className="flex-1 px-gutter pb-6 pt-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-title-page text-ink">To visit</h1>
          <span className="font-mono text-mono-sm text-muted-text">{reports.length}</span>
        </div>
        <div className="mt-4 flex gap-2">
          <Chip pressed={sort === "urgent"} onPressedChange={() => setSort("urgent")}>
            Urgent first
          </Chip>
          <Chip pressed={sort === "nearest"} onPressedChange={() => setSort("nearest")}>
            Nearest
          </Chip>
        </div>
        <div className="mt-4 flex flex-col">
          {items.map((item) => (
            <ToVisitRow key={item.code} item={item} responderId={responderId} />
          ))}
        </div>
        {items.length === 0 ? <p className="py-8 text-center text-body-md text-body">No reports match your search</p> : null}
      </main>
    </>
  );
}

export { ToVisitList };
