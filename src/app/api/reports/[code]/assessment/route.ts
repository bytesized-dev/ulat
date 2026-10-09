import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { queueReportDraft } from "@/lib/ai/draft-report";
import { ReportCode, ReportVerdict } from "@/lib/contracts";
import { isStalled, reportUrgency } from "@/lib/reports/assessment";
import { audit, emit } from "../../_lib/audit";
import { readJsonCapped } from "../../_lib/body";
import { deny, getActor } from "../../_lib/auth";

// The hub's reading of a family report photo, and a person's verdict on it.
// PATCH sets the verdict: a staff member's own class and urgency, which
// every screen shows instead of the AI's. The latest one wins and each
// goes in the audit trail with the values it replaced. POST (staff only too) reads the photo
// again when the last reading failed or stalled. Neither changes a total, and
// families never see either.

async function findReport(ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const code = ReportCode.safeParse(raw.trim().toUpperCase());
  if (!code.success) return { error: Response.json({ error: "bad_code" }, { status: 400 }) } as const;
  const report = db.select().from(reports).where(eq(reports.code, code.data)).get();
  if (!report) return { error: Response.json({ error: "not_found" }, { status: 404 }) } as const;
  if (report.status === "merged") return { error: Response.json({ error: "merged" }, { status: 409 }) } as const;
  if (report.photo_path === null) return { error: Response.json({ error: "no_photo" }, { status: 409 }) } as const;
  return { report } as const;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const actor = await getActor();
  const blocked = deny(actor, ["staff"]);
  if (blocked || !actor) return blocked ?? Response.json({ error: "not_signed_in" }, { status: 401 });

  const found = await findReport(ctx);
  if (found.error) return found.error;
  const { report } = found;

  const read = await readJsonCapped(req);
  if (!read.ok) return read.response;
  const body = ReportVerdict.safeParse(read.value);
  if (!body.success) return Response.json({ error: "bad_body", issues: body.error.issues }, { status: 400 });

  const note = body.data.note || null;
  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.update(reports)
      .set({ verdict_class: body.data.damage_class, verdict_urgency: body.data.urgency, verdict_note: note, verdict_by: actor.id, verdict_at: now })
      .where(eq(reports.id, report.id))
      .run();
    audit(tx, report.id, "report.verdict", actor.id, {
      from: { damage_class: report.verdict_class ?? report.ai_class, urgency: reportUrgency(report), by: report.verdict_by ?? "ai" },
      to: { damage_class: body.data.damage_class, urgency: body.data.urgency },
      note,
    });
  });
  emit({ type: "report.assessed", code: report.code });
  return Response.json({ ok: true });
}

export async function POST(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const actor = await getActor();
  const blocked = deny(actor, ["staff"]);
  if (blocked || !actor) return blocked ?? Response.json({ error: "not_signed_in" }, { status: 401 });

  const found = await findReport(ctx);
  if (found.error) return found.error;
  const { report } = found;
  // A reading still running is left alone, unless it has stalled.
  if (report.ai_status === "pending" && !isStalled(report.ai_status, report.ai_at)) {
    return Response.json({ error: "reading" }, { status: 409 });
  }

  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.update(reports).set({ ai_status: "pending", ai_at: now }).where(eq(reports.id, report.id)).run();
    audit(tx, report.id, "report.reading_requested", actor.id, { previous: report.ai_status });
  });
  emit({ type: "report.assessed", code: report.code });
  const reading = queueReportDraft(report.id);
  if (process.env.MOCK_AI === "1") await reading;
  return Response.json({ ok: true }, { status: 202 });
}
