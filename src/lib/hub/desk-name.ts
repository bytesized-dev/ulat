/** The last word of a name, which is how the desk calls a household. */
export function lastName(name: string): string {
  const words = name.trim().split(/\s+/);
  return words[words.length - 1] ?? "";
}
