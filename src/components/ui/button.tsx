import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

// Every button is a pill. Variants are the four in DESIGN.md, sizes are the
// phone and hub heights plus a round icon button. The hub button is drawn at
// 40px and takes the hit utility so the tap target is still 44px.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-pill whitespace-nowrap font-semibold outline-none select-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-5",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-active active:bg-primary-active disabled:bg-primary-disabled",
        secondary: "bg-surface-strong text-ink hover:bg-hairline active:bg-hairline disabled:text-muted-soft",
        tertiary: "bg-transparent text-primary hover:bg-surface-soft active:bg-surface-strong disabled:text-primary-disabled",
        "outline-dark":
          "border border-canvas bg-transparent text-canvas hover:bg-surface-dark-elevated active:bg-surface-dark-elevated focus-visible:ring-offset-surface-dark disabled:border-muted-soft disabled:text-muted-soft",
      },
      size: {
        phone: "h-14 px-6 text-body-md",
        hub: "hit h-10 px-5 text-body-sm",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "phone",
    },
  },
);

type ButtonBase = Omit<React.ComponentProps<"button">, "children"> &
  Pick<VariantProps<typeof buttonVariants>, "variant"> & {
    asChild?: boolean;
    children?: React.ReactNode;
  };

// An icon button has no text, so the label is not optional there.
type ButtonProps = ButtonBase &
  (
    | { size?: "phone" | "hub" }
    | { size: "icon"; "aria-label": string }
  );

function Button({ className, variant = "primary", size = "phone", asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
