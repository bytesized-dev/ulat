"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import type { z } from "zod";
import { type CantAssessReason, routes } from "@/lib/contracts";

type Reason = z.infer<typeof CantAssessReason>;

export const REASONS: { value: Reason; label: string }[] = [
  { value: "cant_find", label: "Can't find the house" },
  { value: "no_one_home", label: "No one is home" },
  { value: "road_blocked", label: "Road is blocked" },
  { value: "not_safe", label: "Not safe to enter" },
  { value: "other", label: "Other" },
];

/** What to tell the responder when the cant-assess route says no. */
export function cantAssessError(status: number): string {
  if (status === 401 || status === 403) return "Your session ended. Sign in again.";
  if (status === 409) return "This house was already closed.";
  return "Could not send to the hub. Try again.";
}

type CantAssessSheetProps = { code: string };

function CantAssessSheet({ code }: CantAssessSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("cant_find");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${code}/cant-assess`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason, note: note.trim() || null }),
      });
      if (res.ok) {
        setOpen(false);
        router.push(routes.responder.toVisit);
        router.refresh();
        return;
      }
      setError(cantAssessError(res.status));
    } catch {
      setError("Could not reach the hub. Check the Wi-Fi and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="tertiary" className="w-full">
          Can&apos;t assess
        </Button>
      </SheetTrigger>
      <SheetContent title="Why can't you assess it?">
        <div role="radiogroup" aria-label="Reason" className="flex flex-col">
          {REASONS.map((r) => (
            <label key={r.value} className="hit flex items-center justify-between border-b border-hairline py-4 text-body-md text-ink last:border-b-0">
              {r.label}
              <input
                type="radio"
                name="why"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="size-6 accent-primary"
              />
            </label>
          ))}
        </div>
        <div>
          <label htmlFor="why-note" className="sr-only">
            Note
          </label>
          <Input id="why-note" value={note} maxLength={240} placeholder="Add a note, optional" onChange={(e) => setNote(e.target.value)} />
        </div>
        <p role="alert" className="min-h-5 text-body-sm text-danger">
          {error}
        </p>
        <SheetFooter>
          <Button type="button" disabled={busy} onClick={() => void send()}>
            {busy ? "Sending" : "Send to hub"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export { CantAssessSheet };
