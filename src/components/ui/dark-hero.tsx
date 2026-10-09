import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const heroVariants = cva("rounded-xl bg-surface-dark text-canvas", {
  variants: {
    size: {
      phone: "p-6",
      hub: "p-8",
    },
  },
  defaultVariants: { size: "phone" },
});

const titleVariants = cva("text-canvas", {
  variants: {
    size: {
      phone: "text-title-page",
      hub: "text-display-xl",
    },
  },
});

type DarkHeroProps = Omit<React.ComponentProps<"section">, "title"> &
  VariantProps<typeof heroVariants> & {
    /** The small line above the title, in muted-soft. */
    eyebrow?: string;
    title?: React.ReactNode;
  };

// The one big moment on a screen. Anything in children that is secondary text
// takes text-muted-soft.
function DarkHero({ size = "phone", eyebrow, title, className, children, ...props }: DarkHeroProps) {
  return (
    <section data-slot="dark-hero" className={cn(heroVariants({ size }), className)} {...props}>
      {eyebrow ? <p className="text-body-sm text-muted-soft">{eyebrow}</p> : null}
      {title ? <h2 className={cn(titleVariants({ size }), eyebrow && "mt-2")}>{title}</h2> : null}
      {children}
    </section>
  );
}

export { DarkHero };
export type { DarkHeroProps };
