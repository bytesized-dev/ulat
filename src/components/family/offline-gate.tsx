"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/contracts";
import { QUEUE_EVENT } from "./offline-queue";
import { SavedOnPhone } from "./saved-on-phone";
import { useOfflineQueue } from "./use-offline-queue";

/** Registers the service worker that keeps the app shell for a phone that loses the hub. */
function useServiceWorker() {
  useEffect(() => {
    // In development the worker would serve stale code, so it is for the built app only.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The page works without it. Only the offline start is lost.
    });
  }, []);
}

// Wraps every page. When reports are waiting and the hub cannot be reached, the
// saved screen covers whatever route the family is on. Home puts it away until
// the next report is saved. When the hub comes back and the reports go out, a
// family looking at the screen is taken to the report sent screen.
function OfflineGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { items, waiting, reachable, busy, sent, retry } = useOfflineQueue();
  const [dismissed, setDismissed] = useState(false);
  useServiceWorker();

  useEffect(() => {
    const show = () => setDismissed(false);
    window.addEventListener(QUEUE_EVENT, show);
    return () => window.removeEventListener(QUEUE_EVENT, show);
  }, []);

  const visible = waiting && !reachable && !dismissed;

  // Only a family still looking at the saved screen is moved on to the sent screen.
  const watching = useRef(false);
  useEffect(() => {
    if (visible) watching.current = true;
    else if (sent && watching.current) {
      watching.current = false;
      router.replace(routes.family.sent);
    }
  }, [visible, sent, router]);

  return (
    <>
      <div inert={visible}>{children}</div>
      {visible ? (
        <div role="region" aria-label="Saved on this phone" className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
          <SavedOnPhone
            items={items}
            busy={busy}
            onRetry={() => void retry()}
            onHome={() => {
              watching.current = false;
              setDismissed(true);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

export { OfflineGate };
