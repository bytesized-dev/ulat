import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// A 7px dot. Colour is never the only signal: the dot sits next to text that
// says the same thing, so it is hidden from screen readers unless a label is given.
const statusDotVariants = cva("inline-block size-1.75 shrink-0 rounded-full", {
  variants: {
    tone: {
      danger: "bg-danger",
      warning: "bg-warning",
      success: "bg-success",
      primary: "bg-primary",
      "muted-soft": "bg-muted-soft",
    },
  },
  defaultVariants: {
    tone: "muted-soft",
  },
});

type StatusDotTone = NonNullable<VariantProps<typeof statusDotVariants>["tone"]>;

type StatusDotProps = Omit<React.ComponentProps<"span">, "children"> & {
  tone?: StatusDotTone;
  /** Only when the dot carries meaning the nearby text does not. */
  label?: string;
};

function StatusDot({ tone, label, className, ...props }: StatusDotProps) {
  return (
    <span
      data-slot="status-dot"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      className={cn(statusDotVariants({ tone }), className)}
      {...props}
    />
  );
}

export { StatusDot, statusDotVariants };
export type { StatusDotProps, StatusDotTone };
