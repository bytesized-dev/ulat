import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, events, photos, reports } from "@/db/schema";
import { EntryConfirm, EntryStatus, type HubEvent } from "@/lib/contracts";
import { setStatus } from "@/app/api/reports/_lib/audit";
import { audit, emit } from "../_lib/audit";
import { authorize } from "../_lib/auth";

type Ctx = { params: Promise<{ id: string }> };

const FIELDS = ["damage_class", "material", "hazards", "families", "people", "hurt", "missing", "needs"] as const;

export async function GET(req: Request, { params }: Ctx) {
  const actor = await authorize("either");
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const entry = db.select().from(entries).where(eq(entries.id, id)).get();
  if (!entry) return Response.json({ error: "not_found" }, { status: 404 });
  const history = db.select().from(events).where(eq(events.entity_id, id)).orderBy(asc(events.at)).all();
  return Response.json({ entry, photos: db.select().from(photos).where(eq(photos.entry_id, id)).all(), history });
}

// Staff settle an entry held for a second look, or edit one that is confirmed.
// A responder confirms a house once, from the assess screen, so they never patch.
export async function PATCH(req: Request, { params }: Ctx) {
  const actor = await authorize("staff");
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const body = EntryConfirm.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: "bad_body", issues: body.error.issues }, { status: 400 });
  const confirm = body.data;

  // Opt in: a caller that acts on what it rendered sends the status it saw, and
  // the save is refused when the entry has moved on. Without it nothing changes.
  const expectHeader = req.headers.get("x-ulat-expect-status");
  const expected = expectHeader === null ? null : EntryStatus.safeParse(expectHeader);
  if (expected && !expected.success) return Response.json({ error: "bad_expect_status" }, { status: 400 });

  const entry = db.select().from(entries).where(eq(entries.id, id)).get();
  if (!entry) return Response.json({ error: "not_found" }, { status: 404 });
  const report = entry.report_id ? db.select().from(reports).where(eq(reports.id, entry.report_id)).get() : undefined;

  // Staff settle a needs_review entry from the review screen, so their save confirms it.
  const status = "confirmed";
  const now = new Date().toISOString();
  // Staff editing an entry that is already confirmed change fields only. It is not
  // a new confirmation, so the status, who confirmed and when, and the report stay.
  // A caller that sends the header is settling a review and keeps the path below.
  const editing = entry.status === "confirmed" && expected === null;
  const changed = FIELDS.filter((field) => JSON.stringify(entry[field]) !== JSON.stringify(confirm[field]));
  if (editing && changed.length === 0) return Response.json({ entry, status: entry.status, reasons: [] });

  // Staff settle an entry that waits for review, or edit one that is confirmed.
  // The update below holds each path to its own status.
  const required = editing ? "confirmed" : "needs_review";
  let visited: HubEvent | null = null;

  const settled = db.transaction((tx) => {
    // The update goes first. It only matches an entry in the status the path may
    // change, and with the header still in the status the caller saw. No row changed means another save got there
    // first, so nothing has been written and the audit rows below never are.
    const result = tx
      .update(entries)
      .set({
        damage_class: confirm.damage_class,
        material: confirm.material,
        hazards: confirm.hazards,
        families: confirm.families,
        people: confirm.people,
        hurt: confirm.hurt,
        missing: confirm.missing,
        needs: confirm.needs,
        ...(editing
          ? {}
          : {
              status,
              review_reason: null,
              confirmed_by: actor.id,
              confirmed_at: now,
            }),
      })
      .where(
        and(
          eq(entries.id, id),
          eq(entries.status, required),
          expected?.success ? eq(entries.status, expected.data) : undefined,
        ),
      )
      .run();
    if (result.changes !== 1) return false;

    for (const field of changed) {
      audit(tx, id, "entry.field_changed", actor.id, { field, from: entry[field], to: confirm[field] });
    }

    if (editing) return true;

    audit(tx, id, "entry.confirmed", actor.id, { class: confirm.damage_class });
    if (report && report.status !== "merged") visited = setStatus(tx, report, "visited", actor.id, {}, { entry_id: id });
    return true;
  });
  if (!settled) return Response.json({ error: "not_in_review" }, { status: 409 });

  // For an edit this is only the refresh signal, so the hub totals refetch.
  emit({ type: "entry.confirmed", entry_id: id, report_code: report?.code ?? null });
  if (visited) emit(visited);

  const saved = db.select().from(entries).where(eq(entries.id, id)).get();
  return Response.json({ entry: saved, status, reasons: [] });
}
