"use client";

import { useMemo, useState } from "react";
import { MapView, type BarangayCollection, type LegendItem } from "@/components/map";
import { Chip } from "@/components/ui/chip";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { UpdateKindPill } from "./updates-list";
import { PLACE_FILTERS, filterPlaces, parsePlaces, placeLine, placePins, type PlaceFilter } from "./map-places";
import { useLiveList } from "./use-live-list";

const LEGEND: LegendItem[] = [
  { kind: "relief", label: "Water or food" },
  { kind: "shelter", label: "Shelter" },
  { kind: "hazard", label: "Hazard" },
];

const PILL_KIND = { relief: "water_food", shelter: "shelter", hazard: "hazard" } as const;

type FamilyMapProps = {
  bbox: [number, number, number, number];
  barangays?: BarangayCollection;
};

// Relief points, shelters and hazards the hub has made visible. Households are
// never on this map. Refetched on place.saved.
export function FamilyMap({ bbox, barangays }: FamilyMapProps) {
  const { items } = useLiveList("/api/places", parsePlaces, "place.saved");
  const [filter, setFilter] = useState<PlaceFilter>("all");
  const [pickedId, setPickedId] = useState<string | undefined>();

  const shown = useMemo(() => filterPlaces(items, filter), [items, filter]);
  const pins = useMemo(() => placePins(shown), [shown]);
  // A place that is filtered out or removed falls back to the first one shown.
  const selected = shown.find((place) => place.id === pickedId) ?? shown[0];
  const line = selected ? placeLine(selected) : null;

  return (
    // From md the map takes the whole window and the place floats on it as a card.
    <div className="flex h-dvh flex-col">
      <TopBar title="Map" leading={{ kind: "back", href: routes.family.home }} />
      <div role="group" aria-label="Show on the map" className="flex gap-2 overflow-x-auto px-gutter pb-3">
        {PLACE_FILTERS.map((item) => (
          <Chip key={item.id} pressed={filter === item.id} onPressedChange={() => setFilter(item.id)}>
            {item.label}
          </Chip>
        ))}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <MapView
          layout="phone"
          className="flex-1"
          bbox={bbox}
          barangays={barangays}
          pins={pins}
          selectedId={selected?.id}
          onSelect={(pin) => setPickedId(pin.id)}
          legend={LEGEND}
          label="Map of relief points, shelters and hazards"
        />
        <section
          aria-live="polite"
          className="rounded-t-xl bg-canvas px-gutter pt-3 pb-7 shadow-float md:absolute md:bottom-8 md:left-gutter md:w-full md:max-w-auth md:rounded-xl md:p-6"
        >
          <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-pill bg-hairline md:hidden" />
          {selected ? (
            <div className="flex flex-col gap-2">
              <div>
                <UpdateKindPill kind={PILL_KIND[selected.type]} />
              </div>
              <h2 className="text-title-md text-ink">{selected.name}</h2>
              {line ? <p className="text-body-sm text-body">{line}</p> : null}
            </div>
          ) : (
            <p className="text-body-md text-body">Nothing on the map yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
