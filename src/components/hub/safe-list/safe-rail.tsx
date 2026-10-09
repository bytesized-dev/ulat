import { WifiOffIcon } from "lucide-react";
import type { SafeCounts } from "@/lib/hub/safe";
import { Button } from "@/components/ui/button";

/** The right rail: the share button and how many people are at each place. */
export function SafeRail({ staying }: { staying: SafeCounts["staying"] }) {
  return (
    <div className="flex flex-col gap-9">
      <section aria-labelledby="share-title" className="flex flex-col gap-3">
        <h2 id="share-title" className="text-title-md text-ink">
          Share when online
        </h2>
        <p className="text-body-sm text-body">Names and where they are. Messages stay here.</p>
        <Button variant="secondary" size="hub" disabled className="w-full">
          <WifiOffIcon aria-hidden="true" />
          Waiting for internet
        </Button>
      </section>
      <section aria-labelledby="staying-title" className="flex flex-col gap-3">
        <h2 id="staying-title" className="text-title-md text-ink">
          Staying at
        </h2>
        {staying.length === 0 ? (
          <p className="text-body-sm text-body">No one yet</p>
        ) : (
          <dl>
            {staying.map((place) => (
              <div key={place.staying_at} className="flex min-h-11 items-center justify-between gap-3 border-b border-hairline-soft text-body-sm">
                <dt className="text-body">{place.staying_at}</dt>
                <dd className="font-mono text-mono-sm text-ink">{place.count}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
