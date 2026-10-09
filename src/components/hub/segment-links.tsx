import Link from "next/link";
import { routes } from "@/lib/contracts";
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
    <nav className={cn("inline-flex max-w-full gap-1 overflow-x-auto rounded-pill bg-surface-strong p-1", className)} {...props}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={link.current ? "page" : undefined}
          className={cn(
            "hit flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-4 whitespace-nowrap text-body-sm font-semibold text-body outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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

type ReviewTab = "second_look" | "duplicates" | "family_reports";

type ReviewTabsProps = {
  active: ReviewTab;
  counts: Record<ReviewTab, number>;
  className?: string;
};

const REVIEW_TABS: { tab: ReviewTab; label: string; href: string }[] = [
  { tab: "second_look", label: "Second look", href: routes.hub.review },
  { tab: "duplicates", label: "Duplicates", href: routes.hub.duplicates },
  { tab: "family_reports", label: "Family reports", href: routes.hub.familyReports },
];

// The three Review lists, in the order of the canvas. Every Review page renders
// this with its own tab active, so the tabs and their counts stay the same.
function ReviewTabs({ active, counts, className }: ReviewTabsProps) {
  return (
    <SegmentLinks
      aria-label="Review lists"
      className={className}
      links={REVIEW_TABS.map(({ tab, label, href }) => ({ label, href, count: counts[tab], current: tab === active }))}
    />
  );
}

export { ReviewTabs, SegmentLinks };
export type { ReviewTab, SegmentLink };
