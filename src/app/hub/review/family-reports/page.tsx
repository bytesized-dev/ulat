import { hubNav } from "@/components/hub/hub-nav";
import { ReportRail } from "@/components/hub/family-reports/report-rail";
import { ReportTable } from "@/components/hub/family-reports/report-table";
import { SegmentLinks } from "@/components/hub/segment-links";
import { LiveRefresh } from "@/components/responder/live-refresh";
import { HubShell } from "@/components/ui/hub-shell";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts";
import {
  countFamilyReports,
  countReview,
  FAMILY_FILTERS,
  FILTER_LABELS,
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
    (wanted ? listFamilyReports(db).find((r) => r.code === wanted) : undefined) ??
    rows[0] ??
    null;

  return (
    <HubShell
      title="Family reports"
      nav={hubNav(review.second_look + review.duplicates)}
      activeHref={routes.hub.review}
      name="MDRRMO staff"
      initials="MD"
      rail={<ReportRail report={selected} responders={responders} />}
    >
      <div className="flex flex-col gap-9">
        <SegmentLinks
          aria-label="Review lists"
          className="self-stretch"
          links={[
            { label: "Second look", href: routes.hub.review, count: review.second_look, current: false },
            { label: "Duplicates", href: routes.hub.duplicates, count: review.duplicates, current: false },
            { label: "Family reports", href: routes.hub.familyReports, count: review.family_reports, current: true },
          ]}
        />
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
    </HubShell>
  );
}
