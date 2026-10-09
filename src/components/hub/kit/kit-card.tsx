import * as React from "react";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";
import type { SetupPill } from "@/lib/hub/setup";

type KitCardProps = {
  title: string;
  /** The status pill in the corner. */
  pill?: SetupPill;
  /** The id other pages link to, such as responders. */
  id?: string;
  className?: string;
  children: React.ReactNode;
};

/** One card of the Kit setup grid: a heading, a status pill and the rows below. */
export function KitCard({ title, pill, id, className, children }: KitCardProps) {
  return (
    <section id={id} className={cn("flex flex-col gap-3 rounded-xl border border-hairline p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-title-md text-ink">{title}</h2>
        {pill ? <Pill dot={pill.tone}>{pill.label}</Pill> : null}
      </div>
      {children}
    </section>
  );
}

/** A label on the left and its value on the right. Rows go inside a KitRows. */
export function KitRow({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-t border-hairline-soft">
      <dt className="text-body-sm text-body">{label}</dt>
      <dd className={cn("text-right text-body-sm font-medium text-ink", mono && "font-mono tabular")}>{children}</dd>
    </div>
  );
}

export function KitRows({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("flex flex-col", className)}>{children}</dl>;
}
