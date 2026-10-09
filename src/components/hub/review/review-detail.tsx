import Image from "next/image";
import { StatusDot } from "@/components/ui/status-dot";
import { aiSide, familyCounts, responderCounts, responderSide, reviewActions, type CountLine, type ReviewEntry, type ReviewPhoto, type Side } from "@/lib/hub/review";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ReviewActions } from "./review-actions";

type ReviewDetailProps = {
  entry: ReviewEntry;
  photos: ReviewPhoto[];
};

function PhotoTiles({ photos }: { photos: ReviewPhoto[] }) {
  if (photos.length === 0) {
    return <p className="rounded-lg bg-surface-soft p-6 text-body-sm text-body">No photos on this entry.</p>;
  }
  return (
    <ul className="grid grid-cols-3 gap-4">
      {photos.map((photo, i) => {
        const label = photo.label?.trim() || `Photo ${i + 1}`;
        return (
          <li key={photo.id} className="relative aspect-4/3 overflow-hidden rounded-lg bg-surface-dark">
            <Image src={`/api/files/${photo.id}`} alt={label} fill unoptimized sizes="33vw" className="object-cover" />
            <span className="absolute bottom-2 left-2 rounded-pill bg-surface-dark px-2.5 py-1 text-caption-strong text-canvas">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

// One side of the comparison. The responder's side has the heavier border, as
// on the canvas, because it is the value that counts unless staff change it.
function SideCard({ title, side, counts, emphasis }: { title: string; side: Side; counts: CountLine[]; emphasis?: boolean }) {
  return (
    <section aria-label={title} className={cn("flex flex-col gap-3 rounded-lg border p-6", emphasis ? "border-ink" : "border-hairline")}>
      <p className="text-caption text-muted-text">{title}</p>
      <p className="flex items-center gap-2.5 text-title-bar font-normal text-ink">
        <StatusDot tone={side.tone} className="size-2.5" />
        {side.label}
      </p>
      {side.text ? <p className="text-body-sm text-body">{side.text}</p> : null}
      {counts.length > 0 ? (
        <dl className="flex flex-col gap-1 border-t border-hairline pt-3 text-body-sm text-body">
          {counts.map((count) => (
            <div key={count.label} className="flex items-baseline justify-between gap-4">
              <dt>{count.label}</dt>
              <dd className="font-mono text-mono-sm text-ink tabular">{count.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

// The selected entry: who and where, the photos, the AI draft next to what the
// responder chose, and the three ways to settle it.
function ReviewDetail({ entry, photos }: ReviewDetailProps) {
  const name = entry.household_head?.trim() || `Entry ${String(entry.number).padStart(4, "0")}`;
  const { approve, useAi } = reviewActions(entry);
  const place = [entry.purok, entry.barangay].filter(Boolean).join(", ");
  const responderName = entry.responder_name.trim();

  return (
    <div className="flex flex-col gap-9">
      <header className="flex flex-col gap-2">
        <h2 className="text-display-md text-ink">{name}</h2>
        <p className="text-body-sm text-body">
          Entry <span className="font-mono text-mono-sm">{String(entry.number).padStart(4, "0")}</span>. {place}. {responderName},{" "}
          <time dateTime={entry.created_at}>{formatTime(entry.created_at)}</time>.
        </p>
      </header>

      <PhotoTiles photos={photos} />

      <div className="grid grid-cols-2 gap-4">
        <SideCard title="AI draft" side={aiSide(entry)} counts={familyCounts(entry)} />
        <SideCard title={`${responderName} chose`} side={responderSide(entry)} counts={responderCounts(entry)} emphasis />
      </div>

      <ReviewActions
        key={entry.id}
        entryId={entry.id}
        approve={approve}
        useAi={useAi}
        responderName={responderName}
        askedAt={entry.photos_asked_at ? formatTime(entry.photos_asked_at) : null}
      />
    </div>
  );
}

export { ReviewDetail };
