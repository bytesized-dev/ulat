import { ReportRail } from "@/components/hub/family-reports/report-rail";
import { ReportTable } from "@/components/hub/family-reports/report-table";
import { HubPage } from "@/components/hub/hub-page";
import { ReviewTabs, SegmentLinks } from "@/components/hub/segment-links";
import { LiveRefresh } from "@/components/responder/live-refresh";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts";
import {
  countFamilyReports,
  countReview,
  FAMILY_FILTERS,
  FILTER_LABELS,
  getFamilyReport,
  listFamilyReports,
  listResponders,
  parseFilter,
  type FamilyFilter,
} from "@/lib/hub/family-reports";

// Reads the reports on every request. LiveRefresh asks for a fresh render when
// a report is created or changes, from a phone or from another hub tab.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

const href = (show: FamilyFilter, code?: string) => {
  const query = new URLSearchParams();
  if (show !== "all") query.set("show", show);
  if (code) query.set("code", code);
  const qs = query.toString();
  return qs ? `${routes.hub.familyReports}?${qs}` : routes.hub.familyReports;
};

export default async function FamilyReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const show = parseFilter(params.show);

  const rows = listFamilyReports(db, show);
  const counts = countFamilyReports(db);
  const review = countReview(db);
  const responders = listResponders(db);

  // The rail shows the report in the link, even when the filter hides it, and
  // otherwise the first one in the list.
  const wanted = typeof params.code === "string" ? params.code.toUpperCase() : null;
  const selected =
    rows.find((r) => r.code === wanted) ??
    (wanted ? getFamilyReport(db, wanted) : undefined) ??
    rows[0] ??
    null;

  return (
    <HubPage
      title="Family reports"
      active={routes.hub.review}
      rail={<ReportRail report={selected} responders={responders} />}
    >
      <div className="flex flex-col gap-9">
        <ReviewTabs active="family_reports" counts={review} className="self-stretch" />
        <SegmentLinks
          aria-label="Filter"
          className="self-start"
          links={FAMILY_FILTERS.map((f) => ({
            label: FILTER_LABELS[f],
            href: href(f, selected?.code),
            count: counts[f],
            current: f === show,
          }))}
        />
        <ReportTable rows={rows} selected={selected?.code ?? null} hrefFor={(code) => href(show, code)} />
      </div>
      <LiveRefresh />
    </HubPage>
  );
}
