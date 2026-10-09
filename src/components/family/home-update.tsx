"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MegaphoneIcon } from "lucide-react";
import { Row } from "@/components/ui/row";
import { routes } from "@/lib/contracts/routes";
import { useLiveEvents } from "@/lib/live/use-live-events";
import { formatTime } from "@/lib/time";
import { latestUpdate, type UpdateSummary } from "./latest-update";

// The newest update from the hub. Nothing is drawn until the hub answers, and
// nothing at all when there is no update or the hub cannot be reached, so the
// rest of the home screen never shifts or breaks because of this row.
export function HomeUpdate() {
  const [update, setUpdate] = useState<UpdateSummary | null>(null);
  const [postedId, setPostedId] = useState<string | null>(null);
  const { latest, connected } = useLiveEvents();

  // Remember the last update.posted. Other events change `latest` too, and they
  // must not cause a refetch.
  if (latest?.type === "update.posted" && latest.update_id !== postedId) setPostedId(latest.update_id);

  // A failed request leaves the row as it was: hidden at first, or showing the
  // last update we know about.
  const load = useCallback((signal: AbortSignal) => {
    fetch("/api/updates", { signal })
      .then((response) => {
        if (!response.ok) throw new Error(`GET /api/updates ${response.status}`);
        return response.json();
      })
      .then((body) => setUpdate(latestUpdate(body)))
      .catch(() => {});
  }, []);

  // On mount, and again for each update.posted.
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, postedId]);

  // The stream does not replay what it missed while it was down, so ask again
  // when it comes back. Its first open is not a reconnect, mount already loaded.
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

  if (!update) return null;

  return (
    <Row
      href={routes.family.updates}
      icon={
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MegaphoneIcon />
        </span>
      }
      className="border-b-0"
      label={`Update, ${formatTime(update.posted_at)}`}
      value={update.headline}
    />
  );
}
