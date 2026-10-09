"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { routes } from "@/lib/contracts";
import { addDigit, PIN_LENGTH, removeDigit } from "./pin-entry";
import { PinPad } from "./pin-pad";

type SignInFormProps = { names: string[] };

function SignInForm({ names }: SignInFormProps) {
  const router = useRouter();
  const [name, setName] = useState(names[0] ?? "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock() {
    if (busy || pin.length !== PIN_LENGTH || !name) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      if (res.ok) {
        router.replace(routes.responder.toVisit);
        router.refresh();
        return;
      }
      setPin("");
      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as { retry_after?: number } | null;
        const wait = body?.retry_after;
        setError(wait ? `Too many tries. Wait ${wait} seconds and try again.` : "Too many tries. Wait a moment and try again.");
      } else if (res.status === 503) {
        setError("The hub is not set up yet. Ask the MDRRMO staff.");
      } else {
        setError("Wrong name or PIN. Try again.");
      }
    } catch {
      setPin("");
      setError("Could not reach the hub. Check the Wi-Fi and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex min-h-dvh flex-col px-gutter pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        void unlock();
      }}
    >
      <div className="flex flex-1 flex-col gap-6 pt-20">
        <h1 className="text-title-page text-ink">Responder sign in</h1>
        <div className="flex flex-col gap-2">
          <Label htmlFor="who" className="text-caption-strong text-ink">
            Name
          </Label>
          <Select value={name} onValueChange={setName} disabled={busy}>
            <SelectTrigger id="who">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {names.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PinPad
          length={pin.length}
          disabled={busy}
          onDigit={(d) => setPin((p) => addDigit(p, d))}
          onDelete={() => setPin((p) => removeDigit(p))}
        />
        <p role="alert" className="min-h-5 text-center text-body-sm text-danger">
          {error}
        </p>
      </div>
      <Button type="submit" disabled={busy || pin.length !== PIN_LENGTH || !name}>
        Unlock
      </Button>
    </form>
  );
}

export { SignInForm };
