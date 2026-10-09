import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CheckView } from "@/components/responder/check-view";
import { db } from "@/db/client";
import { entries, events, photos, reports } from "@/db/schema";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function CheckPage({ params }: { params: Promise<{ entryId: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  if (!(await readActiveResponder(token))) redirect(routes.responder.signIn);
  const { entryId } = await params;

  const entry = db.select().from(entries).where(eq(entries.id, entryId)).get();
  if (!entry) notFound();
  if (entry.status === "confirmed") redirect(routes.responder.confirmed(entryId));
  // The photo draft has not landed yet.
  if (entry.ai_class === null) redirect(routes.responder.drafting(entryId));

  const report = entry.report_id ? db.select().from(reports).where(eq(reports.id, entry.report_id)).get() : undefined;
  const entryPhotos = db.select().from(photos).where(eq(photos.entry_id, entryId)).orderBy(asc(photos.taken_at)).all();
  const hasNewPhoto =
    db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.entity_id, entryId), eq(events.type, "entry.photo_added")))
      .limit(1)
      .get() !== undefined;

  const house = {
    report_code: report?.code ?? null,
    barangay: entry.barangay,
    purok: entry.purok,
    household_head: entry.household_head,
  };

  return (
    <CheckView
      // A new photo changes the draft, so the form starts over from the new draft.
      key={`${entryPhotos.length}-${entry.ai_class}-${entry.ai_need_more ?? ""}`}
      entryId={entryId}
      title={report?.code ?? String(entry.number).padStart(4, "0")}
      house={house}
      entry={{
        damage_class: entry.damage_class,
        material: entry.material,
        hazards: entry.hazards,
        families: entry.families,
        people: entry.people,
        hurt: entry.hurt,
        missing: entry.missing,
        needs: entry.needs,
      }}
      ai={{ damage_class: entry.ai_class, confidence: entry.ai_confidence, reason: entry.ai_reason, need_more: entry.ai_need_more }}
      photos={entryPhotos.map((p) => ({ id: p.id, label: p.label }))}
      reportHurt={report?.hurt ?? null}
      hasNewPhoto={hasNewPhoto}
    />
  );
}
