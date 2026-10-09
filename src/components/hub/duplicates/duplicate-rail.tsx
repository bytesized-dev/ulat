import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { routes } from "@/lib/contracts/routes";
import { distanceLabel, sideLine, type DuplicatePair } from "@/lib/hub/duplicates";
import { cn } from "@/lib/utils";

type DuplicateRailProps = {
  pairs: DuplicatePair[];
  selected: string | null;
};

// The open pairs, one link each. The selected one is the pair in the main column.
function DuplicateRail({ pairs, selected }: DuplicateRailProps) {
  return (
    <section aria-labelledby="rail-duplicates" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="rail-duplicates" className="text-title-md text-ink">
          Duplicates
        </h2>
        <span className="font-mono text-mono-sm text-muted-text">{pairs.length}</span>
      </div>
      {pairs.length === 0 ? (
        <p className="text-body-sm text-body">Nothing to review.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pairs.map((pair) => {
            const current = pair.id === selected;
            return (
              <li key={pair.id}>
                <Link
                  href={`${routes.hub.duplicates}?pair=${pair.id}`}
                  scroll={false}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "hit flex flex-col items-start gap-2 rounded-lg p-4 outline-none transition-colors hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring",
                    current && "bg-surface-soft",
                  )}
                >
                  <span className="text-body-sm font-semibold text-ink">{pair.a.household_head}</span>
                  <span className="flex flex-col gap-0.5 font-mono text-mono-sm text-muted-text">
                    <span>{sideLine(pair.a)}</span>
                    <span>{sideLine(pair.b)}</span>
                  </span>
                  <Pill dot="warning">{distanceLabel(pair.distance_m)}</Pill>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export { DuplicateRail };
