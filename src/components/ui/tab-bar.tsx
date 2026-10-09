import * as React from "react";
import Link from "next/link";
import { CircleCheckIcon, ListIcon, MapIcon, UploadIcon } from "lucide-react";
import { routes } from "@/lib/contracts/routes";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "toVisit", label: "To visit", href: routes.responder.toVisit, Icon: ListIcon },
  { key: "map", label: "Map", href: routes.responder.map, Icon: MapIcon },
  { key: "done", label: "Done", href: routes.responder.done, Icon: CircleCheckIcon },
  { key: "queue", label: "Queue", href: routes.responder.queue, Icon: UploadIcon },
] as const;

type TabKey = (typeof tabs)[number]["key"];

type TabBarProps = Omit<React.ComponentProps<"nav">, "children"> & {
  active: TabKey;
};

// The responder's bottom tabs. The page says which one is active, so the bar
// needs no router and renders the same on the server and in the browser.
function TabBar({ active, className, ...props }: TabBarProps) {
  return (
    <nav data-slot="tab-bar" aria-label="Responder sections" className={cn("grid grid-cols-4 border-t border-hairline bg-canvas", className)} {...props}>
      {tabs.map(({ key, label, href, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={key === active ? "page" : undefined}
          className={cn("flex h-16 flex-col items-center justify-center gap-1 text-caption-strong", key === active ? "text-primary" : "text-muted-text")}
        >
          <Icon aria-hidden="true" className="size-6" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export { TabBar };
export type { TabBarProps, TabKey };
