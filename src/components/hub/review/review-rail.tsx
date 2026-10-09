import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { reasonLabels, reasonTone, type ReviewEntry } from "@/lib/hub/review";
import { routes } from "@/lib/contracts/routes";
import { cn } from "@/lib/utils";

type ReviewRailProps = {
  entries: ReviewEntry[];
  selected: string | null;
};

// The list of entries waiting for a second look, each with why. The selected
// one is a soft panel, and every row is a real link so the back button works.
function ReviewRail({ entries, selected }: ReviewRailProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-title-md text-ink">Second look</h2>
        <span className="font-mono text-mono-sm text-muted-text">{entries.length}</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-body-sm text-body">Nothing is waiting.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.map((entry) => {
            const current = entry.id === selected;
            const reasons = reasonLabels(entry.review_reason);
            return (
              <li key={entry.id}>
                <Link
                  href={`${routes.hub.review}?entry=${entry.id}`}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "hit flex flex-col items-start gap-2 rounded-lg px-4 py-3 outline-none hover:bg-surface-soft focus-visible:ring-2 focus-visible:ring-ring",
                    current && "bg-surface-strong hover:bg-surface-strong",
                  )}
                >
                  <span className="text-body-sm font-semibold text-ink">{entry.household_head?.trim() || `Entry ${String(entry.number).padStart(4, "0")}`}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {reasons.map((reason) => (
                      <Pill key={reason} dot={reasonTone(reason)} className={current ? "bg-canvas" : undefined}>
                        {reason}
                      </Pill>
                    ))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { ReviewRail };
