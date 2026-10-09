import { randomUUID } from "node:crypto";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { entries, photos, reports } from "@/db/schema";
import { draftEntry } from "@/lib/ai/draft-entry";
import { ConfirmedDamageClass, NewEntryMeta } from "@/lib/contracts";
import { audit } from "./_lib/audit";
import { authorize } from "./_lib/auth";
import { discardUploads, MAX_PHOTOS, storeUpload, type Stored } from "./_lib/uploads";

// POST creates a draft from photos, an optional voice note, GPS and an optional
// report code, then runs the photo pipeline. GET lists confirmed entries.

/**
 * The entry a phone already made for this client_id, as a 200. A queued resend
 * after a lost reply lands here instead of making a second entry. An entry that
 * belongs to another responder is never returned.
 */
function existingEntry(clientId: string, responderId: string): Response | null {
  const found = db.select().from(entries).where(eq(entries.client_id, clientId)).get();
  if (!found) return null;
  if (found.responder_id !== responderId) return Response.json({ error: "client_id_taken" }, { status: 409 });
  return Response.json({ id: found.id, number: found.number, status: found.status, entry: found }, { status: 200 });
}

export async function POST(req: Request) {
  const actor = await authorize("responder");
  if (actor instanceof Response) return actor;
  if (actor.role !== "responder") return Response.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "bad_form" }, { status: 400 });
  }

  // The JSON part of the form is validated with the shared contract.
  let metaRaw: unknown;
  try {
    metaRaw = JSON.parse(String(form.get("meta") ?? ""));
  } catch {
    return Response.json({ error: "bad_meta" }, { status: 400 });
  }
  const meta = NewEntryMeta.safeParse(metaRaw);
  if (!meta.success) return Response.json({ error: "bad_meta", issues: meta.error.issues }, { status: 400 });

  const photoFiles = form.getAll("photos").filter((f): f is File => f instanceof File);
  if (photoFiles.length === 0 || photoFiles.length > MAX_PHOTOS) {
    return Response.json({ error: "photo_count" }, { status: 400 });
  }
  const noteFile = form.get("note");

  // A repeat of an entry the hub already saved. Nothing is stored and the AI
  // does not run again.
  if (meta.data.client_id) {
    const again = existingEntry(meta.data.client_id, actor.id);
    if (again) return again;
  }

  let report: typeof reports.$inferSelect | undefined;
  if (meta.data.report_code) {
    report = db.select().from(reports).where(eq(reports.code, meta.data.report_code)).get();
    if (!report) return Response.json({ error: "report_not_found" }, { status: 404 });
  }

  // Each file is stored as it is checked. Any failure before the entry row exists
  // deletes what was stored, so a bad part never leaves a file with no row.
  const stored: Stored[] = [];
  const reject = async (error: string) => {
    await discardUploads(stored);
    return Response.json({ error }, { status: 400 });
  };
  const storedPhotos: Stored[] = [];
  let notePath: string | null = null;
  try {
    for (const file of photoFiles) {
      const photo = await storeUpload(file, "photo");
      if ("error" in photo) return reject(photo.error);
      stored.push(photo);
      storedPhotos.push(photo);
    }
    if (noteFile instanceof File && noteFile.size > 0) {
      const note = await storeUpload(noteFile, "audio");
      if ("error" in note) return reject(note.error);
      stored.push(note);
      notePath = note.path;
    }
  } catch (error) {
    // storeUpload throws when the disk write fails. Files stored before it stay otherwise.
    await discardUploads(stored);
    throw error;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  let number: number | null;
  try {
    number = db.transaction((tx) => {
      const next = (tx.select({ n: sql<number>`coalesce(max(${entries.number}), 0)` }).from(entries).get()?.n ?? 0) + 1;
      // The unique client_id decides when two requests for the same entry run
      // at once. The loser inserts nothing and takes the winner's entry below.
      const inserted = tx
        .insert(entries)
        .values({
          id,
          number: next,
          report_id: report?.id ?? null,
          responder_id: actor.id,
          barangay: meta.data.barangay,
          purok: meta.data.purok,
          household_head: meta.data.household_head,
          lat: meta.data.lat,
          lng: meta.data.lng,
          gps_accuracy_m: meta.data.gps_accuracy_m,
          // A house with a family report starts from what the family said, so the
          // responder only changes what they find different. Reports carry no
          // family count, so families keeps its default of 1. Without a report
          // these stay at their column defaults.
          ...(report ? { people: report.people, hurt: report.hurt, missing: report.missing, needs: report.needs } : {}),
          note_path: notePath,
          status: "draft",
          client_id: meta.data.client_id,
          created_at: now,
        })
        .onConflictDoNothing({ target: entries.client_id })
        .run();
      if (inserted.changes === 0) return null;
      storedPhotos.forEach((p, i) =>
        tx.insert(photos).values({ entry_id: id, path: p.path, label: meta.data.photo_labels[i] ?? null, taken_at: now }).run(),
      );
      audit(tx, id, "entry.created", actor.id, { number: next, report_code: meta.data.report_code, photos: storedPhotos.length, note: !!notePath });
      return next;
    });
  } catch (error) {
    await discardUploads(stored);
    throw error;
  }
  if (number === null) {
    // Lost the race: the files stored for this request belong to no entry.
    await discardUploads(stored);
    const winner = meta.data.client_id ? existingEntry(meta.data.client_id, actor.id) : null;
    return winner ?? Response.json({ error: "client_id_conflict" }, { status: 409 });
  }

  // The draft is saved. The model can take up to 60 seconds, so the response
  // does not wait for it: the /drafting screen waits for the entry.drafted
  // event instead.
  void draftEntry(id).catch((error) => console.error("Drafting entry failed", id, error));
  const saved = db.select().from(entries).where(eq(entries.id, id)).get();
  return Response.json({ id, number, status: "draft", entry: saved }, { status: 201 });
}

const Query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
  barangay: z.string().max(120).optional(),
  damage_class: ConfirmedDamageClass.optional(),
  q: z.string().trim().max(80).optional(),
});

export async function GET(req: Request) {
  const actor = await authorize("staff");
  if (actor instanceof Response) return actor;

  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return Response.json({ error: "bad_query", issues: parsed.error.issues }, { status: 400 });
  const { page, per_page, barangay, damage_class, q } = parsed.data;

  // Only confirmed entries feed the hub.
  const search = q
    ? or(
        like(entries.household_head, `%${q}%`),
        like(entries.barangay, `%${q}%`),
        like(entries.purok, `%${q}%`),
        sql`printf('%04d', ${entries.number}) like ${`%${q}%`}`,
      )
    : undefined;
  const where = and(
    eq(entries.status, "confirmed"),
    barangay ? eq(entries.barangay, barangay) : undefined,
    damage_class ? eq(entries.damage_class, damage_class) : undefined,
    search,
  );

  const total = db.select({ n: sql<number>`count(*)` }).from(entries).where(where).get()?.n ?? 0;
  const items = db
    .select()
    .from(entries)
    .where(where)
    .orderBy(desc(entries.confirmed_at), desc(entries.number))
    .limit(per_page)
    .offset((page - 1) * per_page)
    .all();
  return Response.json({ items, total, page, per_page });
}
