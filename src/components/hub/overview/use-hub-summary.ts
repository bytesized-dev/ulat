"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { HubSummary } from "@/lib/contracts";
import { changesOverview, debounce, newerSummary } from "@/lib/hub/live-refresh";
import { useLiveEvents } from "@/lib/live/use-live-events";

// One summary per tab, shared by the main column and the rail, which sit in
// different parts of the hub shell. The page renders with the summary it read
// on the server; OverviewLive replaces it from GET /api/hub/summary when an
// entry or report event arrives, and whichever is newer by as_of wins.

let current: HubSummary | null = null;
const listeners = new Set<() => void>();

function publish(next: HubSummary) {
  current = newerSummary(current, next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The freshest summary this tab has seen, starting from the one the server rendered. */
export function useHubSummary(initial: HubSummary): HubSummary {
  return useSyncExternalStore(
    subscribe,
    () => newerSummary(current, initial),
    () => initial,
  );
}

async function fetchSummary(): Promise<HubSummary | null> {
  try {
    const response = await fetch("/api/hub/summary", { cache: "no-store" });
    if (!response.ok) return null;
    const parsed = HubSummary.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Listens for entry and report events and refreshes the overview without a
 * reload: the totals from GET /api/hub/summary, and Latest through a server
 * refresh. Also refreshes when the stream comes back, because it does not
 * replay what was missed. Render it once per page.
 */
export function OverviewLive() {
  const router = useRouter();
  const { latest, connected } = useLiveEvents();
  const connectedBefore = useRef(false);
  const refresh = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    const d = debounce(() => {
      void fetchSummary().then((summary) => summary && publish(summary));
      router.refresh();
    }, 300);
    refresh.current = d;
    return () => d.cancel();
  }, [router]);

  useEffect(() => {
    if (changesOverview(latest)) refresh.current?.call();
  }, [latest]);

  useEffect(() => {
    if (!connected) return;
    // The first connect is covered by the page load itself.
    if (connectedBefore.current) refresh.current?.call();
    connectedBefore.current = true;
  }, [connected]);

  return null;
}
