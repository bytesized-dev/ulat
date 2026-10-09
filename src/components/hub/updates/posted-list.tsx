"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/time";
import { useLiveEvents } from "@/lib/live/use-live-events";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { updateTypePill } from "./labels";

export type PostedItem = {
  id: string;
  type: keyof typeof updateTypePill;
  headline: string;
  posted_at: string;
  seen_count: number;
};

// The rail on /hub/updates. The page reads the list on the server. A live
// event for a new update, or a stream that comes back after a drop, asks the
// server for the list again, since the stream does not replay what was missed.
export function PostedList({ items }: { items: PostedItem[] }) {
  const router = useRouter();
  const { latest, connected } = useLiveEvents();

  React.useEffect(() => {
    if (latest?.type === "update.posted") router.refresh();
  }, [latest, router]);

  const wasConnected = React.useRef(connected);
  React.useEffect(() => {
    if (connected && !wasConnected.current) router.refresh();
    wasConnected.current = connected;
  }, [connected, router]);

  return (
    <section aria-labelledby="posted-heading" className="flex flex-col">
      <div className="flex items-baseline justify-between pb-6">
        <h2 id="posted-heading" className="text-title-md">
          Posted
        </h2>
        <span className="font-mono text-mono-xs text-muted-text">{items.length}</span>
      </div>
      <ul className="flex flex-col">
        {items.map((item) => {
          const pill = updateTypePill[item.type];
          return (
            <li key={item.id} className="flex flex-col gap-2 border-t border-hairline py-4">
              <div className="flex items-center justify-between gap-2">
                <Pill>
                  <StatusDot tone={pill.dot} className={pill.dot ? undefined : "bg-ink"} />
                  {pill.label}
                </Pill>
                <time dateTime={item.posted_at} className="font-mono text-mono-xs text-muted-text">
                  {formatTime(item.posted_at)}
                </time>
              </div>
              <p className="text-body-md font-semibold">{item.headline}</p>
              <p className="text-body-sm text-muted-text">
                Seen on <span className="font-mono">{item.seen_count}</span> phones
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
