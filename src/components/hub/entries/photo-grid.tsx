import type { EntryDetail } from "@/lib/hub/entries";

/** The photos the responder took, three across. Each is served by GET /api/files/[id]. */
export function PhotoGrid({ photos }: { photos: EntryDetail["photos"] }) {
  if (photos.length === 0) return <p className="text-body-md text-body">No photos.</p>;
  return (
    <ul className="grid grid-cols-3 gap-3">
      {photos.map((photo, index) => (
        <li key={photo.id} className="relative aspect-4/3 overflow-hidden rounded-lg bg-surface-strong">
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the hub, no optimizer */}
          <img src={`/api/files/${photo.id}`} alt={photo.label ?? `Photo ${index + 1}`} className="size-full object-cover" />
          {photo.label ? (
            <span aria-hidden="true" className="absolute bottom-3 left-3 inline-flex h-6.5 items-center rounded-pill bg-surface-dark px-2.5 text-caption-strong text-canvas">
              {photo.label}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
