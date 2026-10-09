"use client";

import { useEffect, useState } from "react";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import { NO_FILTERS, type VisitFilters } from "./to-visit-order";

const KEY = "ulat.responder.visit-filters";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(): VisitFilters {
  try {
    const saved = JSON.parse(storage()?.getItem(KEY) ?? "null") as Partial<VisitFilters> | null;
    return { mine: saved?.mine === true, area: saved?.area === true };
  } catch {
    return NO_FILTERS;
  }
}

/**
 * The responder's filters, kept on this phone so the list and the map show
 * the same houses. They start off on the server and load after the first paint.
 */
export function useVisitFilters(): [VisitFilters, (next: VisitFilters) => void] {
  const [filters, setFilters] = useState<VisitFilters>(NO_FILTERS);
  useEffect(() => setFilters(read()), []);
  return [
    filters,
    (next) => {
      setFilters(next);
      try {
        storage()?.setItem(KEY, JSON.stringify(next));
      } catch {
        // A full or blocked storage only means the choice is not remembered.
      }
    },
  ];
}

type VisitFilterChipsProps = {
  filters: VisitFilters;
  onChange: (next: VisitFilters) => void;
  /** The responder's team barangay. Without one there is no area chip. */
  team: string | null;
  className?: string;
};

/** "Assigned to me" and the team's barangay, each on or off. */
export function VisitFilterChips({ filters, onChange, team, className }: VisitFilterChipsProps) {
  return (
    <div role="group" aria-label="Filters" className={cn("flex gap-2 overflow-x-auto", className)}>
      <Chip pressed={filters.mine} onPressedChange={(mine) => onChange({ ...filters, mine })}>
        Assigned to me
      </Chip>
      {team ? (
        <Chip pressed={filters.area} onPressedChange={(area) => onChange({ ...filters, area })}>
          {team}
        </Chip>
      ) : null}
    </div>
  );
}
