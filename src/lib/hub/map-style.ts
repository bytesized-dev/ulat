import { type Flavor, layers, namedFlavor } from "@protomaps/basemaps";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import { mapAssets, type MapRole, tilesUrl } from "./map-assets";

/*
  The MapLibre style: the Protomaps basemap layers, recolored with the map
  tokens from DESIGN.md. Colors come in as a palette the page reads from the
  tokens at runtime, so no hex lives here. Every URL points at the hub.
*/

export type MapPalette = Readonly<Record<MapRole, string>>;

/** The basemap source name the Protomaps layers refer to. */
export const basemapSource = "protomaps";

/** Recolors the light basemap: green land, blue water, outlined blue gray main roads. */
export function mapFlavor(p: MapPalette): Flavor {
  const base = namedFlavor("light");
  const roads = (kind: "casing" | "fill") => ({
    major: kind === "fill" ? p.road : p.roadCasing,
    highway: kind === "fill" ? p.road : p.roadCasing,
    link: kind === "fill" ? p.road : p.roadCasing,
    minor: kind === "fill" ? p.roadMinor : p.urban,
    other: kind === "fill" ? p.roadMinor : p.urban,
  });
  const fill = roads("fill");
  const casing = roads("casing");

  return {
    ...base,
    // The sea is whatever no land polygon covers.
    background: p.sea,
    earth: p.land,
    water: p.sea,
    park_a: p.park,
    park_b: p.park,
    zoo: p.park,
    wood_a: p.land,
    wood_b: p.land,
    scrub_a: p.land,
    scrub_b: p.land,
    industrial: p.urban,
    school: p.urban,
    pedestrian: p.urban,
    landcover: {
      ...base.landcover!,
      barren: p.land,
      farmland: p.land,
      forest: p.land,
      grassland: p.land,
      scrub: p.land,
      urban_area: p.urban,
    },

    highway: fill.highway,
    major: fill.major,
    link: fill.link,
    minor_a: fill.minor,
    minor_b: fill.minor,
    minor_service: fill.minor,
    other: fill.other,
    highway_casing_early: casing.highway,
    highway_casing_late: casing.highway,
    major_casing_early: casing.major,
    major_casing_late: casing.major,
    link_casing: casing.link,
    minor_casing: casing.minor,
    minor_service_casing: casing.minor,

    bridges_highway: fill.highway,
    bridges_major: fill.major,
    bridges_link: fill.link,
    bridges_minor: fill.minor,
    bridges_other: fill.other,
    bridges_highway_casing: casing.highway,
    bridges_major_casing: casing.major,
    bridges_link_casing: casing.link,
    bridges_minor_casing: casing.minor,
    bridges_other_casing: casing.other,

    tunnel_highway: fill.highway,
    tunnel_major: fill.major,
    tunnel_link: fill.link,
    tunnel_minor: fill.minor,
    tunnel_other: fill.other,
    tunnel_highway_casing: casing.highway,
    tunnel_major_casing: casing.major,
    tunnel_link_casing: casing.link,
    tunnel_minor_casing: casing.minor,
    tunnel_other_casing: casing.other,

    boundaries: p.boundary,
    roads_label_major: p.label,
    roads_label_minor: p.label,
    roads_label_major_halo: p.halo,
    roads_label_minor_halo: p.halo,
    city_label: p.label,
    city_label_halo: p.halo,
    subplace_label: p.label,
    subplace_label_halo: p.halo,
    address_label: p.label,
    address_label_halo: p.halo,
    ocean_label: p.label,
  };
}

/** Land use the basemap layers leave undrawn. Painted as built-up, so towns read gray on green land. */
export const builtUpKinds = ["residential", "commercial", "retail"];

function builtUpLayer(p: MapPalette): LayerSpecification {
  return {
    id: "landuse_built_up",
    type: "fill",
    source: basemapSource,
    "source-layer": "landuse",
    filter: ["in", ["get", "kind"], ["literal", builtUpKinds]],
    paint: { "fill-color": p.urban },
  };
}

/** The whole style, built against the page origin so MapLibre's worker can resolve every URL. */
export function mapStyle(origin: string, palette: MapPalette): StyleSpecification {
  return {
    version: 8,
    glyphs: `${origin}${mapAssets.glyphs}`,
    sprite: `${origin}${mapAssets.sprite}`,
    sources: {
      [basemapSource]: {
        type: "vector",
        url: tilesUrl(origin),
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: withBuiltUp(layers(basemapSource, mapFlavor(palette), { lang: "en" }), palette),
  };
}

/** Puts the built-up layer right above the land, under parks, water and roads. */
function withBuiltUp(base: LayerSpecification[], p: MapPalette): LayerSpecification[] {
  const earth = base.findIndex((layer) => layer.id === "earth");
  return [...base.slice(0, earth + 1), builtUpLayer(p), ...base.slice(earth + 1)];
}
