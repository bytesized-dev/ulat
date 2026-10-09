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

  const size = file.data.length;
  const headers = {
    "content-type": file.mime,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
  };

  // Browsers need Content-Length and 206 answers to learn an audio file's duration and seek in it.
  const range = parseRange(req.headers.get("range"), size);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
  }
  if (range) {
    const body = file.data.subarray(range.start, range.end + 1);
    return new Response(new Uint8Array(body), {
      status: 206,
      headers: {
        ...headers,
        "content-length": String(body.length),
        "content-range": `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  }
  return new Response(new Uint8Array(file.data), { headers: { ...headers, "content-length": String(size) } });
}

/**
 * One byte range, inclusive. null means serve the whole file: no header, a unit
 * other than bytes, several ranges or bad syntax, which RFC 9110 lets us ignore.
 */
function parseRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | null {
  const match = header?.trim().match(/^bytes=(\d*)-(\d*)$/i);
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start: number;
  let end: number;
  if (match[1] === "") {
    // A suffix range: the last n bytes.
    const suffix = Number(match[2]);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
    if (start >= size) return "unsatisfiable";
    if (end < start) return null;
  }
  return { start, end };
}
