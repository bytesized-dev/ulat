import Link from "next/link";
import { QrCodeIcon } from "lucide-react";
import type { HubSummary } from "@/lib/contracts";
import { routes } from "@/lib/contracts/routes";
import type { LatestItem } from "@/lib/hub/latest";
import { goFirst, goFirstReason, needBars } from "@/lib/hub/rail";
import { PriorityPill } from "./priority-pill";

const sectionHead = "flex items-center justify-between";
const title = "text-title-md text-ink";
const bar =
  "h-1 w-full appearance-none overflow-hidden rounded-pill bg-hairline-soft [&::-moz-progress-bar]:rounded-pill [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-hairline-soft [&::-webkit-progress-value]:rounded-pill [&::-webkit-progress-value]:bg-primary";
const link ="hit text-body-sm font-semibold text-primary hover:underline";

type OverviewRailProps = {
  summary: HubSummary;
  latest: LatestItem[];
  /** The hub Wi-Fi name from settings, shown under Join the hub. */
  wifiName: string;
};

/** Go first, Needs, Latest and Join the hub. Sits in the hub shell's right rail. */
export function OverviewRail({ summary, latest, wifiName }: OverviewRailProps) {
  const first = goFirst(summary.barangays);
  const needs = needBars(summary);

  return (
    <div className="flex flex-col gap-9">
      <section aria-labelledby="go-first">
        <h2 id="go-first" className={title}>
          Go first
        </h2>
        {first.length > 0 ? (
          <ol className="mt-4 border-t border-hairline-soft">
            {first.map((row, i) => (
              <li key={row.barangay} className="flex min-h-16 items-center justify-between gap-3 border-b border-hairline-soft py-3">
                <span className="flex items-center gap-4">
                  <span className="font-mono text-mono-xs text-muted-text">{i + 1}</span>
                  <span className="flex flex-col">
                    <span className="text-body-sm font-semibold text-ink">{row.barangay}</span>
                    <span className="text-caption text-muted-text">{goFirstReason(row)}</span>
                  </span>
                </span>
                <PriorityPill priority={row.priority} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-body-sm text-body">No barangay needs a team first</p>
        )}
      </section>

      <section aria-labelledby="needs">
        <h2 id="needs" className={title}>
          Needs
        </h2>
        {needs.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-4">
            {needs.map((n) => (
              <li key={n.need} className="flex flex-col gap-2">
                <span className="flex items-center justify-between text-body-sm text-ink">
                  {n.label}
                  <span className="font-mono text-mono-sm">{n.households}</span>
                </span>
                {/* The fill is the share of houses checked that listed this need. */}
                <progress aria-hidden="true" value={n.percent} max={100} className={bar} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-body-sm text-body">No needs listed yet</p>
        )}
      </section>

      <section aria-labelledby="latest">
        <div className={sectionHead}>
          <h2 id="latest" className={title}>
            Latest
          </h2>
          <Link href={routes.hub.entries} className={link}>
            View
          </Link>
        </div>
        {latest.length > 0 ? (
          <ul className="mt-4 border-t border-hairline-soft">
            {latest.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-5 border-b border-hairline-soft py-3 text-body-sm text-ink">
                <time dateTime={item.at} className="w-8 shrink-0 font-mono text-mono-xs text-muted-text">
                  {item.time}
                </time>
                {item.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-body-sm text-body">Nothing yet</p>
        )}
      </section>

      <section aria-labelledby="join-hub" className="flex items-center gap-4">
        <div role="img" aria-label="QR code placeholder" className="flex size-22 shrink-0 items-center justify-center rounded-lg bg-surface-soft">
          <QrCodeIcon aria-hidden="true" className="size-8 text-ink" />
        </div>
        <div className="flex flex-col">
          <h2 id="join-hub" className="text-body-sm font-semibold text-ink">
            Join the hub
          </h2>
          <p className="text-caption text-muted-text">Wi-Fi {wifiName}</p>
          <Link href={routes.hub.poster} className={link}>
            Print poster
          </Link>
        </div>
      </section>
    </div>
  );
}
