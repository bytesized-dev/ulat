import type { MapRole } from "@/lib/hub/map-assets";
import type { MapPalette } from "@/lib/hub/map-style";

/*
  MapLibre paints in WebGL, so it needs color values, not classes. Each role
  is drawn once as a hidden swatch with its token class and the computed color
  is read back. The class names are written out in full so Tailwind generates
  them; map-palette.test.ts checks they match mapTokens.
*/

export const swatchClass: Readonly<Record<MapRole, string>> = {
  land: "bg-map-land",
  urban: "bg-map-urban",
  park: "bg-map-park",
  sea: "bg-map-sea",
  river: "bg-map-river",
  road: "bg-map-road",
  roadCasing: "bg-map-road-casing",
  roadMinor: "bg-map-road-minor",
  boundary: "bg-map-boundary",
  shade1: "bg-map-shade-1",
  shade2: "bg-map-shade-2",
  shade3: "bg-map-shade-3",
  label: "bg-body",
  halo: "bg-canvas",
};

export function readPalette(): MapPalette {
  const swatch = document.createElement("span");
  swatch.hidden = true;
  document.body.append(swatch);
  try {
    const entries = Object.entries(swatchClass).map(([role, className]) => {
      swatch.className = className;
      return [role, getComputedStyle(swatch).backgroundColor];
    });
    return Object.fromEntries(entries) as MapPalette;
  } finally {
    swatch.remove();
  }
}
