import { z } from "zod";

const Barangays = z.array(z.string().trim().min(1).max(120));

/**
 * The barangays staff set up on the hub, in the order they saved them. The
 * setting is a JSON list. A missing or broken value gives an empty list, and
 * the screen shows an empty select instead of failing.
 */
export function parseBarangays(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = Barangays.safeParse(JSON.parse(raw));
    return parsed.success ? [...new Set(parsed.data)] : [];
  } catch {
    return [];
  }
}
