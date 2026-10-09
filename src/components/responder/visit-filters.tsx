"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
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

// A write tells this tab's subscribers, so the chips and the list update together.
const CHANGED = "ulat:visit-filters";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

// The choice in memory, read from storage once. Blocked storage still filters for this visit.
let current: string | null | undefined;

function snapshot(): string | null {
  if (current === undefined) {
    try {
      current = storage()?.getItem(KEY) ?? null;
    } catch {
      current = null;
    }
  }
  return current;
}

function parse(raw: string | null): VisitFilters {
  try {
    const saved = JSON.parse(raw ?? "null") as Partial<VisitFilters> | null;
    return { mine: saved?.mine === true, area: saved?.area === true };
  } catch {
    return NO_FILTERS;
  }
}

/**
 * The responder's filters, kept on this phone so the list and the map show
 * the same houses. The server renders them off, and the saved choice loads on hydration.
 */
export function useVisitFilters(): [VisitFilters, (next: VisitFilters) => void] {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const filters = useMemo(() => parse(raw), [raw]);
  const setFilters = useCallback((next: VisitFilters) => {
    current = JSON.stringify(next);
    try {
      storage()?.setItem(KEY, current);
    } catch {
      // A full or blocked storage only means the choice is not remembered.
    }
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [filters, setFilters];
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
