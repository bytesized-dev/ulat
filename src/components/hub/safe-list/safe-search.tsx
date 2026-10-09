"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { routes } from "@/lib/contracts/routes";
import { useLiveEvents } from "@/lib/live/use-live-events";
import { isSearchable } from "@/lib/hub/safe-query";
import { Button } from "@/components/ui/button";
import { SearchPill } from "@/components/ui/search-pill";
import { fetchSafe, type SafeRow } from "./fetch-safe";
import { SafeTable } from "./safe-table";

const DEBOUNCE_MS = 200;

type SafeSearchProps = {
  /** The latest check-ins, read on the server. Shown until a name is typed. */
  initial: SafeRow[];
  total: number;
};

// The count, the name search and the table. A typed name asks GET /api/safe.
// A new check-in anywhere refreshes the server data and repeats the search.
export function SafeSearch({ initial, total }: SafeSearchProps) {
  const router = useRouter();
  const live = useLiveEvents();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<SafeRow[] | null>(null);

  const searching = isSearchable(q);
  const checkin = live.latest?.type === "safe.checked_in" ? live.latest : null;

  // The stream does not replay what it missed while it was down, so coming
  // back online refreshes too.
  useEffect(() => {
    if (checkin || live.connected) router.refresh();
  }, [checkin, live.connected, router]);

  // A new check-in repeats the search on screen.
  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const next = await fetchSafe(q, fetch, controller.signal);
      if (!controller.signal.aborted && next) setFound(next);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, searching, checkin]);

  const rows = searching && found ? found : initial;

  return (
    <div className="flex flex-col gap-9">
      <div className="flex items-center justify-between gap-6">
        <h2 className="text-display-lg text-ink">
          <span className="tabular">{total}</span> safe
        </h2>
        <div className="flex items-center gap-3">
          <SearchPill size="hub" aria-label="Search the safe list" placeholder="Search a name" value={q} onChange={(event) => setQ(event.target.value)} className="w-60" />
          <Button asChild size="hub">
            <Link href={routes.hub.desk}>
              <PlusIcon aria-hidden="true" />
              Add at desk
            </Link>
          </Button>
        </div>
      </div>
      <SafeTable rows={rows} empty={searching ? "No one by that name" : "No one has checked in yet"} />
      <p role="status" className="sr-only">
        {searching && found ? `${found.length} found` : ""}
      </p>
    </div>
  );
}
