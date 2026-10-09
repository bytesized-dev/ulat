import * as React from "react";
import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchPillProps = Omit<React.ComponentProps<"input">, "size" | "type"> & {
  /** The accessible name. The placeholder is not one. */
  "aria-label": string;
  size?: "phone" | "hub";
  /** Class names for the pill itself. The input takes the rest. */
  className?: string;
};

// A real search field drawn as a pill, used by AppTopBar and HubShell.
function SearchPill({ size = "phone", className, ...props }: SearchPillProps) {
  return (
    <label
      data-slot="search-pill"
      className={cn(
        "flex items-center gap-2 rounded-pill bg-surface-strong px-4 text-body-md text-body focus-within:ring-2 focus-within:ring-ring",
        size === "phone" ? "h-11" : "hit h-10 text-body-sm",
        className,
      )}
    >
      <SearchIcon aria-hidden="true" className="size-4 shrink-0" />
      <input type="search" className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-body" {...props} />
    </label>
  );
}

export { SearchPill };
export type { SearchPillProps };
