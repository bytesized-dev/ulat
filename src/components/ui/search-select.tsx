"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldVariants, Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * A name as the search sees it: lower case, no accents, no "(Pob.)" suffix and
 * nothing but letters and digits, so "Santo Niño" and "Ba-ao" are reached by
 * "santo nino" and "baao".
 */
function searchKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\(pob\.?\)/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** The options a search keeps, in their own order. An empty search keeps all. */
function filterOptions(options: string[], query: string): string[] {
  const wanted = searchKey(query);
  return wanted === "" ? options : options.filter((option) => searchKey(option).includes(wanted));
}

type SearchSelectProps = Omit<React.ComponentProps<"button">, "value" | "onChange" | "type" | "children"> & {
  /** The names to pick from. The search is a local filter over them. */
  options: string[];
  /** The picked name, or an empty string before anyone picks. */
  value: string;
  onValueChange: (value: string) => void;
  /** Shown in the field until a name is picked, such as "Choose barangay". */
  placeholder: string;
  /** The sheet title, and what the search is called, such as "Barangay". */
  title: string;
};

// A field that opens a bottom sheet with a search on top and the names below.
// It looks like Select, so the two sit together in a form. Pair it with a Label
// whose htmlFor is this id. Extra props, such as aria-invalid and
// aria-describedby, go to the button, and a ref reaches it so a form can focus
// the field.
function SearchSelect({ options, value, onValueChange, placeholder, title, className, ...props }: SearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const shown = filterOptions(options, query);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function pick(name: string) {
    onValueChange(name);
    handleOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          data-slot="search-select"
          aria-haspopup="dialog"
          className={cn(fieldVariants(), "flex items-center justify-between gap-2 text-left whitespace-nowrap select-none", className)}
          {...props}
        >
          <span className={cn("truncate", value === "" && "text-muted-text")}>{value === "" ? placeholder : value}</span>
          <ChevronDownIcon aria-hidden="true" className="pointer-events-none size-5 shrink-0 text-body" />
        </button>
      </SheetTrigger>
      <SheetContent title={title}>
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label={`Search ${title.toLowerCase()}`}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        {shown.length === 0 ? (
          <p className="py-6 text-center text-body-md text-muted-text">No {title.toLowerCase()} found</p>
        ) : (
          <ul className="flex max-h-80 flex-col overflow-y-auto">
            {shown.map((name) => (
              <li key={name} className="border-b border-hairline-soft last:border-b-0">
                <button
                  type="button"
                  aria-current={name === value ? "true" : undefined}
                  onClick={() => pick(name)}
                  className="flex min-h-touch w-full items-center justify-between gap-3 py-3 text-left text-body-md text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {name}
                  {name === value ? <CheckIcon aria-hidden="true" className="size-5 shrink-0 text-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

export { SearchSelect, filterOptions, searchKey };
export type { SearchSelectProps };
