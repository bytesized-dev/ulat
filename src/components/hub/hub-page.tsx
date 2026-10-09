import { HubShell } from "@/components/ui/hub-shell";
import { getReviewCount } from "@/lib/hub/review-count";
import { HubStatusBlock } from "./hub-status-block";
import { HubStatusProvider } from "./hub-status-provider";
import { IdleLock } from "./idle-lock";
import { LowBatteryBanner } from "./low-battery-banner";
import { routes } from "@/lib/contracts/routes";
import { hubNav } from "./nav";

type HubPageProps = {
  title: string;
  /** The route of the sidebar item that is current, such as routes.hub.overview. */
  active: string;
  /** The right rail. Left out, the page has no rail. */
  rail?: React.ReactNode;
  /** Buttons in the top bar, such as Edit and Print. */
  actions?: React.ReactNode;
  /** What the top bar search starts with, and the filters it keeps. Left out, it starts empty and keeps none. */
  search?: { value?: string; keep?: Record<string, string> };
  children: React.ReactNode;
};

/** Every hub page wraps its content in this. It adds the sidebar, status block and top bar. */
export function HubPage({ title, active, rail, actions, search, children }: HubPageProps) {
  return (
    <HubStatusProvider>
      <IdleLock />
      <HubShell
        title={title}
        nav={hubNav(getReviewCount())}
        activeHref={active}
        status={<HubStatusBlock />}
        searchAction={routes.hub.entries}
        searchDefaultValue={search?.value}
        searchHidden={search?.keep}
        actions={actions}
        name="MDRRMO staff"
        initials="MD"
        rail={rail}
      >
        <LowBatteryBanner />
        {children}
      </HubShell>
    </HubStatusProvider>
  );
}
