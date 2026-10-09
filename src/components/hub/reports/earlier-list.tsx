import { formatTime } from "@/lib/time";

/** Reports made before the one on screen, newest first. */
export function EarlierList({ items }: { items: { number: number; created_at: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="earlier-title" className="flex flex-col gap-2">
      <h2 id="earlier-title" className="text-title-md text-ink">
        Earlier
      </h2>
      <ul>
        {items.map((item) => (
          <li key={item.number} className="flex min-h-11 items-center justify-between border-b border-hairline-soft text-body-sm text-body">
            <span>{`No. ${item.number}`}</span>
            <span className="font-mono text-mono-sm text-ink tabular">{formatTime(item.created_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
