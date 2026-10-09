"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLiveEvents } from "@/lib/live/use-live-events";

// Asks the server for fresh data when a report is created or changes, and again
// when the stream comes back, because the stream does not replay what was missed.
function LiveRefresh() {
  const router = useRouter();
  const { latest, connected } = useLiveEvents();
  const connectedBefore = useRef(false);

  useEffect(() => {
    if (latest && (latest.type === "report.created" || latest.type === "report.updated")) router.refresh();
  }, [latest, router]);

  useEffect(() => {
    if (!connected) return;
    // The first connect is covered by the page load itself.
    if (connectedBefore.current) router.refresh();
    connectedBefore.current = true;
  }, [connected, router]);

  return null;
}

export { LiveRefresh };
