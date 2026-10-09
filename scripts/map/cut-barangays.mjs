// Cuts one town's barangays out of the HDX Philippines admin level 4 GeoJSON
// and keeps only what the map reads: { name, pcode }. Prints the bbox of the
// result, which is a good start for the map_bbox setting.
//
//   node scripts/map/cut-barangays.mjs <adm4.geojson> <municipality> <out.geojson>
//
// HDX field names change between releases. Override them if the file differs:
//   TOWN_FIELD (default ADM3_EN), NAME_FIELD (ADM4_EN), CODE_FIELD (ADM4_PCODE)

import { readFileSync, writeFileSync } from "node:fs";

const [input, town, output] = process.argv.slice(2);
if (!input || !town || !output) {
  console.error("Usage: node scripts/map/cut-barangays.mjs <adm4.geojson> <municipality> <out.geojson>");
  process.exit(1);
}

const townField = process.env.TOWN_FIELD ?? "ADM3_EN";
const nameField = process.env.NAME_FIELD ?? "ADM4_EN";
const codeField = process.env.CODE_FIELD ?? "ADM4_PCODE";

const source = JSON.parse(readFileSync(input, "utf8"));
const features = source.features
  .filter((f) => String(f.properties?.[townField] ?? "").toLowerCase() === town.toLowerCase())
  .map((f) => ({
    type: "Feature",
    properties: { name: f.properties[nameField], pcode: f.properties[codeField] ?? null },
    geometry: f.geometry,
  }));

if (features.length === 0) {
  const towns = [...new Set(source.features.map((f) => f.properties?.[townField]))].slice(0, 20);
  console.error(`No barangays for "${town}" in ${townField}. Some values: ${towns.join(", ")}`);
  process.exit(1);
}

let [west, south, east, north] = [180, 90, -180, -90];
const visit = (c) => {
  if (typeof c[0] === "number") {
    west = Math.min(west, c[0]);
    east = Math.max(east, c[0]);
    south = Math.min(south, c[1]);
    north = Math.max(north, c[1]);
  } else c.forEach(visit);
};
features.forEach((f) => visit(f.geometry.coordinates));

writeFileSync(output, JSON.stringify({ type: "FeatureCollection", features }));
console.log(`${features.length} barangays: ${features.map((f) => f.properties.name).join(", ")}`);
console.log(`bbox: ${[west, south, east, north].map((n) => n.toFixed(5)).join(",")}`);
