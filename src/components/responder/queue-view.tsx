"use client";

import Link from "next/link";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { routes } from "@/lib/contracts";
import { formatTime } from "@/lib/time";
import { browserStore, describeQueued, type QueuedEntry } from "./offline-queue";
import { refreshQueue, useQueueSync } from "./use-queue-sync";

async function dismiss(id: string) {
  await browserStore.remove(id).catch(() => undefined);
  await refreshQueue();
}

function QueueRow({ item }: { item: QueuedEntry }) {
  return (
    <div className="flex flex-col border-b border-hairline-soft py-2">
      <div className="flex min-h-12 items-center gap-4">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body-md font-medium text-ink">{item.meta.household_head ?? "House with no report"}</span>
          <span className="text-body-sm text-body">{describeQueued(item)}</span>
        </span>
        <span className="font-mono text-mono-sm text-muted-text">{formatTime(item.saved_at)}</span>
      </div>
      {item.failure ? (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-body-sm text-danger">{item.failure.message}</p>
          <Button type="button" variant="tertiary" size="hub" aria-label={`Dismiss ${item.meta.household_head ?? "house with no report"}`} onClick={() => void dismiss(item.id)}>
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Entries saved on this phone wait here. The /r layout asks /api/health every few
// seconds and sends the queue as soon as the hub answers, from any page. This
// screen shows what is left and what the hub refused.
export function QueueView() {
  const { items, inRange, busy, signedOut, retry } = useQueueSync();
  const waiting = items?.filter((item) => !item.failure).length ?? 0;
  const failed = (items?.length ?? 0) - waiting;

  return (
    <>
      <header className="flex items-center justify-between px-gutter py-3">
        <span className="text-title-bar text-ink">Queue</span>
        <Pill dot={inRange ? "success" : "warning"}>{inRange ? "In range" : "Out of range"}</Pill>
      </header>
      <main className="flex-1 px-gutter pb-6 pt-2" aria-live="polite">
        <h1 className="text-title-page text-ink">{waiting > 0 ? `${waiting} waiting` : failed > 0 ? `${failed} not sent` : "Nothing waiting"}</h1>
        <p className="mt-1 text-body-md text-body">
          {signedOut && waiting > 0 ? (
            <>
              Your session ended.{" "}
              <Link href={routes.responder.signIn} className="font-medium text-primary underline">
                Sign in again
              </Link>{" "}
              to send.
            </>
          ) : waiting > 0 ? (
            "They send when you're back in range."
          ) : failed > 0 ? (
            "The hub did not take these. Read why, then dismiss them."
          ) : (
            "Entries saved on this phone show here."
          )}
        </p>
        <div className="mt-4 flex flex-col">
          {items?.map((item) => (
            <QueueRow key={item.id} item={item} />
          ))}
        </div>
      </main>
      {waiting > 0 ? (
        <footer className="px-gutter pb-3 pt-3">
          <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void retry()}>
            <RefreshCwIcon aria-hidden="true" />
            Try again
          </Button>
        </footer>
      ) : null}
    </>
  );
}
