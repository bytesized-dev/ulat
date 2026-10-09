import * as React from "react";
import { cn } from "@/lib/utils";

type ChipProps = Omit<React.ComponentProps<"button">, "onClick" | "aria-pressed"> & {
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
};

// A toggle. It says whether it is on with aria-pressed, not only with colour.
function Chip({ pressed, onPressedChange, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={pressed}
      onClick={() => onPressedChange?.(!pressed)}
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-pill px-5 text-body-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:text-muted-soft [&_svg]:size-4 [&_svg]:shrink-0",
        pressed ? "bg-surface-dark text-canvas" : "bg-surface-strong text-ink hover:bg-hairline",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export { Chip };
export type { ChipProps };
