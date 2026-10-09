import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { db } from "@/db/client";
import { DraftComparison } from "@/components/hub/entries/draft-comparison";
import { EntryRail } from "@/components/hub/entries/entry-rail";
import { damageLong, damageTone, entryNumber, statusLabel } from "@/components/hub/entries/labels";
import { NoteSection } from "@/components/hub/entries/note-section";
import { PhotoGrid } from "@/components/hub/entries/photo-grid";
import { HubPage } from "@/components/hub/hub-page";
import { Pill } from "@/components/ui/pill";
import { routes } from "@/lib/contracts/routes";
import { getEntryDetail } from "@/lib/hub/entries";

type Props = { params: Promise<{ id: string }> };

// The page reads the database on every request.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = getEntryDetail(db, (await params).id);
  return { title: detail ? `Entry ${entryNumber(detail.entry.number)}` : "Entry" };
}

export default async function EntryPage({ params }: Props) {
  const detail = getEntryDetail(db, (await params).id);
  if (!detail) notFound();
  const { entry } = detail;
  const number = entryNumber(entry.number);

  return (
    <HubPage title={`Entry ${number}`} active={routes.hub.entries} rail={<EntryRail detail={detail} />}>
      <div className="flex flex-col gap-9">
        <header className="flex flex-col gap-3">
          <Link href={routes.hub.entries} className="hit -ml-1 inline-flex w-fit items-center gap-1 rounded-pill text-body-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
        <section aria-labelledby="compare-h" className="flex flex-col gap-3">
          <h2 id="compare-h" className="text-title-md text-ink">AI draft and final</h2>
          <DraftComparison rows={detail.comparison} />
        </section>
      </div>
    </HubPage>
  );
}
