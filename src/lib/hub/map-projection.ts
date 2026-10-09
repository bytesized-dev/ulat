/**
 * Map math shared by the map engines and the seed. Web Mercator, so positions
 * line up with MapLibre once it renders the real tiles. See docs/SPEC.md 8 and 10.
 */

/** The `map_bbox` setting: west, south, east, north in degrees. */
export type Bbox = readonly [west: number, south: number, east: number, north: number];

export type LngLat = { lng: number; lat: number };

/** A point as a percentage of the map area, left to right and top to bottom. */
export type Percent = { x: number; y: number };

/** Mercator units, 0 to 1 across the world, y growing southwards like the screen. */
type World = { x: number; y: number };

function toWorld({ lng, lat }: LngLat): World {
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

function fromWorld({ x, y }: World): LngLat {
  const n = Math.PI - 2 * Math.PI * y;
  return {
    lng: x * 360 - 180,
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
  };
}

/** Where a point sits inside the bbox, in percent. Outside the bbox goes below 0 or above 100. */
export function toPercent(point: LngLat, bbox: Bbox): Percent {
  const [west, south, east, north] = bbox;
  const nw = toWorld({ lng: west, lat: north });
  const se = toWorld({ lng: east, lat: south });
  const p = toWorld(point);
  return {
    x: ((p.x - nw.x) / (se.x - nw.x)) * 100,
    y: ((p.y - nw.y) / (se.y - nw.y)) * 100,
  };
}

/** The seed's `pos` percentages back to a real position, using the `map_bbox` setting. */
export function fromPercent({ x, y }: Percent, bbox: Bbox): LngLat {
  const [west, south, east, north] = bbox;
  const nw = toWorld({ lng: west, lat: north });
  const se = toWorld({ lng: east, lat: south });
  return fromWorld({
    x: nw.x + (x / 100) * (se.x - nw.x),
    y: nw.y + (y / 100) * (se.y - nw.y),
  });
}

/** A smaller bbox around the same center, for zooming in by `factor`. */
export function zoomBbox(bbox: Bbox, factor: number): Bbox {
  const [west, south, east, north] = bbox;
  const nw = toWorld({ lng: west, lat: north });
  const se = toWorld({ lng: east, lat: south });
  const cx = (nw.x + se.x) / 2;
  const cy = (nw.y + se.y) / 2;
  const hw = (se.x - nw.x) / 2 / factor;
  const hh = (se.y - nw.y) / 2 / factor;
  const a = fromWorld({ x: cx - hw, y: cy - hh });
  const b = fromWorld({ x: cx + hw, y: cy + hh });
  return [a.lng, b.lat, b.lng, a.lat];
}

/**
 * Grows the bbox around its center so it has the frame's shape, width over
 * height, keeping all of it in view. Like fitBounds in MapLibre.
 */
export function fitBbox(bbox: Bbox, aspect: number): Bbox {
  const [west, south, east, north] = bbox;
  const nw = toWorld({ lng: west, lat: north });
  const se = toWorld({ lng: east, lat: south });
  let w = se.x - nw.x;
  let h = se.y - nw.y;
  if (!(aspect > 0) || !(w > 0) || !(h > 0)) return bbox;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (nw.x + se.x) / 2;
  const cy = (nw.y + se.y) / 2;
  const a = fromWorld({ x: cx - w / 2, y: cy - h / 2 });
  const b = fromWorld({ x: cx + w / 2, y: cy + h / 2 });
  return [a.lng, b.lat, b.lng, a.lat];
}

/** Whether a point falls inside a GeoJSON ring of [lng, lat] pairs. */
export function inRing({ lng, lat }: LngLat, ring: readonly (readonly number[])[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function inside({ x, y }: Percent): boolean {
  return x >= 0 && x <= 100 && y >= 0 && y <= 100;
}
