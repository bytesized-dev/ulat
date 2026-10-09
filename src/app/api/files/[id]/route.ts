import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, photos } from "@/db/schema";
import { deny, getActor } from "../../entries/_lib/auth";
import { readUpload } from "../../entries/_lib/uploads";

// Serves a stored photo by its photo id, or an entry's voice note by the entry
// id. Responders and staff only: houses, injuries and homes are private.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = deny(getActor(req), ["responder", "staff"]);
  if (blocked) return blocked;
  const { id } = await params;

  const path =
    db.select({ path: photos.path }).from(photos).where(eq(photos.id, id)).get()?.path ??
    db.select({ path: entries.note_path }).from(entries).where(eq(entries.id, id)).get()?.path;
  if (!path) return Response.json({ error: "not_found" }, { status: 404 });

  const file = await readUpload(path);
  if (!file) return Response.json({ error: "not_found" }, { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
