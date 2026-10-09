import { sql } from "drizzle-orm";
import type { MapPin } from "../../components/map/types";
import { map as mapConfig } from "../../config";
import type { Db } from "../../db/client";
import { entries, places, reports, settings } from "../../db/schema";
import type { Bbox } from "./map-projection";

// Pins for the hub overview map, read straight from SQL. Staff only: entry and
// report pins name households, so the page that calls this checks the staff
// session. Families never see household pins (docs/SPEC.md section 8).

type PinRow = { id: string; kind: MapPin["kind"]; lat: number; lng: number; label: string };

/**
 * Confirmed totally and partially damaged entries, reports nobody has visited
 * yet, and the visible relief points, shelters and hazards. Anything without
 * a position is left out, since it has nowhere to go on the map.
 */
export function getMapPins(db: Db): MapPin[] {
  return db.all<PinRow>(sql`
    select 'entry-' || ${entries.id} as id, ${entries.damage_class} as kind, ${entries.lat} as lat, ${entries.lng} as lng,
      coalesce(${entries.household_head}, 'Entry ' || printf('%04d', ${entries.number}))
        || case ${entries.damage_class} when 'total' then ', totally damaged' else ', partially damaged' end as label
    from ${entries}
    where ${entries.status} = 'confirmed' and ${entries.damage_class} in ('total', 'partial')
      and ${entries.lat} is not null and ${entries.lng} is not null
    union all
    select 'report-' || ${reports.code}, 'unvisited', ${reports.lat}, ${reports.lng}, ${reports.household_head} || ', not visited'
    from ${reports}
    where ${reports.status} in ('waiting', 'assigned', 'on_the_way')
      and ${reports.lat} is not null and ${reports.lng} is not null
    union all
    select 'place-' || ${places.id}, ${places.type}, ${places.lat}, ${places.lng}, ${places.name}
    from ${places}
    where ${places.visible} = 1`);
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
