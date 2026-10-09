import { db } from "@/db/client";
import { requireStaff } from "@/lib/auth/session";
import { buildEntriesCsv, loadEntryCsvRows } from "@/lib/hub/entries-csv";
import { dayKey } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirmed entries as a CSV download for MDRRMO staff. SPEC section 7 sets the columns. */
export async function GET() {
  const session = await requireStaff();
  if (session instanceof Response) return session;

  // The byte order mark makes Excel read names such as Niño as UTF-8.
  const body = `﻿${buildEntriesCsv(loadEntryCsvRows(db))}`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ulat-entries-${dayKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
