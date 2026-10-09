import * as React from "react";
import Link from "next/link";
import { connection } from "next/server";
import { LockIcon } from "lucide-react";
import { isSimulation } from "@/lib/auth/settings";
import { routes } from "@/lib/contracts/routes";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/components/ui/app-top-bar";
import { HubMenu } from "@/components/ui/hub-menu";
import { Logo } from "@/components/ui/logo";
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
  /** Fills the search field, such as the text a list is already filtered by. */
  searchDefaultValue?: string;
  /** Fields sent along with the search, such as filters to keep. Only used with searchAction. */
  searchHidden?: Record<string, string>;
  /** Buttons in the top bar, left of the search field. */
  actions?: React.ReactNode;
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
async function HubShell({ title, nav, activeHref, status, simulation, searchLabel = "Search", searchAction, searchName = "q", searchDefaultValue, searchHidden, actions, name, initials, lockHref = routes.hub.lock, rail, children, className }: HubShellProps) {
  // The setting changes at runtime, so the read waits for a request. A page
  // that never reads cookies would otherwise be built with the flag as it was.
  if (simulation === undefined) {
    await connection();
    simulation = isSimulation();
  }
  const navLinks = (
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
  );
  const brand = (
    <div className="flex justify-center px-3.5 py-5">
      <Logo priority className="w-16" />
    </div>
  );
  const footer = (
    <div className="mt-auto flex flex-col gap-1 pt-6">
      {status ? <div className="mb-4 rounded-lg bg-surface-soft p-4 text-body-sm">{status}</div> : null}
      <Link href={lockHref} className={navLink}>
        <LockIcon aria-hidden="true" className="size-5 shrink-0" />
        Lock hub
      </Link>
    </div>
  );

  // Phone first: one column, the sidebar behind a menu button and the rail under
  // the page. The sidebar comes in at lg and the rail moves beside the page at xl.
  return (
    <div data-slot="hub-shell" className={cn("flex min-h-dvh bg-canvas text-ink", className)}>
      <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col overflow-y-auto border-r border-hairline p-3 lg:flex">
        {brand}
        {navLinks}
        {footer}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3 lg:h-18 lg:flex-nowrap lg:gap-4 lg:px-8 lg:py-0">
          <div className="flex min-w-0 items-center gap-3">
            <HubMenu>
              {brand}
              {navLinks}
              {footer}
            </HubMenu>
            <h1 className="truncate text-title-md text-ink lg:text-title-bar">{title}</h1>
            {simulation ? <Pill dot="warning">Simulation</Pill> : null}
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:flex-nowrap">
            {actions}
            {searchAction ? (
              <form role="search" action={searchAction} method="get" className="min-w-0 flex-1 basis-full sm:basis-auto lg:flex-none">
                {Object.entries(searchHidden ?? {}).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
                {/* The key remounts the field when the filter text changes, so a new default shows. */}
                <SearchPill key={searchDefaultValue} size="hub" name={searchName} defaultValue={searchDefaultValue} aria-label={searchLabel} placeholder={searchLabel} maxLength={80} autoComplete="off" className="w-full lg:w-72" />
              </form>
            ) : (
              <SearchPill size="hub" aria-label={searchLabel} placeholder={searchLabel} className="min-w-0 flex-1 basis-full sm:basis-auto lg:w-72 lg:flex-none" />
            )}
            <Avatar role="img" aria-label={name} className="hidden lg:flex">
              <AvatarFallback>{initials ?? initialsOf(name)}</AvatarFallback>
            </Avatar>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
          {rail ? <aside aria-label="Details" className="w-full shrink-0 border-t border-hairline p-4 sm:p-6 xl:w-80 xl:border-t-0 xl:border-l">{rail}</aside> : null}
        </div>
      </div>
    </div>
  );
}

export { HubShell };
export type { HubNavItem, HubNavSection, HubShellProps };
