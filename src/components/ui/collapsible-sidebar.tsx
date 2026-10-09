"use client";

import * as React from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const storageKey = "ulat.hub.sidebar-collapsed";

// The hub sidebar on large screens, with a button that folds it down to icons.
// It sets data-collapsed, and the nav inside reads it with group-data-collapsed/sidebar
// so the server-rendered links can hide their text without knowing the state.
// The choice is remembered in this browser.
const listeners = new Set<() => void>();

// Kept when the browser refuses storage, so the button still works for this visit.
let remembered: boolean | null = null;

function readCollapsed() {
  if (remembered !== null) return remembered;
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function CollapsibleSidebar({ children, className }: { children: React.ReactNode; className?: string }) {
  // The server renders it open. The saved choice applies right after hydration.
  const collapsed = React.useSyncExternalStore(subscribe, readCollapsed, () => false);

  const toggle = () => {
    remembered = !collapsed;
    try {
      window.localStorage.setItem(storageKey, collapsed ? "0" : "1");
    } catch {}
    listeners.forEach((listener) => listener());
  };

  const Icon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <aside data-collapsed={collapsed ? "" : undefined} className={cn("group/sidebar", collapsed ? "w-20" : "w-sidebar", className)}>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 pb-0">{children}</div>
        <div className="flex shrink-0 justify-end px-3 py-3 group-data-collapsed/sidebar:justify-center">
          <button
            type="button"
            onClick={toggle}
            aria-label={label}
            aria-expanded={!collapsed}
            title={label}
            className="flex size-11 items-center justify-center rounded-pill text-ink outline-none transition-colors hover:bg-surface-soft"
          >
            <Icon aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export { CollapsibleSidebar };
