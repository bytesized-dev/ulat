import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reports, responders } from "@/db/schema";
import { AssignReport, ReportCode } from "@/lib/contracts";
import { emit, setStatus } from "../../_lib/audit";
import { deny, getActor } from "../../_lib/auth";
import { readJsonCapped } from "../../_lib/body";

// MDRRMO staff send a responder to a family report from the hub (BYT-28). The
// status moves through setStatus, so the audit row the family timeline reads
// is written in the same transaction, and report.updated goes out after commit.

/** Reports nobody has finished with. Visited and merged reports stay as they are. */
const ASSIGNABLE = new Set(["waiting", "assigned", "on_the_way", "cant_assess"]);

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const blocked = deny(await getActor(), ["staff"]);
  if (blocked) return blocked;

  const { code: raw } = await ctx.params;
  const code = ReportCode.safeParse(raw.trim().toUpperCase());
  if (!code.success) return Response.json({ error: "bad_code" }, { status: 400 });

  const read = await readJsonCapped(req);
  if (!read.ok) return read.response;
  const parsed = AssignReport.safeParse(read.value);
  if (!parsed.success) return Response.json({ error: "bad_assign", issues: parsed.error.issues }, { status: 400 });
  const { responder_id } = parsed.data;

  const result = db.transaction((tx) => {
    const report = tx.select().from(reports).where(eq(reports.code, code.data)).get();
    if (!report) return { error: "not_found", status: 404 } as const;
    if (!ASSIGNABLE.has(report.status)) return { error: "already_done", status: 409 } as const;

    const responder = tx
      .select({ id: responders.id })
      .from(responders)
      .where(and(eq(responders.id, responder_id), eq(responders.active, true)))
      .get();
    if (!responder) return { error: "bad_responder", status: 400 } as const;

    const event = setStatus(
      tx,
      report,
      "assigned",
      "staff",
      { assigned_to: responder.id, cant_reason: null, cant_note: null },
      { responder_id: responder.id, from: report.status, previous_responder_id: report.assigned_to },
    );
    return { event } as const;
  });

  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  emit(result.event);
  return Response.json({ code: code.data, status: "assigned", assigned_to: responder_id });
}
