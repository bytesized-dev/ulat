import type { Metadata } from "next";
import { DuplicateActions } from "@/components/hub/duplicates/duplicate-actions";
import { DuplicateCompare } from "@/components/hub/duplicates/duplicate-compare";
import { DuplicateRail } from "@/components/hub/duplicates/duplicate-rail";
import { HubPage } from "@/components/hub/hub-page";
import { ReviewTabs } from "@/components/hub/segment-links";
import { LiveRefresh } from "@/components/responder/live-refresh";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts/routes";
import { detectDuplicates, listOpenDuplicates } from "@/lib/hub/duplicates";
import { countReview } from "@/lib/hub/family-reports";
import { getMapBbox } from "@/lib/hub/map-pins";
import { requireStaffPage } from "@/lib/hub/staff-page";

export const metadata: Metadata = { title: "Possible duplicates" };

// Reads the pairs on every request. LiveRefresh asks for a fresh render when a
// report is created or changes, from a phone or from another hub tab.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function PossibleDuplicatesPage({ searchParams }: { searchParams: SearchParams }) {
  // Households and locations are staff only.
  await requireStaffPage();

  // Looks for pairs that came in since the last look. Running it again adds nothing.
  detectDuplicates(db);

  const params = await searchParams;
  const pairs = listOpenDuplicates(db);
  const wanted = typeof params.pair === "string" ? params.pair : null;
  const selected = pairs.find((p) => p.id === wanted) ?? pairs[0] ?? null;
  const review = countReview(db);

  return (
    <HubPage title="Possible duplicates" active={routes.hub.review} rail={<DuplicateRail pairs={pairs} selected={selected?.id ?? null} />}>
      <div className="flex flex-col gap-9">
        <ReviewTabs active="duplicates" counts={review} className="self-stretch" />
        {selected ? (
          <>
            <DuplicateCompare pair={selected} bbox={getMapBbox(db)} />
            <DuplicateActions
              key={selected.id}
              pairId={selected.id}
              mergeInto={selected.mergeable ? selected.a.label : null}
              later={selected.b.label}
            />
          </>
        ) : (
          <p className="py-8 text-body-md text-body">No possible duplicates.</p>
        )}
      </div>
      <LiveRefresh />
    </HubPage>
  );
}
