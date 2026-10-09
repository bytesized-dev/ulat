import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SearchPill, type SearchPillProps } from "@/components/ui/search-pill";

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type AppTopBarProps = Omit<React.ComponentProps<"header">, "children"> & {
  /** Who is signed in. Gives the avatar its name and, by default, its initials. */
  name: string;
  initials?: string;
  searchLabel: string;
  searchProps?: Omit<SearchPillProps, "aria-label" | "size" | "className">;
};

// Phone. A search pill and the avatar, for the responder lists.
function AppTopBar({ name, initials, searchLabel, searchProps, className, ...props }: AppTopBarProps) {
  return (
    <header data-slot="app-top-bar" className={cn("flex items-center gap-3 bg-canvas px-gutter py-2", className)} {...props}>
      <SearchPill aria-label={searchLabel} placeholder={searchLabel} className="flex-1" {...searchProps} />
      <Avatar role="img" aria-label={name}>
        <AvatarFallback>{initials ?? initialsOf(name)}</AvatarFallback>
      </Avatar>
    </header>
  );
}

export { AppTopBar, initialsOf };
export type { AppTopBarProps };
