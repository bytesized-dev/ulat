import Link from "next/link";
import { cn } from "@/lib/utils";

type SegmentLink = { label: string; href: string; count?: number; current: boolean };

type SegmentLinksProps = {
  "aria-label": string;
  links: SegmentLink[];
  className?: string;
};

// The Segmented look for choices that are pages or query strings, so each
// choice is a real link that works with the back button and without script.
function SegmentLinks({ links, className, ...props }: SegmentLinksProps) {
  return (
    <nav className={cn("inline-flex gap-1 rounded-pill bg-surface-strong p-1", className)} {...props}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.current ? "page" : undefined}
          className={cn(
            "hit flex h-9 items-center gap-1.5 rounded-pill px-4 text-body-sm font-semibold text-body outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            link.current && "bg-surface-dark text-canvas hover:text-canvas",
          )}
        >
          {link.label}
          {link.count !== undefined ? <span className={cn("text-caption", link.current ? "text-muted-soft" : "text-muted-text")}>{link.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export { SegmentLinks };
export type { SegmentLink };
