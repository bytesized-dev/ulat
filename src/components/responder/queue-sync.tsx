"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/contracts";
import { startQueueSync } from "./use-queue-sync";

/**
 * Mounted once by the /r layout. It sends waiting entries from any responder
 * page, and keeps the Queue screen on the phone so it opens out of range.
 * The worker stores the Queue shell only, never a page that holds hub data.
 */
function QueueSync() {
  // Nothing posts from the sign in screen: the phone is signed out there, so every try would be a 401.
  // Leaving it, after a sign in, starts the sync fresh.
  const signingIn = usePathname() === routes.responder.signIn;
  useEffect(() => (signingIn ? undefined : startQueueSync()), [signingIn]);

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
