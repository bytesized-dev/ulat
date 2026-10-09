import { HubShell } from "@/components/ui/hub-shell";
import { getReviewCount } from "@/lib/hub/review-count";
import { HubStatusBlock } from "./hub-status-block";
import { hubNav } from "./nav";

type HubPageProps = {
  title: string;
  /** The route of the sidebar item that is current, such as routes.hub.overview. */
  active: string;
  /** The right rail. Left out, the page has no rail. */
  rail?: React.ReactNode;
  children: React.ReactNode;
};

/** Every hub page wraps its content in this. It adds the sidebar, status block and top bar. */
export function HubPage({ title, active, rail, children }: HubPageProps) {
  return (
    <HubShell
      title={title}
      nav={hubNav(getReviewCount())}
      activeHref={active}
      status={<HubStatusBlock />}
      name="MDRRMO staff"
      initials="MD"
      rail={rail}
    >
      {children}
    </HubShell>
  );
}
