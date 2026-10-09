import Link from "next/link";
import type { HubSummary } from "@/lib/contracts";
import { routes } from "@/lib/contracts/routes";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DarkHero } from "@/components/ui/dark-hero";
import { StatusDot, type StatusDotTone } from "@/components/ui/status-dot";

const CLASSES: { key: "totally" | "partially" | "none"; label: string; dot: StatusDotTone }[] = [
  { key: "totally", label: "totally", dot: "danger" },
  { key: "partially", label: "partially", dot: "warning" },
  { key: "none", label: "none", dot: "muted-soft" },
];

const STATS: { key: "families" | "people" | "hurt" | "missing" | "not_yet_visited"; label: string; danger?: boolean }[] = [
  { key: "families", label: "Families" },
  { key: "people", label: "People" },
  { key: "hurt", label: "Hurt", danger: true },
  { key: "missing", label: "Missing", danger: true },
  { key: "not_yet_visited", label: "Not yet visited" },
];

/** The headline of the hub overview. Every number comes from the summary, which counts confirmed entries only. */
export function OverviewHero({ summary }: { summary: HubSummary }) {
  return (
    <DarkHero
      size="hub"
      as="h2"
      eyebrow={`Situation at ${formatTime(summary.as_of)}`}
      title={
        <>
          <span className="font-mono">{summary.houses_checked}</span> houses checked
        </>
      }
    >
      <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-body-sm text-muted-soft">
        {CLASSES.map(({ key, label, dot }) => (
          <span key={key} className="inline-flex items-center gap-2">
            <StatusDot tone={dot} />
            <span className="font-mono font-medium text-canvas">{summary[key]}</span>
            {label}
          </span>
        ))}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild size="hub">
          <Link href={routes.hub.reports}>Make report</Link>
        </Button>
        <Button asChild size="hub" variant="outline-dark">
          <Link href={routes.hub.updates}>Post update</Link>
        </Button>
      </div>

      <dl className="mt-8 flex flex-wrap gap-x-6 gap-y-4 border-t border-surface-dark-elevated pt-6">
        {STATS.map(({ key, label, danger }) => (
          <div key={key} className="flex flex-col gap-1">
            <dt className="text-body-sm text-muted-soft">{label}</dt>
            <dd className={cn("font-mono text-mono-md", danger && summary[key] > 0 ? "text-danger" : "text-canvas")}>{summary[key]}</dd>
          </div>
        ))}
      </dl>
    </DarkHero>
  );
}
