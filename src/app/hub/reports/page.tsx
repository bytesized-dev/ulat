import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { db } from "@/db/client";
import { CreateReportButton } from "@/components/hub/reports/create-report-button";
import { EarlierList } from "@/components/hub/reports/earlier-list";
import { ReportCard } from "@/components/hub/reports/report-card";
import { SmsPanel } from "@/components/hub/reports/sms-panel";
import { HubPage } from "@/components/hub/hub-page";
import { buttonVariants } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { routes } from "@/lib/contracts/routes";
import { getReviewCount } from "@/lib/hub/review-count";
import { getLatestSitrep, listEarlierSitreps, readTown } from "@/lib/hub/sitreps";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

// The report list and the review count change on every request.
export const dynamic = "force-dynamic";

export default function HubReportsPage() {
  const latest = getLatestSitrep(db);
  const inReview = getReviewCount();

  const rail = latest ? (
    <div className="flex flex-col gap-9">
      {/* Keyed by number so a new report starts with its own text, not the edited one. */}
      <SmsPanel key={latest.number} sms={latest.sms} />
      <EarlierList items={listEarlierSitreps(db, latest.number)} />
    </div>
  ) : undefined;

  return (
    <HubPage title="Reports" active={routes.hub.reports} rail={rail}>
      <div className="flex flex-col gap-9">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Pill dot="warning">{`${inReview} in review, not counted`}</Pill>
            <Link href={routes.hub.review} className="hit text-body-sm font-semibold text-primary">
              Review
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <a href="/api/export/entries.csv" download className={cn(buttonVariants({ variant: "secondary", size: "hub" }))}>
              <DownloadIcon aria-hidden="true" />
              CSV
            </a>
            <CreateReportButton />
          </div>
        </div>

        {latest ? (
          <ReportCard number={latest.number} createdAt={latest.created_at} town={readTown(db)} snapshot={latest.snapshot} />
        ) : (
          <p className="text-body-md text-body">No situation report yet. Create the first one from the confirmed entries.</p>
        )}
      </div>
    </HubPage>
  );
}
