import { count, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries } from "@/db/schema";

/** Entries a responder sent that still wait for staff review. Server only. */
export function getReviewCount(): number {
  const [row] = db.select({ n: count() }).from(entries).where(eq(entries.status, "needs_review")).all();
  return row?.n ?? 0;
}
