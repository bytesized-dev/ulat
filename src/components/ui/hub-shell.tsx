import * as React from "react";
import Link from "next/link";
import { connection } from "next/server";
import { LockIcon } from "lucide-react";
import { isSimulation } from "@/lib/auth/settings";
import { routes } from "@/lib/contracts/routes";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/components/ui/app-top-bar";
import { Pill } from "@/components/ui/pill";
import { SearchPill } from "@/components/ui/search-pill";

type HubNavItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
  /** A number shown in a blue badge, such as the Review count. */
  count?: number;
  /** Read after the count by screen readers, such as "waiting". */
  countLabel?: string;
};

type HubNavSection = {
  /** A small heading above the group, such as "Kit". */
  heading?: string;
  items: HubNavItem[];
};

type HubShellProps = {
  title: string;
  nav: HubNavSection[];
  /** The href of the item that is current. */
  activeHref: string;
  /** The block above Lock hub, such as internet, phones and battery. */
  status?: React.ReactNode;
  /** Shows the Simulation pill next to the title. Left out, it follows the simulation setting. */
  simulation?: boolean;
  searchLabel?: string;
  /** Where Enter in the search field goes. Left out, the field has no action and the page wires its own. */
  searchAction?: string;
  /** The query parameter the search text is sent as. */
  searchName?: string;
  /** Who is signed in. Gives the avatar its name and, by default, its initials. */
  name: string;
  initials?: string;
  lockHref?: string;
  /** The right rail. Left out, the page has no rail. */
  rail?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

const navLink = "flex h-11 items-center gap-3 rounded-pill px-3.5 text-body-md font-medium text-ink outline-none transition-colors hover:bg-surface-soft";

// The frame every hub page sits in. It is layout only: the sections, the
// counts and the status data come in as props. The one thing it reads itself
// is the simulation setting, so every hub page shows the pill without passing it.
async function HubShell({ title, nav, activeHref, status, simulation, searchLabel = "Search", searchAction, searchName = "q", name, initials, lockHref = routes.hub.lock, rail, children, className }: HubShellProps) {
  // The setting changes at runtime, so the read waits for a request. A page
  // that never reads cookies would otherwise be built with the flag as it was.
  if (simulation === undefined) {
    await connection();
    simulation = isSimulation();
  }
  return (
    <div data-slot="hub-shell" className={cn("flex min-h-dvh bg-canvas text-ink", className)}>
      <aside className="sticky top-0 flex h-dvh w-sidebar shrink-0 flex-col overflow-y-auto border-r border-hairline p-3">
        <p className="px-3.5 py-5 text-title-md font-bold text-primary">Ulat</p>
        <nav aria-label="Hub" className="flex flex-col">
          {nav.map((section, index) => (
            <div key={section.heading ?? index} className="flex flex-col gap-1">
              {section.heading ? <p className="px-3.5 pt-5 pb-1.5 text-caption-strong text-muted-text">{section.heading}</p> : null}
              {section.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn(navLink, active && "bg-surface-strong text-primary hover:bg-surface-strong")}>
                    {item.icon ? <span aria-hidden="true" className="flex shrink-0 [&_svg]:size-5">{item.icon}</span> : null}
                    {item.label}
                    {item.count !== undefined ? (
                      <span className="ml-auto rounded-pill bg-primary px-2 text-caption-strong text-primary-foreground">
                        {item.count}
                        {item.countLabel ? <span className="sr-only">{` ${item.countLabel}`}</span> : null}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 pt-6">
          {status ? <div className="mb-4 rounded-lg bg-surface-soft p-4 text-body-sm">{status}</div> : null}
          <Link href={lockHref} className={navLink}>
            <LockIcon aria-hidden="true" className="size-5 shrink-0" />
            Lock hub
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-18 shrink-0 items-center justify-between gap-4 border-b border-hairline px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-title-bar text-ink">{title}</h1>
            {simulation ? <Pill dot="warning">Simulation</Pill> : null}
          </div>
          <div className="flex items-center gap-3">
            {searchAction ? (
              <form role="search" action={searchAction} method="get">
                <SearchPill size="hub" name={searchName} aria-label={searchLabel} placeholder={searchLabel} maxLength={80} autoComplete="off" className="w-72" />
              </form>
            ) : (
              <SearchPill size="hub" aria-label={searchLabel} placeholder={searchLabel} className="w-72" />
            )}
            <Avatar role="img" aria-label={name}>
              <AvatarFallback>{initials ?? initialsOf(name)}</AvatarFallback>
            </Avatar>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 p-8">{children}</main>
          {rail ? <aside aria-label="Details" className="w-80 shrink-0 border-l border-hairline p-6">{rail}</aside> : null}
        </div>
      </div>
    </div>
  );
}

export { HubShell };
export type { HubNavItem, HubNavSection, HubShellProps };
