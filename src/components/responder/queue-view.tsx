"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { formatTime } from "@/lib/time";
import { browserStore, describeQueued, flushQueue, type QueuedEntry } from "./offline-queue";

const POLL_MS = 5000;

async function hubAnswers(): Promise<boolean> {
  try {
    return (await fetch("/api/health", { cache: "no-store" })).ok;
  } catch {
    return false;
  }
}

// Entries saved on this phone wait here. The page asks /api/health every few
// seconds and sends the queue as soon as the hub answers.
export function QueueView() {
  const [items, setItems] = useState<QueuedEntry[] | null>(null);
  const [inRange, setInRange] = useState(false);
  const [busy, setBusy] = useState(false);
  const flushing = useRef(false);

  const check = useCallback(async () => {
    const ok = await hubAnswers();
    setInRange(ok);
    if (ok && !flushing.current) {
      flushing.current = true;
      setBusy(true);
      try {
        await flushQueue();
      } finally {
        flushing.current = false;
        setBusy(false);
      }
    }
    setItems(await browserStore.all().catch(() => []));
  }, []);

  useEffect(() => {
    const first = setTimeout(check, 0);
    const timer = setInterval(check, POLL_MS);
    window.addEventListener("online", check);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", check);
    };
  }, [check]);

  const count = items?.length ?? 0;
  return (
    <>
      <header className="flex items-center justify-between px-gutter py-3">
        <span className="text-title-bar text-ink">Queue</span>
        <Pill dot={inRange ? "success" : "warning"}>{inRange ? "In range" : "Out of range"}</Pill>
      </header>
      <main className="flex-1 px-gutter pb-6 pt-2" aria-live="polite">
        <h1 className="text-title-page text-ink">{count === 0 ? "Nothing waiting" : `${count} waiting`}</h1>
        <p className="mt-1 text-body-md text-body">
          {count === 0 ? "Entries saved on this phone show here." : "They send when you're back in range."}
        </p>
        <div className="mt-4 flex flex-col">
          {items?.map((item) => (
            <div key={item.id} className="flex min-h-16 items-center gap-4 border-b border-hairline-soft py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-md font-medium text-ink">
                  {item.meta.household_head ?? "House with no report"}
                </span>
                <span className="text-body-sm text-body">{describeQueued(item)}</span>
              </span>
              <span className="font-mono text-mono-sm text-muted-text">{formatTime(item.saved_at)}</span>
            </div>
          ))}
        </div>
      </main>
      {count > 0 ? (
        <footer className="px-gutter pb-3 pt-3">
          <Button variant="secondary" className="w-full" disabled={busy} onClick={check}>
            <RefreshCwIcon aria-hidden="true" />
            Try again
          </Button>
        </footer>
      ) : null}
    </>
  );
}
