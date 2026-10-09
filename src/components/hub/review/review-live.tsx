"use client";

import { useRouter } from "next/navigation";
import { useLiveRefresh } from "@/components/hub/use-live-refresh";
import { changesReview } from "@/lib/hub/review-refresh";

// Asks the server for a fresh list when an entry needs review or is confirmed,
// here or on a phone. The hook also refetches when the stream comes back.
function ReviewLive() {
  const router = useRouter();
  useLiveRefresh(changesReview, () => router.refresh());
  return null;
}

export { ReviewLive };
