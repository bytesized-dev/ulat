import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { places, updates } from "@/db/schema";
import { requireStaff } from "@/lib/auth/session";
import { NewPlace } from "@/lib/contracts";
import { noStore, parseBody } from "@/lib/hub/http";
import { placeToUpdate } from "@/lib/hub/places";
import { publish } from "@/lib/live/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Visible places for everyone. Staff also get hidden ones, so the hub map can show them again. */
export async function GET() {
  const isStaff = !((await requireStaff()) instanceof Response);
  const query = db.select().from(places);
  const rows = (isStaff ? query : query.where(eq(places.visible, true))).orderBy(desc(places.created_at)).all();
  return Response.json({ places: rows }, { headers: noStore });
}

/** Staff add a relief point, shelter or hazard, and optionally post it as an update. */
export async function POST(request: Request) {
  const session = await requireStaff();
  if (session instanceof Response) return session;

  const body = await parseBody(request, NewPlace);
  if (!body.ok) return body.response;
  const { post_as_update, ...place } = body.data;

  const id = randomUUID();
  const now = new Date().toISOString();
  const updateId = post_as_update ? randomUUID() : null;
  db.transaction((tx) => {
    tx.insert(places).values({ id, ...place, created_at: now }).run();
    if (updateId) tx.insert(updates).values({ id: updateId, ...placeToUpdate(body.data, id), posted_at: now }).run();
  });

  publish({ type: "place.saved", place_id: id });
  if (updateId) publish({ type: "update.posted", update_id: updateId });
  return Response.json({ id, update_id: updateId }, { status: 201 });
}
