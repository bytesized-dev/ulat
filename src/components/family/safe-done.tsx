"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/ui/row";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { useMounted } from "@/lib/use-mounted";
import { parseCheckedIn, readCheckedInRaw } from "./safe-checkin";
import { FamilyScreen } from "./family-screen";

const subscribeNever = () => () => {};

// The check-in is already on the hub. A family that lands here without making
// one goes back to the form.
export function SafeDone() {
  const router = useRouter();
  const mounted = useMounted();
  const raw = useSyncExternalStore(subscribeNever, () => readCheckedInRaw(), () => null);
  const checkedIn = useMemo(() => parseCheckedIn(raw), [raw]);

  useEffect(() => {
    if (mounted && !checkedIn) router.replace(routes.family.safe);
  }, [mounted, checkedIn, router]);

  if (!checkedIn) return null;

  return (
    <FamilyScreen>
      <TopBar as="p" title="" leading={{ kind: "close", href: routes.family.home }} />
      <main className="flex flex-1 flex-col gap-8 px-gutter pt-5 pb-7">
        <div className="flex flex-col items-center gap-5 pt-6 text-center">
          <span aria-hidden="true" className="flex size-18 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-9" strokeWidth={2.4} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-title-page text-ink">You&apos;re on the safe list</h1>
            <p className="text-body-md text-body">Family can find you by name.</p>
          </div>
        </div>
        <div>
          <Row label="Name" value={checkedIn.name} className="min-h-0 border-b-0 py-2" />
          <Row label="Staying at" value={checkedIn.staying_at} className="min-h-0 border-b-0 py-2" />
        </div>
      </main>
      <footer className="flex flex-col gap-2.5 bg-canvas px-gutter pt-3 pb-7">
        <Button asChild>
          <Link href={routes.family.home}>Done</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={routes.family.safe}>Add someone else</Link>
        </Button>
      </footer>
    </FamilyScreen>
  );
}
