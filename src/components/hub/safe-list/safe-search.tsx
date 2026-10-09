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
  // The rows come with the name they were found for, so rows for an older name never show.
  const [found, setFound] = useState<{ q: string; rows: SafeRow[] | null } | null>(null);

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
    const term = q.trim();
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const next = await fetchSafe(term, fetch, controller.signal);
      if (!controller.signal.aborted) setFound({ q: term, rows: next });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, searching, checkin]);

  const answered = searching && found?.q === q.trim() ? found : null;
  const current = answered?.rows ?? null;
  const rows = searching ? (current ?? []) : initial;
  const empty = !searching
    ? "No one has checked in yet"
    : !answered
      ? "Searching"
      : current
        ? "No one by that name"
        : "Could not reach the hub. Try again.";

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
      <SafeTable rows={rows} empty={empty} />
      <p role="status" className="sr-only">
        {current ? `${current.length} found` : ""}
      </p>
    </div>
  );
}
