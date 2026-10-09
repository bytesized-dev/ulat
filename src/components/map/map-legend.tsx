import { cn } from "@/lib/utils";
import { PinMark } from "./pin-mark";
import type { LegendItem } from "./types";

/**
 * A card over the top left of phone maps, or a row under the hub map.
 * Labels come from the screen, since each map names its pins differently.
 */
export function MapLegend({ items, placement }: { items: readonly LegendItem[]; placement: "card" | "row" }) {
  if (items.length === 0) return null;
  return (
    <ul
      aria-label="Legend"
      className={cn(
        "text-caption text-ink",
        placement === "card"
          ? "absolute top-3 left-3 flex flex-col gap-1.5 rounded-lg bg-canvas px-3 py-2.5 shadow-float"
          : "flex flex-wrap items-center gap-x-5 gap-y-2 text-muted-foreground",
      )}
    >
      {items.map((item) => (
        <li key={`${item.kind}-${item.label}`} className="flex items-center gap-2">
          <PinMark kind={item.kind} at="legend" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
