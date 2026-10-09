import type { BarangayShading, ShadeLevel } from "./types";

/**
 * Turns confirmed totally damaged counts per barangay into three shades. The
 * counts come from SQL over confirmed entries; this only splits them into
 * thirds of the highest count. Barangays with none get no shade.
 */
export function shadeByTotals(totals: Readonly<Record<string, number>>): BarangayShading {
  const max = Math.max(0, ...Object.values(totals));
  const shading: Record<string, ShadeLevel> = {};
  if (max === 0) return shading;
  for (const [name, count] of Object.entries(totals)) {
    if (count <= 0) continue;
    const share = count / max;
    shading[name] = share > 2 / 3 ? 1 : share > 1 / 3 ? 2 : 3;
  }
  return shading;
}

/**
 * A MapLibre fill-color expression that looks up each barangay's shade by name.
 * Colors are passed in, read from the map tokens at runtime, never written here.
 */
export function shadingFillColor(
  shading: BarangayShading,
  nameProperty: string,
  colors: Readonly<Record<ShadeLevel, string>>,
  none: string,
): string | unknown[] {
  const pairs = Object.entries(shading).flatMap(([name, level]) => [name, colors[level]]);
  if (pairs.length === 0) return none;
  return ["match", ["get", nameProperty], ...pairs, none];
}

/** The name of a barangay feature, or undefined when the file spells it differently. */
export function barangayName(properties: Record<string, unknown>, nameProperty: string): string | undefined {
  const value = properties[nameProperty];
  return typeof value === "string" ? value : undefined;
}
