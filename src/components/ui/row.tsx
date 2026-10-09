import * as React from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconPlate } from "@/components/ui/icon-plate";

type RowContent = {
  label: React.ReactNode;
  value?: React.ReactNode;
  /** An icon for the plate on the left. */
  icon?: React.ReactNode;
  /** A status slot on the right. Replaces the chevron. */
  trailing?: React.ReactNode;
  /** Show the chevron. On by default for a link or a button. */
  chevron?: boolean;
  className?: string;
};

type RowProps = RowContent &
  (
    | ({ href: string; onClick?: never } & Omit<React.ComponentProps<typeof Link>, "href" | "children" | "className">)
    | ({ onClick: React.MouseEventHandler<HTMLButtonElement>; href?: never } & Omit<React.ComponentProps<"button">, "onClick" | "children" | "className">)
    | { href?: never; onClick?: never }
  );

const rowBase = "flex min-h-16 w-full items-center gap-4 border-b border-hairline-soft py-3 text-left";

// A flat list row. It is a link when it has an href, a button when it has an
// onClick, and plain text otherwise, so the markup always matches what it does.
function Row(props: RowProps) {
  const { label, value, icon, trailing, chevron, className, ...rest } = props;
  const interactive = "href" in rest && rest.href !== undefined ? "link" : "onClick" in rest && rest.onClick !== undefined ? "button" : "static";
  const showChevron = !trailing && (chevron ?? interactive !== "static");

  const content = (
    <>
      {icon ? <IconPlate>{icon}</IconPlate> : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-sm text-body">{label}</span>
        {value != null ? <span className="text-body-md font-medium text-ink">{value}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 flex-col items-end gap-0.5">{trailing}</span> : null}
      {showChevron ? <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-muted-soft" /> : null}
    </>
  );

  if (interactive === "link") {
    const { href, ...linkProps } = rest as { href: string } & Omit<React.ComponentProps<typeof Link>, "href">;
    return (
      <Link data-slot="row" href={href} className={cn(rowBase, className)} {...linkProps}>
        {content}
      </Link>
    );
  }

  if (interactive === "button") {
    return (
      <button
        data-slot="row"
        type="button"
        className={cn(rowBase, "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", className)}
        {...(rest as React.ComponentProps<"button">)}
      >
        {content}
      </button>
    );
  }

  return (
    <div data-slot="row" className={cn(rowBase, className)}>
      {content}
    </div>
  );
}

export { Row };
export type { RowProps };
