"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Lock, Search } from "lucide-react";
import { product } from "@/config";
import { routes } from "@/lib/contracts/routes";
import type { HubStatus } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { fetchHubStatus, formatBattery } from "@/lib/hub/status";
import { isActive, kitNav, mainNav, titleFor, type NavItem } from "./nav";

const refreshMs = 10_000;

function useHubStatus() {
  const [status, setStatus] = useState<HubStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const next = await fetchHubStatus(fetch, controller.signal);
      if (!controller.signal.aborted) setStatus(next);
    };
    void load();
    const timer = setInterval(load, refreshMs);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return status;
}

function NavLink({ item, pathname, reviewCount }: { item: NavItem; pathname: string; reviewCount: number }) {
  const active = isActive(item.href, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-full px-4 text-body-sm font-medium",
        active ? "bg-surface-strong text-primary" : "text-ink hover:bg-surface-soft",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {item.showReviewCount && reviewCount > 0 ? (
        <span
          className="min-w-6 rounded-full bg-primary px-2 text-center text-caption font-semibold text-primary-foreground"
          aria-label={`${reviewCount} waiting`}
        >
          {reviewCount}
        </span>
      ) : null}
    </Link>
  );
}

function StatusBlock({ status }: { status: HubStatus | null }) {
  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Internet", value: status ? (status.internet ? "Online" : "Offline") : "Checking" },
    { label: "Phones", value: status ? String(status.phones) : "Unknown", mono: true },
    { label: "Battery", value: status ? formatBattery(status.battery_percent) : "Unknown", mono: true },
  ];
  return (
    <dl className="grid gap-2 rounded-xl bg-surface-soft p-4 text-caption">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between">
          <dt className="text-body">{row.label}</dt>
          <dd className={cn("font-semibold text-ink", row.mono && "font-mono")}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HubShell({ reviewCount, children }: { reviewCount: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const status = useHubStatus();

  return (
    <div className="flex min-h-dvh bg-canvas text-ink">
      <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-hairline px-3 py-6">
        <div className="px-4 pb-2">
          <span className="text-title-bar font-semibold text-primary">{product.name}</span>
        </div>

        <nav aria-label="Hub" className="grid gap-1">
          {mainNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} reviewCount={reviewCount} />
          ))}
          <div className="px-4 pt-6 pb-1 text-caption text-muted-text">Kit</div>
          {kitNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} reviewCount={reviewCount} />
          ))}
        </nav>

        <div className="mt-auto grid gap-4">
          <StatusBlock status={status} />
          <Link
            href={routes.hub.lock}
            className="flex min-h-11 items-center gap-3 rounded-full px-4 text-body-sm font-medium text-ink hover:bg-surface-soft"
          >
            <Lock className="size-5 shrink-0" aria-hidden="true" />
            Lock hub
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-18 shrink-0 items-center justify-between gap-4 border-b border-hairline px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-title-bar font-semibold">{titleFor(pathname)}</h1>
            {status?.simulation ? (
              <span className="inline-flex h-6.5 items-center gap-1.5 rounded-full bg-surface-strong px-3 text-caption font-semibold">
                <span className="size-1.75 rounded-full bg-warning" aria-hidden="true" />
                Simulation
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-11 w-80 items-center gap-2 rounded-full bg-surface-strong px-4 text-body-sm text-body"
            >
              <Search className="size-4 shrink-0" aria-hidden="true" />
              Search
            </button>
            <span
              role="img"
              aria-label="MDRRMO staff"
              className="flex size-11 items-center justify-center rounded-full bg-surface-strong text-caption font-semibold"
            >
              MD
            </span>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/** Page body with an optional right rail, 320px wide with a hairline left border. */
export function HubSplit({ rail, children }: { rail?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
      {rail ? (
        <aside aria-label="Details" className="w-80 shrink-0 border-l border-hairline px-6 py-7">
          {rail}
        </aside>
      ) : null}
    </>
  );
}
