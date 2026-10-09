import { z } from "zod";
import { isSearchable } from "@/lib/hub/safe-query";

// GET /api/safe has no contract of its own. It returns name, barangay, where
// the person is staying and the time, never the message, and this is that shape.
const SafeRow = z.object({ name: z.string(), barangay: z.string(), staying_at: z.string(), at: z.string() });
export type SafeRow = z.infer<typeof SafeRow>;

const Reply = z.object({ results: z.array(SafeRow) });

/**
 * Searches the safe list by name. Returns null when the hub can't be reached
 * or the reply is not what the route sends, so the page can keep what it has.
 */
export async function fetchSafe(q: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<SafeRow[] | null> {
  const term = q.trim();
  if (!isSearchable(term)) return null;
  try {
    const res = await fetchImpl(`/api/safe?q=${encodeURIComponent(term)}`, { cache: "no-store", signal });
    if (!res.ok) return null;
    const parsed = Reply.safeParse(await res.json());
    return parsed.success ? parsed.data.results : null;
  } catch {
    return null;
  }
}
