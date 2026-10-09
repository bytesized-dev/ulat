"use client";

import Link from "next/link";
import type { HubSummary } from "@/lib/contracts";
import { routes } from "@/lib/contracts/routes";
import type { LatestItem } from "@/lib/hub/latest";
import { BarangayTable } from "./barangay-table";
import { OverviewHero } from "./overview-hero";
import { OverviewRail } from "./overview-rail";
import { useHubSummary } from "./use-hub-summary";

type OverviewMainProps = {
  summary: HubSummary;
  /** The damage map. Left out, an empty frame holds its place until MapView lands with BYT-4. */
  map?: React.ReactNode;
};

/** The hero, the damage map and the table by barangay. Live through useHubSummary. */
export function OverviewMain({ summary: initial, map }: OverviewMainProps) {
  const summary = useHubSummary(initial);
  return (
    <div className="flex flex-col gap-9">
      <OverviewHero summary={summary} />

      <section aria-labelledby="damage-map">
        <div className="flex items-center justify-between">
          <h2 id="damage-map" className="text-title-md text-ink">
            Damage by barangay
          </h2>
          <Link href={routes.hub.map} className="hit text-body-sm font-semibold text-primary hover:underline">
            Open map
          </Link>
        </div>
        <div className="mt-4">{map ?? <div aria-hidden="true" className="aspect-video w-full rounded-lg bg-surface-soft" />}</div>
      </section>

      <BarangayTable rows={summary.barangays} />
    </div>
  );
}

type OverviewRailLiveProps = { summary: HubSummary; latest: LatestItem[]; wifiName: string };

/** The rail with the same live summary as the main column. */
export function OverviewRailLive({ summary: initial, ...props }: OverviewRailLiveProps) {
  const summary = useHubSummary(initial);
  return <OverviewRail summary={summary} {...props} />;
}
