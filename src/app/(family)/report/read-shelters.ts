import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { places } from "@/db/schema";

/** The names of the shelters staff have made visible, in the order they were added. */
export function readShelterNames(): string[] {
  return db
    .select({ name: places.name })
    .from(places)
    .where(and(eq(places.type, "shelter"), eq(places.visible, true)))
    .orderBy(asc(places.created_at))
    .all()
    .map((row) => row.name);
}
