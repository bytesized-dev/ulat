import { z } from "zod";
import { NewPlace, PlaceType } from "@/lib/contracts";
import type { MapPin } from "@/components/map";

// GET /api/places has no read contract yet. The text rules come from NewPlace,
// and id is the stored field the map adds. Only these fields are read, and
// places are relief points, shelters and hazards, so no household can reach the map.
const Place = NewPlace.pick({ type: true, name: true, details: true, when_text: true, lat: true, lng: true }).extend({
  id: z.string().min(1),
});
export type Place = z.infer<typeof Place>;

type PlaceKind = z.infer<typeof PlaceType>;

export const PLACE_FILTERS = [
  { id: "all", label: "All" },
  { id: "relief", label: "Water" },
  { id: "shelter", label: "Shelters" },
  { id: "hazard", label: "Hazards" },
] as const;
export type PlaceFilter = (typeof PLACE_FILTERS)[number]["id"];

/** The places in a GET /api/places body. Items that do not fit are skipped. */
export function parsePlaces(body: unknown): Place[] {
  const list = (body as { places?: unknown } | null)?.places;
  if (!Array.isArray(list)) return [];
  const places: Place[] = [];
  for (const item of list) {
    const parsed = Place.safeParse(item);
    if (parsed.success) places.push(parsed.data);
  }
  return places;
}

export function filterPlaces(places: readonly Place[], filter: PlaceFilter): Place[] {
  return filter === "all" ? [...places] : places.filter((place) => place.type === filter);
}

const PIN_LABEL: Record<PlaceKind, string> = { relief: "Water or food", shelter: "Shelter", hazard: "Hazard" };

export function placePins(places: readonly Place[]): MapPin[] {
  return places.map((place) => ({ id: place.id, kind: place.type, label: `${PIN_LABEL[place.type]}, ${place.name}`, lat: place.lat, lng: place.lng }));
}

/** "Town plaza. Today, 3 to 5 PM." for the sheet, or null when there is nothing more to say. */
export function placeLine(place: Pick<Place, "details" | "when_text">): string | null {
  const parts = [place.details, place.when_text].map((part) => part?.trim().replace(/[.]+$/, "")).filter(Boolean);
  return parts.length > 0 ? `${parts.join(". ")}.` : null;
}

type BboxSetting = { west: number; south: number; east: number; north: number };

/** The map's box from the map_bbox setting, a JSON object of west, south, east and north. */
export function parseMapBbox(raw: string | undefined, fallback: BboxSetting): [number, number, number, number] {
  try {
    const { west, south, east, north } = JSON.parse(raw ?? "") as Record<string, unknown>;
    if ([west, south, east, north].every((n) => typeof n === "number" && Number.isFinite(n)) && (west as number) < (east as number) && (south as number) < (north as number)) {
      return [west as number, south as number, east as number, north as number];
    }
  } catch {
    // Missing or not JSON: use the fallback below.
  }
  return [fallback.west, fallback.south, fallback.east, fallback.north];
}
