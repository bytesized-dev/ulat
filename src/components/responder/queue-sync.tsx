"use client";

import { useEffect } from "react";
import { startQueueSync } from "./use-queue-sync";

/**
 * Mounted once by the /r layout. It sends waiting entries from any responder
 * page, and keeps the Queue screen on the phone so it opens out of range.
 * The worker stores the Queue shell only, never a page that holds hub data.
 */
function QueueSync() {
  useEffect(() => startQueueSync(), []);

  useEffect(() => {
    // In development the worker would serve stale code, so it is for the built app only.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => registration.active?.postMessage({ type: "keep-queue-shell" }))
      .catch(() => {
        // The pages work without it. Only the Queue screen out of range is lost.
      });
  }, []);

  return null;
}

export { QueueSync };
