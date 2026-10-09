import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { safe_checkins } from "@/db/schema";
import { requireStaff } from "@/lib/auth/session";
import { SafeCheckin } from "@/lib/contracts";
import { noStore, parseBody } from "@/lib/hub/http";
import { MIN_QUERY, recentSafe, searchSafe } from "@/lib/hub/safe";
import { publish } from "@/lib/live/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Name search for everyone: name, barangay, staying at and time only, never
 * the message. A query under two letters returns nothing, so the list cannot
 * be read out whole from a phone. Staff with no query get the latest check-ins.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length >= MIN_QUERY) return Response.json({ results: searchSafe(db, q) }, { headers: noStore });

  const isStaff = !((await requireStaff()) instanceof Response);
  return Response.json({ results: isStaff && q === "" ? recentSafe(db) : [] }, { headers: noStore });
}

/** A family checks in from a phone, or the help desk checks someone in. */
export async function POST(request: Request) {
  const body = await parseBody(request, SafeCheckin);
  if (!body.ok) return body.response;

  // Only the hub laptop, behind the staff PIN, speaks for the desk.
  if (body.data.source === "desk") {
    const session = await requireStaff();
    if (session instanceof Response) return session;
  }

  const id = randomUUID();
  db.insert(safe_checkins)
    .values({ id, ...body.data, at: new Date().toISOString() })
    .run();
  publish({ type: "safe.checked_in", id });
  return Response.json({ id }, { status: 201 });
}
