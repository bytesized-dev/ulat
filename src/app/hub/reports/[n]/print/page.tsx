import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintControls } from "@/components/hub/print/print-controls";
import { PrintFrame } from "@/components/hub/print/print-sheet";
import { SitrepSheet } from "@/components/hub/print/sitrep-sheet";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts/routes";
import { getPrintReport } from "@/lib/hub/print";
import { requireStaffPage } from "@/lib/hub/staff-page";

export const metadata: Metadata = { title: "Situation report" };

// The report is saved once, but the hazards and the town are read on every request.
export const dynamic = "force-dynamic";

// The numbered situation report on one A4 page, with no hub chrome. An unknown
// or malformed number is a 404.
export default async function PrintReportPage({ params }: { params: Promise<{ n: string }> }) {
  await requireStaffPage();
  const { n } = await params;
  const report = getPrintReport(db, n);
  if (!report) notFound();

  return (
    <PrintFrame controls={<PrintControls backHref={routes.hub.reports} />}>
      <SitrepSheet report={report} />
    </PrintFrame>
  );
}
