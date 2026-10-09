import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { responders } from "@/db/schema";

/** True while the responder exists and has not been switched off. */
export function isActiveResponder(id: string): boolean {
  return (
    db
      .select({ id: responders.id })
      .from(responders)
      .where(and(eq(responders.id, id), eq(responders.active, true)))
      .get() !== undefined
  );
}
