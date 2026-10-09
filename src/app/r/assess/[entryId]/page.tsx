import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AssessForm } from "@/components/responder/assess-form";
import { db } from "@/db/client";
import { reports } from "@/db/schema";
import { ReportCode } from "@/lib/contracts";

export const dynamic = "force-dynamic";

type AssessPageProps = {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ code?: string; barangay?: string; purok?: string; head?: string }>;
};

// The entry does not exist until Send, so [entryId] is only a draft id for this
// capture. The house comes from ?code=, the family report it answers, or from
// ?barangay=, ?purok= and ?head= for a house with no report.
export default async function AssessPage({ searchParams }: AssessPageProps) {
  const q = await searchParams;

  if (q.code) {
    const code = ReportCode.safeParse(q.code.toUpperCase());
    const report = code.success ? db.select().from(reports).where(eq(reports.code, code.data)).get() : undefined;
    if (!report) notFound();
    return (
      <AssessForm
        house={{ report_code: report.code, barangay: report.barangay, purok: report.purok, household_head: report.household_head }}
      />
    );
  }

  if (!q.barangay) notFound();
  return <AssessForm house={{ report_code: null, barangay: q.barangay, purok: q.purok ?? null, household_head: q.head ?? null }} />;
}
