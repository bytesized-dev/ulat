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
import { findVoice, voiceLinked } from "./_lib/voice-store";
import { isUrgent, urgentSql } from "./_lib/view";

// POST takes a NewReport from a family phone or the help desk and returns the
// code. GET lists reports for responders and staff, urgent first.
//
// A voice_id names a recording the phone sent to POST /api/reports/voice. It
// becomes the report's voice_path when the file exists and no other report has
// it. Otherwise the report is saved without audio and the audit row says why:
// a disaster report must not be lost over an attachment, and answering the same
// 201 either way gives nobody a way to test which voice_ids exist.

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

  const stored = body.voice_id ? await findVoice(body.voice_id) : null;
  const id = randomUUID();
  const now = new Date().toISOString();
  const urgent = isUrgent(body);
  const { code, created, attached } = db.transaction((tx) => {
    const fresh = freshCode(tx);
    // Checked in the same transaction as the insert, so two reports cannot take one recording.
    const voice = !body.voice_id
      ? null
      : !stored
        ? ("unknown" as const)
        : tx.select({ id: reports.id }).from(reports).where(eq(reports.voice_path, stored)).get()
          ? ("used" as const)
          : ("attached" as const);
    // A phone sends the same client_id again after a lost reply. The unique
    // index decides, so two parallel requests cannot both insert.
    const inserted = tx
      .insert(reports)
      .values({
        id,
        code: fresh,
        client_id: body.client_id,
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
        voice_path: voice === "attached" ? stored : null,
        transcript: body.transcript,
        transcript_en: body.english,
        language: body.language,
        status: "waiting",
        created_at: now,
        updated_at: now,
      })
      .onConflictDoNothing({ target: reports.client_id })
      .run();
    if (inserted.changes === 0 && body.client_id) {
      const existing = tx.select({ code: reports.code }).from(reports).where(eq(reports.client_id, body.client_id)).get();
      if (existing) return { code: existing.code, created: false, attached: false };
    }
    audit(tx, id, "report.created", actor, {
      code: fresh,
      source: body.source,
      urgent,
      voice_id: body.voice_id,
      ...(voice ? { voice } : {}),
    });
    return { code: fresh, created: true, attached: voice === "attached" };
  });

  if (created) emit({ type: "report.created", code, urgent });
  // The recording no longer counts as unlinked, so it stops using the unlinked cap.
  if (attached && stored) await voiceLinked(stored);
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
