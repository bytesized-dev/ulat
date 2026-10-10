import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { db } from "@/db/client";
import { EntryActions } from "@/components/hub/entries/entry-actions";
import { EntryRail } from "@/components/hub/entries/entry-rail";
import { damageLong, damageTone, entryNumber, statusLabel } from "@/components/hub/entries/labels";
import { NoteSection } from "@/components/hub/entries/note-section";
import { PhotoGrid } from "@/components/hub/entries/photo-grid";
import { HubPage } from "@/components/hub/hub-page";
import { Pill } from "@/components/ui/pill";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";
import { routes } from "@/lib/contracts/routes";
import { getEntryDetail } from "@/lib/hub/entries";

type Props = { params: Promise<{ id: string }> };

// The page reads the database on every request.
export const dynamic = "force-dynamic";

// A fixed title, so the metadata never reads the database.
export const metadata: Metadata = { title: "Entry" };

export default async function EntryPage({ params }: Props) {
  // Household names, injuries, GPS and photos are staff only, like GET /api/entries/[id].
  // src/proxy.ts redirects first; this check does not rely on it.
  const session = await readSession("staff", (await cookies()).get(SESSION_COOKIE.staff)?.value);
  if (!session) redirect(routes.hub.lock);

  const detail = getEntryDetail(db, (await params).id);
  if (!detail) notFound();
  const { entry } = detail;
  const number = entryNumber(entry.number);

  return (
    <HubPage title={`Entry ${number}`} active={routes.hub.entries} rail={<EntryRail detail={detail} />} actions={<EntryActions entry={entry} />}>
      <div data-entry-print className="flex flex-col gap-9">
        <header className="flex flex-col gap-3">
          <Link href={routes.hub.entries} className="hit -ml-1 inline-flex w-fit items-center gap-1 rounded-pill text-body-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden">
            <ChevronLeftIcon aria-hidden="true" className="size-4" />
            Entries
          </Link>
          <h2 className="text-display-md text-ink">{entry.household_head ?? `Entry ${number}`}</h2>
          <div className="flex flex-wrap gap-2">
            {entry.damage_class ? <Pill dot={damageTone[entry.damage_class]}>{damageLong[entry.damage_class]}</Pill> : null}
            <Pill>{statusLabel[entry.status]}</Pill>
            <Pill className="font-mono">{number}</Pill>
          </div>
        </header>
        <section aria-label="Photos">
          <PhotoGrid photos={detail.photos} />
        </section>
        <NoteSection entry={entry} />
      </div>
    </HubPage>
  );
}
