"use client";

import { useEffect, useState } from "react";
import { MegaphoneIcon } from "lucide-react";
import { Row } from "@/components/ui/row";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/lib/contracts/routes";
import { useLiveEvents } from "@/lib/live/use-live-events";
import { formatTime } from "@/lib/time";
import { latestUpdate, type UpdateSummary } from "./latest-update";

type Load = { status: "loading" } | { status: "done"; update: UpdateSummary | null };

// The newest update from the hub. No row at all when there is none, or when the
// hub cannot be reached, so the rest of the home screen stays usable.
export function HomeUpdate() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const { latest, connected } = useLiveEvents();
  const refetchKey = `${connected}:${latest?.type === "update.posted" ? latest.update_id : ""}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/updates", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => setLoad({ status: "done", update: latestUpdate(body) }))
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "done", update: null });
      });
    return () => controller.abort();
  }, [refetchKey]);

  if (load.status === "loading") return <Skeleton aria-hidden="true" className="h-16 w-full" />;
  if (!load.update) return null;

  return (
    <Row
      href={routes.family.updates}
      icon={
        <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary">
          <MegaphoneIcon />
        </span>
      }
      className="border-b-0"
      label={`Update, ${formatTime(load.update.posted_at)}`}
      value={load.update.headline}
    />
  );
}
