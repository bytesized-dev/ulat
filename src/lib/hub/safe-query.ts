// The part of the safe list search that browser code needs too. It has no
// database import, so a client component can use it.

/** A name search under this many letters returns nothing, so the list cannot be read out whole. */
export const MIN_QUERY = 2;

/** Whether what was typed is long enough to search for. */
export function isSearchable(q: string): boolean {
  return q.trim().length >= MIN_QUERY;
}
