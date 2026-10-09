import { randomUUID } from "node:crypto";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { entries, photos, reports } from "@/db/schema";
import { draftEntry } from "@/lib/ai/draft-entry";
import { ConfirmedDamageClass, NewEntryMeta } from "@/lib/contracts";
import { audit } from "./_lib/audit";
import { authorize } from "./_lib/auth";
import { MAX_PHOTOS, storeUpload, type Stored } from "./_lib/uploads";

// POST creates a draft from photos, an optional voice note, GPS and an optional
// report code, then runs the photo pipeline. GET lists confirmed entries.

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

  let report: typeof reports.$inferSelect | undefined;
  if (meta.data.report_code) {
    report = db.select().from(reports).where(eq(reports.code, meta.data.report_code)).get();
    if (!report) return Response.json({ error: "report_not_found" }, { status: 404 });
  }

  const storedPhotos: Stored[] = [];
  for (const file of photoFiles) {
    const stored = await storeUpload(file, "photo");
    if ("error" in stored) return Response.json({ error: stored.error }, { status: 400 });
    storedPhotos.push(stored);
  }
  let notePath: string | null = null;
  if (noteFile instanceof File && noteFile.size > 0) {
    const stored = await storeUpload(noteFile, "audio");
    if ("error" in stored) return Response.json({ error: stored.error }, { status: 400 });
    notePath = stored.path;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const number = db.transaction((tx) => {
    const next = (tx.select({ n: sql<number>`coalesce(max(${entries.number}), 0)` }).from(entries).get()?.n ?? 0) + 1;
    tx.insert(entries)
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
        note_path: notePath,
        status: "draft",
        created_at: now,
      })
      .run();
    storedPhotos.forEach((p, i) =>
      tx.insert(photos).values({ entry_id: id, path: p.path, label: meta.data.photo_labels[i] ?? null, taken_at: now }).run(),
    );
    audit(tx, id, "entry.created", actor.id, { number: next, report_code: meta.data.report_code, photos: storedPhotos.length, note: !!notePath });
    return next;
  });

  // The draft is saved. The real model can take up to 60 seconds, so the
  // response does not wait for it: the /drafting screen waits for the
  // entry.drafted event instead. Fixtures under MOCK_AI are instant, so those
  // are awaited and the response carries the AI fields.
  const drafting = draftEntry(id).catch((error) => console.error("Drafting entry failed", id, error));
  if (process.env.MOCK_AI === "1") await drafting;
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
