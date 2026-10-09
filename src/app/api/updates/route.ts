import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { updates } from "@/db/schema";
import { requireStaff } from "@/lib/auth/session";
import { NewUpdate } from "@/lib/contracts";
import { noStore, parseBody } from "@/lib/hub/http";
import { listUpdates } from "@/lib/hub/updates";
import { publish } from "@/lib/live/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Active updates, newest first. Everyone, families included. */
export async function GET() {
  return Response.json({ updates: listUpdates(db) }, { headers: noStore });
}

/** Staff post an update. Phones refetch on update.posted. */
export async function POST(request: Request) {
  const session = await requireStaff();
  if (session instanceof Response) return session;

  const body = await parseBody(request, NewUpdate);
  if (!body.ok) return body.response;

  const id = randomUUID();
  db.insert(updates)
    .values({ id, ...body.data, posted_at: new Date().toISOString() })
    .run();
  publish({ type: "update.posted", update_id: id });
  return Response.json({ id }, { status: 201 });
}
