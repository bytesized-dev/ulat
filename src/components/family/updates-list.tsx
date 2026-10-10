"use client";

import { Pill } from "@/components/ui/pill";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { formatTime } from "@/lib/time";
import { UPDATE_PILL, parseUpdates } from "./updates";
import { useLiveList } from "./use-live-list";
import { FamilyScreen } from "./family-screen";

/** The Pill dot comes in a few tones, and the hazard dot is ink, so it is drawn here. */
export function UpdateKindPill({ kind }: { kind: keyof typeof UPDATE_PILL }) {
  const { label, dot } = UPDATE_PILL[kind];
  return (
    <Pill dot={dot === "ink" ? undefined : dot}>
      {dot === "ink" ? <span aria-hidden="true" className="inline-block size-1.75 shrink-0 rounded-full bg-ink" /> : null}
      {label}
    </Pill>
  );
}

// Active updates from MDRRMO, newest first. Refetched on update.posted.
export function UpdatesList() {
  const { items, loaded } = useLiveList("/api/updates", parseUpdates, "update.posted");

  return (
    <FamilyScreen>
      <TopBar title="Updates" leading={{ kind: "back", href: routes.family.home }} />
      <main className="flex flex-1 flex-col px-gutter pt-3 pb-7">
        {items.length > 0 ? (
          <ul>
            {items.map((update) => (
              <li key={update.id} className="flex flex-col gap-1.5 border-b border-hairline-soft py-4 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <UpdateKindPill kind={update.type} />
                  <time dateTime={update.posted_at} className="font-mono text-mono-sm text-body">
                    {formatTime(update.posted_at)}
                  </time>
                </div>
                <p className="text-body-md font-medium text-ink">{update.headline}</p>
                <p className="text-body-sm text-body">{update.message}</p>
              </li>
            ))}
          </ul>
        ) : loaded ? (
          <p className="pt-6 text-body-md text-body">No updates yet.</p>
        ) : null}
      </main>
    </FamilyScreen>
  );
}
