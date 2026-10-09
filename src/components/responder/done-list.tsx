import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
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

export type CheckEntry = {
  id: string;
  household_head: string | null;
  ai_need_more: string | null;
  status: "draft" | "needs_review" | "confirmed";
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

function NeedsCheckRow({ entry }: { entry: CheckEntry }) {
  return (
    <Link
      href={routes.responder.check(entry.id)}
      className={`${rowClass} outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-md font-medium text-ink">{nameOf(entry.household_head)}</span>
        <span className="truncate text-body-sm text-body">{entry.ai_need_more ?? "Check the draft"}</span>
      </span>
      <Pill dot="warning">{entry.status === "draft" ? "Draft" : "Unclear"}</Pill>
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

type DoneListProps = { needsCheck: CheckEntry[]; confirmed: DoneEntry[] };

// Drafts first, because they are the only thing here that waits on the
// responder. Confirmed entries are today's, newest first.
export function DoneList({ needsCheck, confirmed }: DoneListProps) {
  return (
    <>
      {needsCheck.length > 0 ? (
        <section className="mt-6" aria-labelledby="needs-check">
          <h2 id="needs-check" className="text-title-md text-ink">
            Needs your check
          </h2>
          <div className="mt-2 flex flex-col">
            {needsCheck.map((e) => (
              <NeedsCheckRow key={e.id} entry={e} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="mt-6" aria-labelledby="confirmed">
        <h2 id="confirmed" className="text-title-md text-ink">
          Confirmed
        </h2>
        <div className="mt-2 flex flex-col">
          {confirmed.map((e) => (
            <ConfirmedRow key={e.id} entry={e} />
          ))}
        </div>
        {confirmed.length === 0 ? <p className="py-8 text-center text-body-md text-body">Nothing confirmed yet today</p> : null}
      </section>
    </>
  );
}
