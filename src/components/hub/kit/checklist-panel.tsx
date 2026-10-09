"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setChecklistItemAction } from "@/app/hub/checklist/actions";
import type { ChecklistView } from "@/lib/hub/checklist";

type Props = { initial: ChecklistView };

/**
 * The count, the bar and the eight items. A tick shows at once and is saved by
 * the server action. If the save fails the tick goes back and the page says so.
 */
export function ChecklistPanel({ initial }: Props) {
  const [items, setItems] = useState(initial.items);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  const done = items.filter((item) => item.done).length;
  const total = items.length;

  function toggle(id: string, next: boolean) {
    const before = items;
    setFailed(false);
    setItems((current) => current.map((item) => (item.id === id ? { ...item, done: next } : item)));
    startTransition(async () => {
      const result = await setChecklistItemAction(id, next);
      if (!result.ok) {
        setItems(before);
        setFailed(true);
      }
    });
  }

  return (
    <>
      <section aria-labelledby="checklist-count">
        <h2 id="checklist-count" className="text-display-lg text-ink">
          <span className="font-mono tabular">{done}</span> of <span className="font-mono tabular">{total}</span> done
        </h2>
        <p className="mt-1 text-body-sm text-body">Finish while you still have internet.</p>
        <div
          role="progressbar"
          aria-label="Checklist progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="mt-4 flex h-1 w-full max-w-xl overflow-hidden rounded-pill bg-surface-strong"
        >
          {items.map((item, index) => (
            <span key={item.id} className={cn("h-full flex-1", index < done && "bg-primary")} />
          ))}
        </div>
        {failed ? (
          <p role="alert" className="mt-3 text-body-sm text-danger">
            That did not save. Try again.
          </p>
        ) : null}
      </section>

      <ul className="mt-8 flex max-w-3xl flex-col border-t border-hairline-soft">
        {items.map((item) => (
          <li key={item.id} className="flex min-h-16 items-center gap-4 border-b border-hairline-soft py-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              aria-label={item.label}
              onClick={() => toggle(item.id, !item.done)}
              className={cn(
                "hit flex size-6 shrink-0 items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                item.done ? "border-transparent text-ink" : "border-hairline bg-canvas",
              )}
            >
              {item.done ? <CheckIcon aria-hidden="true" className="size-4" /> : null}
            </button>
            <span className={cn("flex-1 text-body-md", item.done ? "text-body" : "font-semibold text-ink")}>{item.label}</span>
            {item.link ? (
              <Link href={item.link.href} className={buttonVariants({ variant: item.link.variant, size: "hub" })}>
                {item.link.label}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
