import Link from "next/link";
import { RefreshCwIcon, WifiOffIcon } from "lucide-react";
import { routes } from "@/lib/contracts";
import { formatTime } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { IconPlate } from "@/components/ui/icon-plate";
import { Pill } from "@/components/ui/pill";
import { TopBar } from "@/components/ui/top-bar";
import type { QueuedReport } from "./offline-queue";

type SavedOnPhoneProps = {
  items: QueuedReport[];
  busy: boolean;
  onRetry: () => void;
  onHome: () => void;
};

// The reports waiting on this phone for the hub. The queue sends them by itself
// when the hub answers, so Try again only asks sooner.
function SavedOnPhone({ items, busy, onRetry, onHome }: SavedOnPhoneProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      <TopBar as="p" title="" />

      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
        <IconPlate className="size-14 [&_svg]:size-6">
          <WifiOffIcon />
        </IconPlate>
        <div className="flex flex-col gap-2">
          <h1 className="text-title-page text-ink">Saved on this phone</h1>
          <p className="text-body-md text-body">It sends when you&apos;re back near the hub.</p>
        </div>

        <ul aria-label="Reports waiting to send" className="flex flex-col">
          {items.map((item) => (
            <li key={item.id} className="flex min-h-16 items-center justify-between gap-4 py-2.5">
              <span className="flex min-w-0 flex-col">
                <span className="text-body-md font-medium break-words text-ink">{item.report.household_head}</span>
                <span className="text-body-sm text-body">Saved {formatTime(item.saved_at)}</span>
              </span>
              {item.state === "waiting" ? <Pill dot="warning">Waiting</Pill> : <Pill dot="danger">Needs a fix</Pill>}
            </li>
          ))}
        </ul>
      </main>

      <footer className="flex flex-col gap-2.5 bg-canvas px-gutter pt-3 pb-7">
        <Button type="button" onClick={onRetry} disabled={busy}>
          <RefreshCwIcon aria-hidden="true" />
          {busy ? "Trying" : "Try again"}
        </Button>
        <Button asChild variant="secondary">
          <Link href={routes.family.home} onClick={onHome}>
            Home
          </Link>
        </Button>
      </footer>
    </div>
  );
}

export { SavedOnPhone };
