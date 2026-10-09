import * as React from "react";
import Link from "next/link";
import { ArrowLeftIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type TopBarLeading = {
  kind: "back" | "close";
  /** The accessible name. Defaults to "Back" or "Close". */
  label?: string;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

type TopBarProps = Omit<React.ComponentProps<"header">, "title" | "children"> & {
  title: string;
  leading?: TopBarLeading;
  trailing?: React.ReactNode;
};

const iconButton = cn(buttonVariants({ variant: "tertiary", size: "icon" }), "text-ink hover:bg-surface-soft");

// Phone top bar. Three equal columns keep the title centred whatever sits on
// either side, and the bar is 56px tall.
function TopBar({ title, leading, trailing, className, ...props }: TopBarProps) {
  const Icon = leading?.kind === "close" ? XIcon : ArrowLeftIcon;
  const label = leading ? (leading.label ?? (leading.kind === "close" ? "Close" : "Back")) : undefined;

  return (
    <header data-slot="top-bar" className={cn("grid h-14 grid-cols-3 items-center bg-canvas px-gutter", className)} {...props}>
      <div className="justify-self-start">
        {leading ? (
          leading.href !== undefined ? (
            <Link href={leading.href} aria-label={label} className={iconButton}>
              <Icon aria-hidden="true" className="size-6" />
            </Link>
          ) : (
            <button type="button" aria-label={label} onClick={leading.onClick} className={iconButton}>
              <Icon aria-hidden="true" className="size-6" />
            </button>
          )
        ) : null}
      </div>
      <p className="justify-self-center text-title-sm whitespace-nowrap text-ink">{title}</p>
      <div className="justify-self-end">{trailing}</div>
    </header>
  );
}

export { TopBar };
export type { TopBarLeading, TopBarProps };
