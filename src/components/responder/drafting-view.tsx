"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { routes } from "@/lib/contracts";
import { useLiveEvents } from "@/lib/live/use-live-events";
import { cn } from "@/lib/utils";
import { draftSteps, isDrafted, type AiDraft } from "./check-draft";

type DraftingViewProps = { entryId: string };

type Progress = { photos: number; hasNote: boolean; drafted: boolean };

/** How long to wait for the events stream before reading the entry anyway. */
const STREAM_WAIT_MS = 2000;

// The real model can take up to 60 seconds and POST /api/entries does not wait for it.
// The stream is opened first, then the entry is read, so entry.drafted cannot be missed.
// Any non-null ai_class counts as drafted, whether it came from the read or the event.
function DraftingView({ entryId }: DraftingViewProps) {
  const { latest, connected } = useLiveEvents();
  const [progress, setProgress] = useState<Progress>({ photos: 0, hasNote: false, drafted: false });
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const wasConnected = useRef(false);

  const read = useCallback(async () => {
    try {
      const res = await fetch(`/api/entries/${entryId}`, { cache: "no-store" });
      if (!res.ok) return setFailed(true);
      const body = (await res.json()) as {
        entry: { note_path: string | null };
        photos: unknown[];
        ai: Pick<AiDraft, "damage_class">;
      };
      setFailed(false);
      setProgress({ photos: body.photos.length, hasNote: body.entry.note_path !== null, drafted: isDrafted(body.ai) });
    } catch {
      setFailed(true);
    }
  }, [entryId]);

  // First read: as soon as the stream is open, or after a short wait when it is slow to open.
  useEffect(() => {
    if (started.current) return;
    if (connected) {
      started.current = true;
      queueMicrotask(() => void read());
      return;
    }
    const timer = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      void read();
    }, STREAM_WAIT_MS);
    return () => clearTimeout(timer);
  }, [connected, read]);

  // The stream does not replay what was missed, so read again when it comes back.
  useEffect(() => {
    if (connected && wasConnected.current) queueMicrotask(() => void read());
    wasConnected.current = connected;
  }, [connected, read]);

  useEffect(() => {
    if (latest?.type === "entry.drafted" && latest.entry_id === entryId) queueMicrotask(() => void read());
  }, [latest, entryId, read]);

  const steps = draftSteps(progress);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="grid h-14 grid-cols-3 items-center px-gutter">
        <span />
        <p className="justify-self-center text-title-sm text-ink">Hub draft</p>
        <span />
      </header>
      <main className="flex flex-1 flex-col gap-6 px-gutter pt-5 pb-6">
        <h1 className="text-title-page text-ink">Drafting the entry</h1>
        <ul aria-live="polite" className="flex flex-col">
          {steps.map((step) => (
            <li key={step.label} className="flex min-h-13 items-center gap-3 border-b border-hairline-soft last:border-b-0">
              {step.state === "done" ? (
                <span className="flex size-5.5 items-center justify-center rounded-full bg-surface-dark text-canvas">
                  <CheckIcon aria-hidden="true" className="size-3.5" />
                </span>
              ) : step.state === "active" ? (
                <span aria-hidden="true" className="size-5.5 animate-spin rounded-full border-2 border-hairline border-t-primary" />
              ) : (
                <span aria-hidden="true" className="size-5.5 rounded-full border-2 border-hairline" />
              )}
              <span className={cn("text-body-md", step.state === "waiting" ? "text-muted-soft" : "text-ink")}>{step.label}</span>
            </li>
          ))}
        </ul>
        <p role="alert" className="min-h-5 text-body-sm text-danger">
          {failed ? "Could not read the draft. Check the Wi-Fi and it will try again." : null}
        </p>
      </main>
      <footer className="flex flex-col gap-1 px-gutter pb-6">
        {progress.drafted ? (
          <Link href={routes.responder.check(entryId)} className={cn(buttonVariants(), "w-full")}>
            Open draft
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(buttonVariants({ variant: "secondary" }), "w-full text-muted-soft")}>
            Open draft
          </span>
        )}
        <Link href={routes.responder.toVisit} className={cn(buttonVariants({ variant: "tertiary" }), "w-full")}>
          Next house
        </Link>
      </footer>
    </div>
  );
}

export { DraftingView };
