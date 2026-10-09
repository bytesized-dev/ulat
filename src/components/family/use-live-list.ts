"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HubEvent } from "@/lib/contracts";
import { useLiveEvents } from "@/lib/live/use-live-events";

/**
 * A list read from the hub. It loads on mount, again for each event of `eventType`,
 * and again when the stream comes back, since the stream does not replay what it
 * missed. A failed request leaves the list as it was.
 */
export function useLiveList<T>(url: string, parse: (body: unknown) => T[], eventType: Extract<HubEvent["type"], "update.posted" | "place.saved">) {
  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [eventKey, setEventKey] = useState<string | null>(null);
  const { latest, connected } = useLiveEvents();

  // Other events change `latest` too, and they must not cause a refetch.
  if (latest?.type === eventType) {
    const key = JSON.stringify(latest);
    if (key !== eventKey) setEventKey(key);
  }

  const parseRef = useRef(parse);
  useEffect(() => {
    parseRef.current = parse;
  });

  const load = useCallback(
    (signal: AbortSignal) => {
      fetch(url, { signal })
        .then((response) => {
          if (!response.ok) throw new Error(`GET ${url} ${response.status}`);
          return response.json();
        })
        .then((body) => {
          setItems(parseRef.current(body));
          setLoaded(true);
        })
        .catch(() => {});
    },
    [url],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, eventKey]);

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

  return { items, loaded };
}
