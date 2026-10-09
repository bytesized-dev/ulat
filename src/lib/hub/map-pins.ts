import { sql } from "drizzle-orm";
import type { MapPin } from "../../components/map/types";
import { map as mapConfig } from "../../config";
import type { Db } from "../../db/client";
import { entries, places, reports, settings } from "../../db/schema";
import type { Bbox } from "./map-projection";

// Pins for the hub maps, read straight from SQL. Staff only: entry and report
// pins name households, so the page that calls this checks the staff session.
// Families never see household pins (docs/SPEC.md section 8).

/** Where a pin comes from, which decides the details the map rail shows and where it links. */
export type MapPointSource = "entry" | "report" | "place";

/** A pin plus what the map rail shows when it is selected. */
export type MapPoint = {
  pin: MapPin;
  source: MapPointSource;
  /** The entry id, report code or place id, without the source prefix on `pin.id`. */
  ref: string;
  /** The household or place name, as the rail heading. */
  title: string;
  /** A second line: barangay and purok for houses, the details text for places. */
  detail: string | null;
};

type PointRow = {
  id: string;
  source: MapPointSource;
  ref: string;
  kind: MapPin["kind"];
  lat: number;
  lng: number;
  label: string;
  title: string;
  detail: string | null;
};

/**
 * Confirmed totally and partially damaged entries, reports nobody has visited
 * yet, and the visible relief points, shelters and hazards, with the details
 * the map rail shows. Anything without a position is left out, since it has
 * nowhere to go on the map.
 */
export function getMapPoints(db: Db): MapPoint[] {
  const rows = db.all<PointRow>(sql`
    select 'entry-' || ${entries.id} as id, 'entry' as source, ${entries.id} as ref, ${entries.damage_class} as kind,
      ${entries.lat} as lat, ${entries.lng} as lng,
      coalesce(${entries.household_head}, 'Entry ' || printf('%04d', ${entries.number}))
        || case ${entries.damage_class} when 'total' then ', totally damaged' else ', partially damaged' end as label,
      coalesce(${entries.household_head}, 'Entry ' || printf('%04d', ${entries.number})) as title,
      ${entries.barangay} || coalesce(', ' || ${entries.purok}, '') as detail
    from ${entries}
    where ${entries.status} = 'confirmed' and ${entries.damage_class} in ('total', 'partial')
      and ${entries.lat} is not null and ${entries.lng} is not null
    union all
    select 'report-' || ${reports.code}, 'report', ${reports.code}, 'unvisited', ${reports.lat}, ${reports.lng},
      ${reports.household_head} || ', not visited', ${reports.household_head},
      ${reports.barangay} || coalesce(', ' || ${reports.purok}, '')
    from ${reports}
    where ${reports.status} in ('waiting', 'assigned', 'on_the_way')
      and ${reports.lat} is not null and ${reports.lng} is not null
    union all
    select 'place-' || ${places.id}, 'place', ${places.id}, ${places.type}, ${places.lat}, ${places.lng},
      ${places.name}, ${places.name}, ${places.details}
    from ${places}
    where ${places.visible} = 1`);
  return rows.map((r) => ({
    pin: { id: r.id, kind: r.kind, lat: r.lat, lng: r.lng, label: r.label },
    source: r.source,
    ref: r.ref,
    title: r.title,
    detail: r.detail,
  }));
}

/** The same points as bare pins, for the overview map, which has no rail. */
export function getMapPins(db: Db): MapPin[] {
  return getMapPoints(db).map((point) => point.pin);
}

/** The `map_bbox` setting, or the config placeholder when the hub has none or it is not valid. */
export function getMapBbox(db: Db): Bbox {
  const fallback = mapConfig.placeholderBbox;
  const row = db.get<{ value: string } | undefined>(sql`select ${settings.value} as value from ${settings} where ${settings.key} = 'map_bbox'`);
  let box: Partial<Record<"west" | "south" | "east" | "north", unknown>> = fallback;
  try {
    if (row) box = JSON.parse(row.value);
  } catch {
    box = fallback;
  }
  const { west, south, east, north } = box;
  const valid = [west, south, east, north].every((n) => typeof n === "number" && Number.isFinite(n));
  return valid
    ? [west as number, south as number, east as number, north as number]
    : [fallback.west, fallback.south, fallback.east, fallback.north];
}
