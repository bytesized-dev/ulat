import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, events, photos, reports } from "@/db/schema";
import { EntryConfirm, EntryStatus, type HubEvent } from "@/lib/contracts";
import { setStatus } from "@/app/api/reports/_lib/audit";
import { audit, emit } from "../_lib/audit";
import { authorize } from "../_lib/auth";
import { REVIEW_REASONS, reviewReasons } from "../_lib/review";

type Ctx = { params: Promise<{ id: string }> };

const FIELDS = ["damage_class", "material", "hazards", "families", "people", "hurt", "missing", "needs"] as const;

export async function GET(req: Request, { params }: Ctx) {
  const actor = await authorize("either");
  if (actor instanceof Response) return actor;
  const { id } = await params;

  const entry = db.select().from(entries).where(eq(entries.id, id)).get();
  if (!entry) return Response.json({ error: "not_found" }, { status: 404 });
  const history = db.select().from(events).where(eq(events.entity_id, id)).orderBy(asc(events.at)).all();
  return Response.json({
    entry,
    photos: db.select().from(photos).where(eq(photos.entry_id, id)).all(),
    ai: {
      damage_class: entry.ai_class,
      confidence: entry.ai_confidence,
      reason: entry.ai_reason,
      need_more: entry.ai_need_more,
    },
    history,
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const actor = await authorize("either");
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

  // A responder only reaches their own entries. It says not_found for someone
  // else's, so it does not confirm that the entry exists. The update below checks
  // the same thing again in its where clause.
  if (actor.role === "responder" && entry.responder_id !== actor.id) return Response.json({ error: "not_found" }, { status: 404 });

  // Staff settle a needs_review entry from the review screen, so their save
  // confirms it. A responder's save goes through the SPEC section 5 rules.
  const hasNewPhoto =
    db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.entity_id, id), eq(events.type, "entry.photo_added")))
      .limit(1)
      .get() !== undefined;
  const reasons =
    actor.role === "staff"
      ? []
      : reviewReasons({ aiClass: entry.ai_class, confirm, hasNewPhoto, reportHurt: report?.hurt ?? null });
  const status = reasons.length > 0 ? "needs_review" : "confirmed";
  const now = new Date().toISOString();
  // Staff editing an entry that is already confirmed change fields only. It is not
  // a new confirmation, so the status, who confirmed and when, and the report stay.
  // A caller that sends the header is settling a review and keeps the path below.
  const editing = actor.role === "staff" && entry.status === "confirmed" && expected === null;
  const changed = FIELDS.filter((field) => JSON.stringify(entry[field]) !== JSON.stringify(confirm[field]));
  if (editing && changed.length === 0) return Response.json({ entry, status: entry.status, reasons: [] });

  // A responder saves their own draft. Staff settle an entry that waits for review,
  // or edit one that is confirmed. The update below holds each path to its own status.
  const required = actor.role === "responder" ? "draft" : editing ? "confirmed" : "needs_review";
  let visited: HubEvent | null = null;

  const settled = db.transaction((tx) => {
    // The update goes first. It only matches an entry in the status the role may
    // change, owned by the responder when one is saving, and with the header still
    // in the status the caller saw. No row changed means another save got there
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
              review_reason: reasons.length > 0 ? reasons.map((r) => REVIEW_REASONS[r]).join(" ") : null,
              confirmed_by: status === "confirmed" ? actor.id : null,
              confirmed_at: status === "confirmed" ? now : null,
            }),
      })
      .where(
        and(
          eq(entries.id, id),
          eq(entries.status, required),
          actor.role === "responder" ? eq(entries.responder_id, actor.id) : undefined,
          expected?.success ? eq(entries.status, expected.data) : undefined,
        ),
      )
      .run();
    if (result.changes !== 1) return false;

    for (const field of changed) {
      audit(tx, id, "entry.field_changed", actor.id, { field, from: entry[field], to: confirm[field] });
    }

    if (editing) return true;

    if (status === "confirmed") {
      audit(tx, id, "entry.confirmed", actor.id, { class: confirm.damage_class });
      if (report) visited = setStatus(tx, report, "visited", actor.id, {}, { entry_id: id });
    } else {
      audit(tx, id, "entry.needs_review", actor.id, { reasons });
    }
    return true;
  });
  if (!settled) return Response.json({ error: actor.role === "responder" ? "not_a_draft" : "not_in_review" }, { status: 409 });

  if (status === "confirmed") {
    // For an edit this is only the refresh signal, so the hub totals refetch.
    emit({ type: "entry.confirmed", entry_id: id, report_code: report?.code ?? null });
    if (visited) emit(visited);
  } else {
    emit({ type: "entry.needs_review", entry_id: id });
  }

  const saved = db.select().from(entries).where(eq(entries.id, id)).get();
  return Response.json({ entry: saved, status, reasons });
}
