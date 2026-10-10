import Link from "next/link";
import { RefreshCwIcon, WifiOffIcon } from "lucide-react";
import { routes } from "@/lib/contracts";
import { formatTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { IconPlate } from "@/components/ui/icon-plate";
import { Pill } from "@/components/ui/pill";
import { TopBar } from "@/components/ui/top-bar";
import { householdLabel, type QueuedReport } from "./offline-queue";
import { FamilyScreen } from "./family-screen";

type SavedOnPhoneProps = {
  items: QueuedReport[];
  busy: boolean;
  onRetry: () => void;
  onFix: (item: QueuedReport) => void;
  onHome: () => void;
};

// The reports waiting on this phone for the hub. The queue sends them by itself
// when the hub answers, so Try again only asks sooner. A report the hub refused
// stays on the list with a button that takes it back to the check screen.
function SavedOnPhone({ items, busy, onRetry, onFix, onHome }: SavedOnPhoneProps) {
  const waiting = items.some((item) => item.state === "waiting");
  return (
    <FamilyScreen>
      <TopBar as="p" title="" />

      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
        <IconPlate className="size-14 [&_svg]:size-6">
          <WifiOffIcon />
        </IconPlate>
        <div className="flex flex-col gap-2">
          <h1 className="text-title-page text-ink">Saved on this phone</h1>
          <p className="text-body-md text-body">
            {waiting ? "It sends when you're back near the hub." : "The hub could not take this report. Fix it and send it again."}
          </p>
        </div>

        <ul aria-label="Reports saved on this phone" className="flex flex-col">
          {items.map((item) => {
            const label = householdLabel(item.report.household_head);
            return (
              <li key={item.id} className="flex flex-col gap-2 py-2.5">
                <div className="flex min-h-16 items-center justify-between gap-4">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-md font-medium break-words text-ink">{label}</span>
                    <span className="text-body-sm text-body">Saved {formatTime(item.saved_at)}</span>
                  </span>
                  {item.state === "waiting" ? <Pill dot="warning">Waiting</Pill> : <Pill dot="danger">Needs a fix</Pill>}
                </div>
                {item.state === "refused" ? (
                  <Button type="button" variant="secondary" className="h-11 w-full" aria-label={`Fix report, ${label}`} onClick={() => onFix(item)}>
                    Fix report
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </main>

      <footer className="flex flex-col gap-2.5 bg-canvas px-gutter pt-3 pb-7">
        {waiting ? (
          <Button type="button" onClick={onRetry} disabled={busy}>
            <RefreshCwIcon aria-hidden="true" />
            {busy ? "Trying" : "Try again"}
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link href={routes.family.home} onClick={onHome}>
            Home
          </Link>
        </Button>
      </footer>
    </FamilyScreen>
  );
}

export { SavedOnPhone };
