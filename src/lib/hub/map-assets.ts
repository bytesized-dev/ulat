/**
 * Every file the map loads. All of them are served by the hub from public/map,
 * so the map works with no internet. See docs/SPEC.md 8.
 *
 * scripts/map/fetch-map.sh writes these files once, before the storm.
 */
export const mapAssets = {
  /** The town cut from the Protomaps daily build. Read through the pmtiles protocol. */
  tiles: "/map/town.pmtiles",
  /** Protomaps basemap glyphs. Without them labels silently vanish offline. */
  glyphs: "/map/fonts/{fontstack}/{range}.pbf",
  /** Protomaps basemap sprites, light flavor. */
  sprite: "/map/sprites/v4/light",
  /** Barangay boundaries from HDX, cut to the town. */
  barangays: "/map/barangays.geojson",
} as const;

/**
 * The map colors, by role, as token names from DESIGN.md. The MapLibre style
 * reads each one's value from the page at runtime, so no hex lives in code.
 */
export const mapTokens = {
  land: "map-land",
  urban: "map-urban",
  park: "map-park",
  sea: "map-sea",
  river: "map-river",
  road: "map-road",
  roadCasing: "map-road-casing",
  roadMinor: "map-road-minor",
  boundary: "map-boundary",
  shade1: "map-shade-1",
  shade2: "map-shade-2",
  shade3: "map-shade-3",
  label: "body",
} as const;

/** The property on each barangay feature that holds its name, as the seed spells it. */
export const barangayNameProperty = "name";

/** The glyph stack the basemap labels use. Must exist under public/map/fonts. */
export const labelFont = "Noto Sans Regular";

/** The pmtiles protocol URL MapLibre reads, built against the page origin. */
export function tilesUrl(origin: string): string {
  return `pmtiles://${origin}${mapAssets.tiles}`;
}
