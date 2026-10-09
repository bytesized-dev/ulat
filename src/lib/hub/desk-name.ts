/** A trailing "household", which staff often type or see after a surname. */
const HOUSEHOLD_SUFFIX = /\s+household$/i;

/** The name without a trailing "household": "Aquino household" is "Aquino". */
export function withoutHousehold(name: string): string {
  return name.trim().replace(HOUSEHOLD_SUFFIX, "").trim();
}

/** The last word of a name, which is how the desk calls a household. A trailing "household" is ignored. */
export function lastName(name: string): string {
  const words = withoutHousehold(name).split(/\s+/);
  return words[words.length - 1] ?? "";
}
