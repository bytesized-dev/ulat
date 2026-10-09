import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AssessForm } from "@/components/responder/assess-form";
import { startFromReport } from "@/components/responder/entry-form";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { readActiveResponder, SESSION_COOKIE } from "@/lib/auth/session";
import { ReportCode, routes } from "@/lib/contracts";

export const dynamic = "force-dynamic";

type AssessPageProps = {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ code?: string; barangay?: string; purok?: string; head?: string }>;
};

// The entry does not exist until Confirm entry, so [entryId] is only an id for
// this visit. The house comes from ?code=, the family report it answers, or from
// ?barangay=, ?purok= and ?head= for a house with no report.
export default async function AssessPage({ searchParams }: AssessPageProps) {
  // The proxy only checks the cookie signature, so a responder who was switched
  // off is turned away here.
  const token = (await cookies()).get(SESSION_COOKIE.responder)?.value;
  if (!(await readActiveResponder(token))) redirect(routes.responder.signIn);

  const q = await searchParams;

  if (q.code) {
    const code = ReportCode.safeParse(q.code.toUpperCase());
    const report = code.success ? db.select().from(reports).where(eq(reports.code, code.data)).get() : undefined;
    if (!report) notFound();
    const { start, classFrom } = startFromReport(report);
    return (
      <AssessForm
        house={{ report_code: report.code, barangay: report.barangay, purok: report.purok, household_head: report.household_head }}
        start={start}
        classFrom={classFrom}
        reportHurt={report.hurt}
      />
    );
  }

  if (!q.barangay) notFound();
  return <AssessForm house={{ report_code: null, barangay: q.barangay, purok: q.purok ?? null, household_head: q.head ?? null }} />;
}
