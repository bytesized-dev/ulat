"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/contracts";
import { QUEUE_EVENT, type QueuedReport } from "./offline-queue";
import { queueStore } from "./queue-db";
import { draftFromReport, saveDraft } from "./report-draft";
import { setVoiceAudio } from "./voice-audio";
import { SavedOnPhone } from "./saved-on-phone";
import { refreshQueue, useOfflineQueue } from "./use-offline-queue";

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

// Wraps the family pages only. /hub and /r share this origin and its IndexedDB
// but must never show a family's saved reports. When reports are waiting and
// the hub cannot be reached, or the hub refused one, the saved screen covers
// whatever family route the phone is on. Home puts it away until the next
// report is saved. A family that saved a report here is taken to the report
// sent screen once the hub takes it, whether or not the saved screen showed.
function OfflineGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { items, waiting, refused, reachable, busy, sent, retry } = useOfflineQueue();
  const [dismissed, setDismissed] = useState(false);
  useServiceWorker();

  // True from the moment this page saves a report until the sent screen takes over or the family leaves.
  const expecting = useRef(false);
  useEffect(() => {
    const saved = () => {
      expecting.current = true;
      setDismissed(false);
    };
    window.addEventListener(QUEUE_EVENT, saved);
    return () => window.removeEventListener(QUEUE_EVENT, saved);
  }, []);

  // A refused report stays on screen even though the hub answers, so the family can fix it.
  const visible = (refused || (waiting && !reachable)) && !dismissed;

  // Only a report sent after this page started looking counts, never an earlier one.
  const handled = useRef(sent);
  useEffect(() => {
    if (sent === handled.current) return;
    handled.current = sent;
    if (sent && expecting.current) {
      expecting.current = false;
      router.replace(routes.family.sent);
    }
  }, [sent, router]);

  async function fix(item: QueuedReport) {
    // The draft holds the report again, then the queue lets go of it, so it cannot be lost between the two.
    saveDraft(draftFromReport(item.report));
    // The recording comes back with it, so the send screen can upload it again.
    setVoiceAudio(item.attachments.find((a) => a.kind === "audio")?.blob ?? null);
    try {
      await queueStore().remove(item.id);
    } catch {
      // The report is in the draft. A copy left in the queue shows again on the next visit.
    }
    expecting.current = false;
    await refreshQueue();
    router.push(routes.family.check);
  }

  return (
    <>
      <div inert={visible}>{children}</div>
      {visible ? (
        <div role="region" aria-label="Saved on this phone" className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
          <SavedOnPhone
            items={items}
            busy={busy}
            onRetry={() => void retry()}
            onFix={(item) => void fix(item)}
            onHome={() => {
              expecting.current = false;
              setDismissed(true);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

export { OfflineGate };
