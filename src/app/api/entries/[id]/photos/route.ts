import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { entries, photos } from "@/db/schema";
import { draftEntry } from "@/lib/ai/draft-entry";
import { audit } from "../../_lib/audit";
import { authorize } from "../../_lib/auth";
import { MAX_PHOTOS, storeUpload } from "../../_lib/uploads";

type Ctx = { params: Promise<{ id: string }> };

const Label = z.string().trim().max(80);

// POST adds one photo to a draft entry, for example the roof photo the AI asked
// for, then runs the photo draft again. The responder sees entry.drafted.
export async function POST(req: Request, { params }: Ctx) {
  const actor = await authorize("responder");
  if (actor instanceof Response) return actor;
  if (actor.role !== "responder") return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "bad_form" }, { status: 400 });
  }
  const file = form.get("photo");
  if (!(file instanceof File)) return Response.json({ error: "photo_missing" }, { status: 400 });
  const label = Label.safeParse(form.get("label") ?? "");
  if (!label.success) return Response.json({ error: "bad_label", issues: label.error.issues }, { status: 400 });

  const entry = db.select().from(entries).where(eq(entries.id, id)).get();
  if (!entry) return Response.json({ error: "not_found" }, { status: 404 });
  if (entry.status !== "draft") return Response.json({ error: "not_a_draft" }, { status: 409 });
  const existing = db.select({ n: count() }).from(photos).where(eq(photos.entry_id, id)).get()?.n ?? 0;
  if (existing >= MAX_PHOTOS) return Response.json({ error: "photo_count" }, { status: 400 });

  const stored = await storeUpload(file, "photo");
  if ("error" in stored) return Response.json({ error: stored.error }, { status: 400 });

  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.insert(photos).values({ entry_id: id, path: stored.path, label: label.data || null, taken_at: now }).run();
    // Not published: HubEvent has no such member. The live signal is entry.drafted.
    audit(tx, id, "entry.photo_added", actor.id, { label: label.data || null, photos: existing + 1 });
  });

  // Same as POST /api/entries: the real model can take up to 60 seconds, so the
  // response does not wait for it. Fixtures under MOCK_AI are instant, so those
  // are awaited and the response carries the new AI fields.
  const drafting = draftEntry(id).catch((error) => console.error("Drafting entry failed", id, error));
  if (process.env.MOCK_AI === "1") await drafting;
  const saved = db.select().from(entries).where(eq(entries.id, id)).get();
  return Response.json({ id, photos: existing + 1, entry: saved }, { status: 201 });
}
