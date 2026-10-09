import * as React from "react";
import { cn } from "@/lib/utils";
import { StatusDot, type StatusDotTone } from "@/components/ui/status-dot";

type PillProps = React.ComponentProps<"span"> & {
  /** A leading dot in this tone. */
  dot?: StatusDotTone;
};

function Pill({ dot, className, children, ...props }: PillProps) {
  return (
    <span
      data-slot="pill"
      className={cn(
        "inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-pill bg-surface-strong px-2.5 text-caption-strong whitespace-nowrap text-ink",
        className,
      )}
      {...props}
    >
      {dot ? <StatusDot tone={dot} /> : null}
      {children}
    </span>
  );
}

export { Pill };
export type { PillProps };
