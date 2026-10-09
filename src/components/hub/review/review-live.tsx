"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { changesReview } from "@/lib/hub/review-refresh";
import { useLiveEvents } from "@/lib/live/use-live-events";

// Asks the server for a fresh list when an entry needs review or is confirmed,
// here or on a phone, and again when the stream comes back, because the stream
// does not replay what was missed.
function ReviewLive() {
  const router = useRouter();
  const { latest, connected } = useLiveEvents();
  const connectedBefore = useRef(false);

  useEffect(() => {
    if (changesReview(latest)) router.refresh();
  }, [latest, router]);

  useEffect(() => {
    if (!connected) return;
    // The first connect is covered by the page load itself.
    if (connectedBefore.current) router.refresh();
    connectedBefore.current = true;
  }, [connected, router]);

  return null;
}

export { ReviewLive };
