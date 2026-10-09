"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";

type Choice = "all" | "total" | "partial" | "none";

const options: SegmentedOption<Choice>[] = [
  { value: "all", label: "All" },
  { value: "total", label: "Totally" },
  { value: "partial", label: "Partially" },
  { value: "none", label: "None" },
];

/** The damage filter above the list. It keeps the other filters in the URL and goes back to page 1. */
export function EntriesFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("damage_class");
  const value: Choice = options.some((o) => o.value === current) ? (current as Choice) : "all";

  return (
    <Segmented
      aria-label="Damage"
      name="damage_class"
      options={options}
      value={value}
      onValueChange={(next) => {
        const query = new URLSearchParams(params);
        query.delete("page");
        if (next === "all") query.delete("damage_class");
        else query.set("damage_class", next);
        const string = query.toString();
        router.push(string ? `${pathname}?${string}` : pathname);
      }}
    />
  );
}
