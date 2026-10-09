import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DownloadIcon } from "lucide-react";
import { db } from "@/db/client";
import { EntriesFilter } from "@/components/hub/entries/entries-filter";
import { EntriesPager } from "@/components/hub/entries/entries-pager";
import { EntriesTable } from "@/components/hub/entries/entries-table";
import { HubPage } from "@/components/hub/hub-page";
import { Button } from "@/components/ui/button";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";
import { listEntries, parseEntryQuery } from "@/lib/hub/entries";

export const metadata: Metadata = { title: "Entries" };

// The list reads the database on every request.
export const dynamic = "force-dynamic";

export default async function EntriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Household names and injuries are staff only, like GET /api/entries.
  // src/proxy.ts redirects first; this check does not rely on it.
  const session = await readSession("staff", (await cookies()).get(SESSION_COOKIE.staff)?.value);
  if (!session) redirect(routes.hub.lock);

  const query = parseEntryQuery(await searchParams);
  const page = listEntries(db, query);
  // The top bar search keeps the damage and barangay filters and starts again at page 1.
  const keptFilters: Record<string, string> = {};
  if (query.damage_class) keptFilters.damage_class = query.damage_class;
  if (query.barangay) keptFilters.barangay = query.barangay;

  return (
    <HubPage title="Entries" active={routes.hub.entries} search={{ value: query.q, keep: keptFilters }}>
      <div className="flex flex-col gap-9">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-display-lg text-ink">{page.total === 1 ? "1 entry" : `${page.total} entries`}</h2>
          <div className="flex items-center gap-3">
            <Button asChild variant="secondary" size="hub">
              <a href="/api/export/entries.csv" download>
                <DownloadIcon aria-hidden="true" />
                Export CSV
              </a>
            </Button>
            <EntriesFilter />
          </div>
        </div>
        {page.rows.length === 0 ? (
          <p className="text-body-md text-body">No entries match.</p>
        ) : (
          <EntriesTable rows={page.rows} />
        )}
        <EntriesPager page={page} filters={query} />
      </div>
    </HubPage>
  );
}
