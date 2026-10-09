import { Triangle } from "lucide-react";
import type { Ref } from "react";
import { cn } from "@/lib/utils";
import type { MapPin, PinKind } from "./types";

/*
  The pin shapes from DESIGN.md: totally is a danger dot, partially a warning
  dot, not visited a white dot with a dashed ink border, relief a primary dot,
  shelter a body rounded square, hazard an ink triangle, and "you" a primary
  dot with a soft halo. The same marks draw the legend, at legend size.
*/

const shape: Record<PinKind, string> = {
  total: "rounded-full bg-danger ring-2 ring-canvas",
  partial: "rounded-full bg-warning ring-2 ring-canvas",
  unvisited: "rounded-full border-2 border-dashed border-ink bg-canvas",
  relief: "rounded-full bg-primary ring-2 ring-canvas",
  shelter: "rounded-sm bg-body ring-2 ring-canvas",
  hazard: "",
  you: "rounded-full bg-primary ring-4 ring-primary/25",
};

const size = {
  legend: "size-2.5",
  map: "size-3.5",
  selected: "size-6",
} as const;

export type PinMarkSize = keyof typeof size;

export function PinMark({ kind, at = "map" }: { kind: PinKind | "shade"; at?: PinMarkSize }) {
  if (kind === "shade") return <span aria-hidden className={cn("block rounded-sm bg-map-shade-1", size[at])} />;
  if (kind === "hazard") return <Triangle aria-hidden className={cn("block fill-ink text-ink", size[at])} />;
  return (
    <span
      aria-hidden
      className={cn("block", shape[kind], size[at], at === "selected" && kind !== "you" && "ring-4 ring-primary/30")}
    />
  );
}

/**
 * A pin on the map: a 44px button when pins can be selected, else a plain mark.
 * Each engine places it, so position comes in through ref and className.
 */
export function PinTarget({
  ref,
  pin,
  selected,
  onSelect,
  className,
}: {
  ref?: Ref<HTMLElement>;
  pin: MapPin;
  selected: boolean;
  onSelect?: (pin: MapPin) => void;
  className?: string;
}) {
  const mark = <PinMark kind={pin.kind} at={selected ? "selected" : "map"} />;
  if (!onSelect) {
    return (
      <span ref={ref} title={pin.label} className={cn(className, "pointer-events-none")}>
        {mark}
      </span>
    );
  }
  return (
    <button
      type="button"
      ref={ref as Ref<HTMLButtonElement>}
      title={pin.label}
      aria-label={pin.label}
      aria-pressed={selected}
      onClick={() => onSelect(pin)}
      className={cn(
        className,
        "flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary",
      )}
    >
      {mark}
    </button>
  );
}
