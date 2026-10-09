import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, photos, reports } from "@/db/schema";
import { authorize } from "../../entries/_lib/auth";
import { readUpload } from "../../entries/_lib/uploads";

// Serves a stored photo by its photo id, an entry's voice note by the entry id,
// or a family's voice note by the report id. Responders and staff only: houses, injuries and homes are private.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await authorize("either");
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const path =
    db.select({ path: photos.path }).from(photos).where(eq(photos.id, id)).get()?.path ??
    db.select({ path: entries.note_path }).from(entries).where(eq(entries.id, id)).get()?.path ??
    db.select({ path: reports.voice_path }).from(reports).where(eq(reports.id, id)).get()?.path;
  if (!path) return Response.json({ error: "not_found" }, { status: 404 });

  const file = await readUpload(path);
  if (!file) return Response.json({ error: "not_found" }, { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { "content-type": file.mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
}
