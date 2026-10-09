/** Text helpers shared by the kit pages. */

/** "gemma4:e4b" as "Gemma 4 E4B". A name in another shape is shown as it is. */
export function modelLabel(model: string): string {
  const match = /^gemma(\d+):([a-z0-9]+)$/i.exec(model.trim());
  return match ? `Gemma ${match[1]} ${match[2].toUpperCase()}` : model;
}

/** A rate from 0 to 1 as "87%". Null, a rate with nothing to divide by, reads "n/a". Only the display rounds. */
export function formatRate(rate: number | null | undefined): string {
  return typeof rate === "number" && Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : "n/a";
}

/** Seconds as "4.2". Null reads "n/a". */
export function formatSeconds(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "n/a";
}

/** A count, or "n/a" when the file has none. */
export function formatCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "n/a";
}
