import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapTokens } from "./map-assets";
import { basemapSource, mapFlavor, mapStyle } from "./map-style";

// Each role gets its own fake color, so the test can tell which role landed where.
const palette = Object.fromEntries(Object.keys(mapTokens).map((role) => [role, `token(${role})`])) as Parameters<
  typeof mapStyle
>[1];

describe("mapStyle", () => {
  const style = mapStyle("https://hub.local", palette);

  it("loads tiles, glyphs and sprites only from the hub", () => {
    const urls = [style.glyphs, style.sprite, JSON.stringify(style.sources)].join(" ");
    for (const url of urls.match(/[a-z]+:\/\/[^"\s]+/g) ?? []) {
      expect(url).toMatch(/^(https:\/\/hub\.local|pmtiles:\/\/https:\/\/hub\.local)\//);
    }
    expect(JSON.stringify(style.sources)).toContain("pmtiles://https://hub.local/map/town.pmtiles");
  });

  it("draws the Protomaps layers from the local basemap source", () => {
    expect(style.layers.length).toBeGreaterThan(50);
    for (const layer of style.layers) {
      if ("source" in layer) expect(layer.source).toBe(basemapSource);
    }
  });

  it("only asks for fonts that are in public/map/fonts", () => {
    // A missing font makes its labels vanish without an error, so check every one the style names.
    const asked = new Set(JSON.stringify(style.layers).match(/Noto Sans[^"]*/g));
    const served = readdirSync("public/map/fonts");
    for (const font of asked) expect(served, font).toContain(font);
  });
});

describe("built-up areas", () => {
  it("paints residential and commercial land gray, right above the land and under the roads", () => {
    const ids = mapStyle("https://hub.local", palette).layers.map((layer) => layer.id);
    const builtUp = ids.indexOf("landuse_built_up");
    expect(builtUp).toBe(ids.indexOf("earth") + 1);
    expect(builtUp).toBeLessThan(ids.indexOf("water"));
    expect(builtUp).toBeLessThan(ids.indexOf("roads_major"));
  });
});

describe("mapFlavor", () => {
  const flavor = mapFlavor(palette);

  it("colors water, land and built-up areas from the map tokens", () => {
    expect(flavor.water).toBe("token(sea)");
    expect(flavor.background).toBe("token(sea)");
    expect(flavor.earth).toBe("token(land)");
    expect(flavor.wood_a).toBe("token(land)");
    expect(flavor.park_a).toBe("token(park)");
  });

  it("gives main roads a fill and an outline, and minor roads a fill only", () => {
    expect(flavor.major).toBe("token(road)");
    expect(flavor.major_casing_late).toBe("token(roadCasing)");
    expect(flavor.minor_a).toBe("token(roadMinor)");
    expect(flavor.minor_casing).toBe("token(urban)");
  });
});
