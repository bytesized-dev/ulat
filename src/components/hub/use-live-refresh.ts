"use client";

import { useEffect, useRef } from "react";
import type { HubEvent } from "@/lib/contracts";
import { debounce } from "@/lib/hub/live-refresh";
import { useLiveEvents } from "@/lib/live/use-live-events";

/**
 * Calls `refresh` once after a burst of live events that `matters`, and again
 * when the stream comes back, because it does not replay what was missed.
 * The first connect is covered by the page load itself. Render it once per page.
 */
export function useLiveRefresh(matters: (event: HubEvent | null) => boolean, refresh: () => void, ms = 300) {
  const { latest, connected } = useLiveEvents();
  const connectedBefore = useRef(false);
  const run = useRef(refresh);
  const pending = useRef<ReturnType<typeof debounce> | null>(null);

  useEffect(() => {
    run.current = refresh;
  });

  useEffect(() => {
    const d = debounce(() => run.current(), ms);
    pending.current = d;
    return () => d.cancel();
  }, [ms]);

  useEffect(() => {
    if (matters(latest)) pending.current?.call();
    // `matters` is a pure function of the event, so only a new event matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest]);

  useEffect(() => {
    if (!connected) return;
    if (connectedBefore.current) pending.current?.call();
    connectedBefore.current = true;
  }, [connected]);
}
