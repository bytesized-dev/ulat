import { existsSync, openSync, readFileSync, readSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { barangayNameProperty, labelFont, mapAssets, mapTokens } from "./map-assets";

// The offline map package in public/map. If any of it is missing, the map
// loses tiles or labels with no error on screen, so check it here.

const pub = (url: string) => `public${url}`;

describe("offline map package", () => {
  it("has a PMTiles v3 archive for the town", () => {
    const head = Buffer.alloc(8);
    readSync(openSync(pub(mapAssets.tiles), "r"), head, 0, 8, 0);
    expect(head.toString("latin1", 0, 7)).toBe("PMTiles");
    expect(head[7]).toBe(3);
  });

  it("has every glyph range for the label fonts, so labels render offline", () => {
    for (const font of [labelFont, "Noto Sans Medium", "Noto Sans Italic"]) {
      const ranges = readdirSync(`public/map/fonts/${font}`).filter((f) => f.endsWith(".pbf"));
      expect(ranges).toHaveLength(256);
    }
    expect(existsSync("public/map/fonts/OFL.txt")).toBe(true);
  });

  it("has the light sprites at 1x and 2x", () => {
    for (const suffix of ["", "@2x"]) {
      expect(existsSync(`${pub(mapAssets.sprite)}${suffix}.json`)).toBe(true);
      expect(existsSync(`${pub(mapAssets.sprite)}${suffix}.png`)).toBe(true);
    }
  });

  it("styles the map only with colors that exist as tokens, in the design file and in the app", () => {
    // The app renders from globals.css, so a token only in design/tokens.css still shows the old color.
    const value = (css: string, name: string) => css.match(new RegExp(`--color-${name}: ([^;]+);`))?.[1];
    const design = readFileSync("design/tokens.css", "utf8");
    const app = readFileSync("src/app/globals.css", "utf8");
    for (const name of Object.values(mapTokens)) {
      expect(value(app, name), name).toBeDefined();
      expect(value(app, name), name).toBe(value(design, name));
    }
  });

  it("has all 50 Dapitan City barangays, each named, with closed outlines", () => {
    const file = JSON.parse(readFileSync(pub(mapAssets.barangays), "utf8"));
    expect(file.type).toBe("FeatureCollection");
    expect(file.features).toHaveLength(50);
    for (const feature of file.features) {
      expect(typeof feature.properties[barangayNameProperty]).toBe("string");
      expect(feature.properties.pcode).toMatch(/^PH0907201\d{3}$/);
      const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      for (const ring of polygons.flat()) {
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring.at(-1)).toEqual(ring[0]);
      }
    }
  });
});
