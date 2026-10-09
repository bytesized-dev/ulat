// Downloads the Protomaps basemap glyphs and light sprites into public/map.
// Without the glyphs, map labels silently vanish offline. Only the fonts the
// light style uses for Latin script are fetched, about 13 MB on disk.
//
//   node scripts/map/basemap-assets.mjs

import { mkdirSync, writeFileSync } from "node:fs";

const base = "https://raw.githubusercontent.com/protomaps/basemaps-assets/main";
const fonts = ["Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic"];
const sprites = ["light.json", "light.png", "light@2x.json", "light@2x.png"];

const jobs = sprites.map((file) => [`${base}/sprites/v4/${file}`, `public/map/sprites/v4/${file}`]);
// The SIL Open Font License travels with the fonts.
jobs.push([`${base}/fonts/OFL.txt`, "public/map/fonts/OFL.txt"]);
mkdirSync("public/map/sprites/v4", { recursive: true });
for (const font of fonts) {
  mkdirSync(`public/map/fonts/${font}`, { recursive: true });
  for (let i = 0; i < 256; i++) {
    const glyphs = `${i * 256}-${i * 256 + 255}.pbf`;
    jobs.push([`${base}/fonts/${encodeURIComponent(font)}/${glyphs}`, `public/map/fonts/${font}/${glyphs}`]);
  }
}

let next = 0;
const failed = [];
async function worker() {
  while (next < jobs.length) {
    const [url, path] = jobs[next++];
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        writeFileSync(path, Buffer.from(await res.arrayBuffer()));
        break;
      } catch (error) {
        if (attempt === 3) {
          failed.push(`${url}: ${error.message}`);
          break;
        }
      }
    }
  }
}
await Promise.all(Array.from({ length: 12 }, worker));

console.log(`${jobs.length - failed.length} of ${jobs.length} files`);
if (failed.length) {
  console.error(failed.join("\n"));
  process.exit(1);
}
