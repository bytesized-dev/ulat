import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { ReportCode } from "@/lib/contracts";
import { statusView } from "../_lib/view";

// A family looks up its own report by code. The code is the only key, and the
// answer is the minimal ReportStatusView.

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const code = ReportCode.safeParse(raw.trim().toUpperCase());
  if (!code.success) return Response.json({ error: "bad_code" }, { status: 400 });

  const report = db.select().from(reports).where(eq(reports.code, code.data)).get();
  if (!report) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(statusView(db, report));
}
