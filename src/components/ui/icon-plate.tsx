import * as React from "react";
import { cn } from "@/lib/utils";

// The icon is decoration. The row it sits in carries the label.
function IconPlate({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="icon-plate"
      aria-hidden="true"
      className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-strong text-ink [&_svg]:size-5", className)}
      {...props}
    >
      {children}
    </span>
  );
}

export { IconPlate };
