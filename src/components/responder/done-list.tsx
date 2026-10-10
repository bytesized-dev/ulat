"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { AppTopBar } from "@/components/ui/app-top-bar";
import { Pill } from "@/components/ui/pill";
import type { StatusDotTone } from "@/components/ui/status-dot";
import { routes } from "@/lib/contracts";
import { formatTime } from "@/lib/time";

export type DoneEntry = {
  id: string;
  household_head: string | null;
  damage_class: "none" | "partial" | "total" | null;
  confirmed_at: string | null;
};

/** An entry the hub holds for staff to look at. The responder can no longer change it. */
export type HeldEntry = {
  id: string;
  household_head: string | null;
  created_at: string;
};

const CLASS_PILL: Record<"none" | "partial" | "total", { label: string; dot: StatusDotTone }> = {
  total: { label: "Totally", dot: "danger" },
  partial: { label: "Partially", dot: "warning" },
  none: { label: "No damage", dot: "muted-soft" },
};

function nameOf(head: string | null): string {
  return head ?? "House with no report";
}

const rowClass = "flex min-h-16 items-center gap-4 border-b border-hairline-soft py-2";

function HeldRow({ entry }: { entry: HeldEntry }) {
  return (
    <Link
      href={routes.responder.confirmed(entry.id)}
      className={`${rowClass} outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-md font-medium text-ink">{nameOf(entry.household_head)}</span>
        <span className="font-mono text-mono-sm text-muted-text">{formatTime(entry.created_at)}</span>
      </span>
      <Pill dot="warning">Second look</Pill>
      <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-muted-soft" />
    </Link>
  );
}

function ConfirmedRow({ entry }: { entry: DoneEntry }) {
  const pill = entry.damage_class ? CLASS_PILL[entry.damage_class] : null;
  return (
    <div className={rowClass}>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-md font-medium text-ink">{nameOf(entry.household_head)}</span>
        {entry.confirmed_at ? (
          <span className="font-mono text-mono-sm text-muted-text">{formatTime(entry.confirmed_at)}</span>
        ) : null}
      </span>
      {pill ? <Pill dot={pill.dot}>{pill.label}</Pill> : null}
    </div>
  );
}

type DoneListProps = { responderName: string; held: HeldEntry[]; confirmed: DoneEntry[] };

/** Keeps entries whose household contains every word typed. A house with no report matches its row name. */
function matches(head: string | null, words: string[]): boolean {
  const text = nameOf(head).toLowerCase();
  return words.every((word) => text.includes(word));
}

// A responder confirms each house on the assess screen, so nothing here waits
// on them. Today's list: entries held for a second look, then confirmed ones,
// newest first. Search narrows all of it by household.
export function DoneList({ responderName, held, confirmed }: DoneListProps) {
  const [query, setQuery] = useState("");
  const words = useMemo(() => query.toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const second = held.filter((e) => matches(e.household_head, words));
  const done = confirmed.filter((e) => matches(e.household_head, words));
  const nothing = second.length + done.length === 0;

  return (
    <>
      <AppTopBar name={responderName} searchLabel="Search reports" searchProps={{ value: query, onChange: (e) => setQuery(e.target.value) }} />
      <main className="flex-1 px-gutter pb-6 pt-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-title-page text-ink">Done</h1>
          <span className="font-mono text-mono-sm text-muted-text">{confirmed.length} today</span>
        </div>
        <section className="mt-6" aria-labelledby="confirmed">
          <h2 id="confirmed" className="text-title-md text-ink">
            Confirmed
          </h2>
          <div className="mt-2 flex flex-col">
            {second.map((e) => (
              <HeldRow key={e.id} entry={e} />
            ))}
            {done.map((e) => (
              <ConfirmedRow key={e.id} entry={e} />
            ))}
          </div>
          {nothing ? (
            <p className="py-8 text-center text-body-md text-body">{words.length > 0 ? "No reports match your search" : "Nothing confirmed yet today"}</p>
          ) : null}
        </section>
      </main>
    </>
  );
}
