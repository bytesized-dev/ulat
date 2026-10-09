import type { Metadata } from "next";
import { HubPage } from "@/components/hub/hub-page";
import { ReviewDetail } from "@/components/hub/review/review-detail";
import { ReviewLive } from "@/components/hub/review/review-live";
import { ReviewRail } from "@/components/hub/review/review-rail";
import { ReviewTabs } from "@/components/hub/segment-links";
import { db } from "@/db/client";
import { routes } from "@/lib/contracts/routes";
import { countReview } from "@/lib/hub/family-reports";
import { listReviewEntries, listReviewPhotos } from "@/lib/hub/review";
import { SETTLED_PARAM } from "@/lib/hub/review-refresh";
import { requireStaffPage } from "@/lib/hub/staff-page";

export const metadata: Metadata = { title: "Review" };

// Reads the database on every request. ReviewLive asks for a fresh render when
// an entry needs review or is confirmed.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ReviewPage({ searchParams }: { searchParams: SearchParams }) {
  // The list names households and responders, so the page is staff only.
  await requireStaffPage();

  const params = await searchParams;
  const entries = listReviewEntries(db);
  const counts = countReview(db);

  // The entry in the link, and otherwise the first one. A link to an entry that
  // is no longer waiting, such as one settled in another tab, shows the first.
  const selected = entries.find((e) => e.id === params.entry) ?? entries[0] ?? null;

  return (
    <HubPage title="Review" active={routes.hub.review} rail={<ReviewRail entries={entries} selected={selected?.id ?? null} />}>
      <div className="flex flex-col gap-9">
        <ReviewTabs active="second_look" counts={counts} />
        {params[SETTLED_PARAM] === "1" ? (
          <p role="status" className="rounded-lg bg-surface-soft p-4 text-body-sm font-semibold text-ink">
            Already settled in another tab.
          </p>
        ) : null}
        {selected ? (
          <ReviewDetail key={selected.id} entry={selected} photos={listReviewPhotos(db, selected.id)} />
        ) : (
          <p className="py-8 text-body-md text-body">Nothing is waiting for a second look.</p>
        )}
      </div>
      <ReviewLive />
    </HubPage>
  );
}
