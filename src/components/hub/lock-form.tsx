"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StaffSignIn } from "@/lib/contracts";
import { cn } from "@/lib/utils";

const staffAuthUrl = "/api/auth/staff";

const TooManyTries = z.object({ retry_after: z.number().int().positive() });

type LockFormProps = {
  /** A path inside /hub, already checked by safeNext. */
  next: string;
};

/**
 * The locked screen. Opening it locks the hub: it clears the staff cookie, so
 * the Lock hub link in the sidebar locks too and the back button can't skip the PIN.
 */
export function LockForm({ next }: LockFormProps) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The PIN is not sent before the cookie is gone, or the sign out could remove the new session.
  const locked = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    locked.current = fetch(staffAuthUrl, { method: "DELETE" }).catch(() => null);
  }, []);

  const valid = StaffSignIn.safeParse({ pin }).success;

  async function unlock() {
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    try {
      await locked.current;
      const res = await fetch(staffAuthUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(StaffSignIn.parse({ pin })),
      });
      if (res.ok) {
        // A full load, so no page from before the unlock is shown from the browser's cache.
        window.location.assign(next);
        return;
      }
      setPin("");
      if (res.status === 429) {
        const body = TooManyTries.safeParse(await res.json().catch(() => null));
        setError(body.success ? `Too many tries. Wait ${body.data.retry_after} seconds and try again.` : "Too many tries. Wait a moment and try again.");
      } else if (res.status === 503) {
        setError("The hub is not set up yet.");
      } else {
        setError("Wrong PIN. Try again.");
      }
    } catch {
      setPin("");
      setError("Could not reach the hub. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-dark px-gutter text-canvas">
      <form
        className="flex w-full max-w-sm flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void unlock();
        }}
      >
        <p className="text-title-md font-bold">Ulat</p>
        <h1 className="mb-1 text-display-lg">Hub locked</h1>
        <div>
          <Label htmlFor="pin" className="sr-only">
            Staff PIN
          </Label>
          <Input
            id="pin"
            name="pin"
            size="hub"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={8}
            placeholder="Staff PIN"
            value={pin}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "pin-error" : undefined}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="h-13 rounded-pill border-transparent bg-surface-dark-elevated text-canvas placeholder:text-muted-soft"
          />
          {/* Always in the page so a screen reader announces the text when it appears, but it takes no room until then. */}
          <p id="pin-error" role="alert" className={cn("px-1 text-body-sm text-danger", error ? "mt-2" : "h-0 overflow-hidden")}>
            {error}
          </p>
        </div>
        <Button type="submit" disabled={busy || !valid} className="h-13 w-full">
          Unlock
        </Button>
      </form>
    </main>
  );
}
