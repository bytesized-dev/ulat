import Link from "next/link";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/contracts/routes";
import type { EntryFilters, EntryPage } from "@/lib/hub/entries";

/** The list's own URL for a page, keeping the filters. */
export function entriesHref(filters: EntryFilters, page: number): string {
  const query = new URLSearchParams();
  if (filters.damage_class) query.set("damage_class", filters.damage_class);
  if (filters.barangay) query.set("barangay", filters.barangay);
  if (filters.q) query.set("q", filters.q);
  if (page > 1) query.set("page", String(page));
  const string = query.toString();
  return string ? `${routes.hub.entries}?${string}` : routes.hub.entries;
}

/** "1 to 10 of 46" with Previous and Next. A button with nowhere to go is disabled, not hidden. */
export function EntriesPager({ page, filters }: { page: EntryPage; filters: EntryFilters }) {
  const from = (page.page - 1) * page.per_page + 1;
  const to = Math.min(page.page * page.per_page, page.total);
  return (
    <nav aria-label="Pages" className="flex items-center justify-between">
      <p className="font-mono text-mono-sm text-muted-text tabular">{page.total === 0 ? "0 entries" : `${from} to ${to} of ${page.total}`}</p>
      <div className="flex gap-2">
        {page.page > 1 ? (
          <Button asChild variant="secondary" size="hub">
            <Link href={entriesHref(filters, page.page - 1)} rel="prev">Previous</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="hub" disabled>Previous</Button>
        )}
        {page.page < page.pages ? (
          <Button asChild variant="secondary" size="hub">
            <Link href={entriesHref(filters, page.page + 1)} rel="next">Next</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="hub" disabled>Next</Button>
        )}
      </div>
    </nav>
  );
}
