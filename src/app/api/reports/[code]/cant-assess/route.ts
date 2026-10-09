import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { CantAssess, ReportCode } from "@/lib/contracts";
import { emit, setStatus } from "../../_lib/audit";
import { deny, getActor } from "../../_lib/auth";

// A responder could not assess a house. The report stays on the list with a new
// status, and the reason and note go into the audit row the hub reads.

// A house that was visited, merged or already marked is not reopened here.
const CLOSED = new Set(["visited", "cant_assess", "merged"]);

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const actor = await getActor();
  const blocked = deny(actor, ["responder"]);
  if (blocked) return blocked;
  if (!actor) return Response.json({ error: "not_signed_in" }, { status: 401 });

  const { code: raw } = await ctx.params;
  const code = ReportCode.safeParse(raw.trim().toUpperCase());
  if (!code.success) return Response.json({ error: "bad_code" }, { status: 400 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const body = CantAssess.safeParse(json);
  if (!body.success) return Response.json({ error: "bad_body", issues: body.error.issues }, { status: 400 });

  const report = db.select().from(reports).where(eq(reports.code, code.data)).get();
  if (!report) return Response.json({ error: "not_found" }, { status: 404 });
  if (CLOSED.has(report.status)) return Response.json({ error: "already_closed", status: report.status }, { status: 409 });

  const note = body.data.note?.trim() || null;
  const event = db.transaction((tx) => setStatus(tx, report, "cant_assess", actor.id, { cant_reason: body.data.reason, cant_note: note }, { reason: body.data.reason, note }));
  emit(event);
  return Response.json({ ok: true, status: "cant_assess" });
}
