"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { routes } from "@/lib/contracts/routes";
import { cn } from "@/lib/utils";

type AssignFormProps = {
  code: string;
  responders: { id: string; name: string }[];
  /** The responder already sent, if any. */
  assignedTo: string | null;
  /** The responder is on the job. A report they could not assess can go to them again. */
  sent: boolean;
  /** Visited reports are done, so there is nobody to send. */
  done: boolean;
};

const ERRORS: Record<string, string> = {
  bad_responder: "That responder is not on duty.",
  already_done: "This report is already done.",
  not_found: "This report is gone.",
  not_signed_in: "Sign in again to assign.",
};

// Sends a responder through POST /api/reports/[code]/assign, then asks the
// server for a fresh list. Other hub screens hear report.updated themselves.
function AssignForm({ code, responders, assignedTo, sent, done }: AssignFormProps) {
  const router = useRouter();
  const id = useId();
  const [responderId, setResponderId] = useState(assignedTo ?? responders[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;
  const unchanged = sent && responderId === assignedTo;

  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/reports/${code}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responder_id: responderId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(ERRORS[body.error ?? ""] ?? "Could not assign. Try again.");
        return;
      }
      startRefresh(() => router.refresh());
    } catch {
      setError("The hub did not answer. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={assign} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id} className="text-body-sm font-semibold text-ink">
          Assign to
        </Label>
        <Select value={responderId} onValueChange={setResponderId} disabled={done || responders.length === 0}>
          <SelectTrigger id={id} size="hub">
            <SelectValue placeholder="No responders" />
          </SelectTrigger>
          <SelectContent>
            {responders.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="hub" disabled={done || busy || unchanged || !responderId}>
          {busy ? "Assigning" : unchanged ? "Assigned" : "Assign"}
        </Button>
        <Link href={routes.hub.duplicates} className={cn(buttonVariants({ variant: "secondary", size: "hub" }))}>
          Duplicate?
        </Link>
      </div>
      <p role="status" className="text-body-sm text-danger empty:hidden">
        {error}
      </p>
    </form>
  );
}

export { AssignForm };
