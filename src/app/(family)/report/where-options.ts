// What a neighbor can say about where to find them, after the hub's shelters.
const ALWAYS = ["With relatives", "At home"] as const;

/**
 * The choices for "Where to find you": the shelters the hub shows families,
 * then the two places that are never on the map. A shelter named like one of
 * those two is listed once.
 */
export function whereOptions(shelters: string[]): string[] {
  return [...new Set([...shelters.map((name) => name.trim()).filter((name) => name !== ""), ...ALWAYS])];
}
