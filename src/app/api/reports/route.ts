import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ne, or, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { NewReport, ReportStatus } from "@/lib/contracts";
import { audit, emit } from "./_lib/audit";
import { readJsonCapped } from "./_lib/body";
import { deny, getActor } from "./_lib/auth";
import { freshCode } from "./_lib/code";
import { isUrgent, urgentSql } from "./_lib/view";

// POST takes a NewReport from a family phone or the help desk and returns the
// code. GET lists reports for responders and staff, urgent first.

export async function POST(req: Request) {
  const read = await readJsonCapped(req);
  if (!read.ok) return read.response;
  const parsed = NewReport.safeParse(read.value);
  if (!parsed.success) return Response.json({ error: "bad_report", issues: parsed.error.issues }, { status: 400 });
  const body = parsed.data;

  // Families have no session. Only staff can file a report as the help desk.
  let actor = "family";
  if (body.source === "desk") {
    const blocked = deny(await getActor(), ["staff"]);
    if (blocked) return blocked;
    actor = "staff";
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const urgent = isUrgent(body);
  const code = db.transaction((tx) => {
    const fresh = freshCode(tx);
    tx.insert(reports)
      .values({
        id,
        code: fresh,
        source: body.source,
        household_head: body.household_head,
        reporter_name: body.reporter_name,
        reporter_where: body.reporter_where,
        barangay: body.barangay,
        purok: body.purok,
        lat: body.lat,
        lng: body.lng,
        people: body.people,
        hurt: body.hurt,
        missing: body.missing,
        what_happened: body.what_happened,
        needs: body.needs,
        transcript: body.transcript,
        transcript_en: body.english,
        language: body.language,
        status: "waiting",
        created_at: now,
        updated_at: now,
      })
      .run();
    // voice_id is kept here until the voice route says where the audio lives.
    audit(tx, id, "report.created", actor, { code: fresh, source: body.source, urgent, voice_id: body.voice_id });
    return fresh;
  });

  emit({ type: "report.created", code, urgent });
  return Response.json({ code }, { status: 201 });
}

// A search word is plain text. % and _ would otherwise match anything.
const contains = (column: SQLiteColumn, term: string): SQL =>
  sql`${column} like ${`%${term.replace(/[\\%_]/g, "\\$&")}%`} escape '\\'`;

const Query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
  status: ReportStatus.optional(),
  barangay: z.string().max(120).optional(),
  assigned_to: z.string().max(120).optional(),
  q: z.string().trim().max(80).optional(),
});

export async function GET(req: Request) {
  const blocked = deny(await getActor(), ["responder", "staff"]);
  if (blocked) return blocked;

  const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return Response.json({ error: "bad_query", issues: parsed.error.issues }, { status: 400 });
  const { page, per_page, status, barangay, assigned_to, q } = parsed.data;

  const search = q
    ? or(
        contains(reports.household_head, q),
        contains(reports.barangay, q),
        contains(reports.purok, q),
        contains(reports.code, q.toUpperCase()),
      )
    : undefined;
  const where = and(
    // Merged reports live on in the report they were merged into.
    status ? eq(reports.status, status) : ne(reports.status, "merged"),
    barangay ? eq(reports.barangay, barangay) : undefined,
    assigned_to ? eq(reports.assigned_to, assigned_to) : undefined,
    search,
  );

  const total = db.select({ n: sql<number>`count(*)` }).from(reports).where(where).get()?.n ?? 0;
  const rows = db
    .select()
    .from(reports)
    .where(where)
    // Urgent first, then whoever has waited longest.
    .orderBy(desc(urgentSql), asc(reports.created_at))
    .limit(per_page)
    .offset((page - 1) * per_page)
    .all();
  const items = rows.map((r) => ({ ...r, urgent: isUrgent(r) }));
  return Response.json({ items, total, page, per_page });
}
