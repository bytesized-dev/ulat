"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HubEvent, ReportStatusView } from "@/lib/contracts";
import { useLiveEvents } from "@/lib/live/use-live-events";
import { changesReport, fetchStatus } from "./status-view";

type Loaded = { code: string; view: ReportStatusView | null; message: string | null };

export type ReportStatus = {
  /** The report for `code`, or null while loading and after a failed first look. */
  view: ReportStatusView | null;
  /** What to tell the family when the last look failed. */
  message: string | null;
  /** Ask the hub again, for the Check button. */
  refresh: () => void;
};

// Looks a report up by code and keeps it current. The stream is scoped to the
// code, so only this report's events arrive. Each one makes a refetch, and so
// does the stream coming back, because it does not replay what it missed.
// A failed refetch keeps the last view, so a flaky hub never blanks the screen.
export function useReportStatus(code: string | null): ReportStatus {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [seen, setSeen] = useState<HubEvent | null>(null);
  const [tick, setTick] = useState(0);
  const { latest, connected } = useLiveEvents({ code });

  // Remember the last event about this report. Other events change `latest`
  // too, and they must not cause a refetch.
  if (code && latest && latest !== seen && changesReport(latest, code)) setSeen(latest);

  const load = useCallback(
    (signal: AbortSignal) => {
      if (!code) return;
      fetchStatus(code, fetch, signal).then((result) => {
        if (signal.aborted) return;
        setLoaded((was) => {
          if (result.ok) return { code, view: result.view, message: null };
          // Keep what is on screen for this code. A new code has nothing yet.
          return { code, view: was?.code === code ? was.view : null, message: result.message };
        });
      });
    },
    [code],
  );

  // On a new code, on each event for it and when Check is pressed.
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, seen, tick]);

  // Its first open is not a reconnect, the lookup above already ran.
  const wasLive = useRef(false);
  const missed = useRef(false);
  useEffect(() => {
    if (!connected) {
      if (wasLive.current) missed.current = true;
      return;
    }
    wasLive.current = true;
    if (!missed.current) return;
    missed.current = false;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [connected, load]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const current = loaded && loaded.code === code ? loaded : null;
  return { view: current?.view ?? null, message: current?.message ?? null, refresh };
}
