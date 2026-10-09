import type { Db } from "@/db/client";
import { events } from "@/db/schema";
import type { HubEvent } from "@/lib/contracts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** One audit row. Every write to an entry adds at least one. */
export function audit(tx: Tx | Db, entryId: string, type: string, actor: string, data: Record<string, unknown> = {}) {
  tx.insert(events).values({ entity: "entry", entity_id: entryId, type, actor, data, at: new Date().toISOString() }).run();
}

/**
 * Live updates go through CJ's /api/events stream, which is not built yet.
 * Handlers call this after their transaction commits, so the swap is one line.
 */
export function emit(event: HubEvent) {
  void event;
}
