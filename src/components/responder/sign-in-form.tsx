"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/lib/contracts";

function SignInForm() {
  const router = useRouter();
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A failed try clears the password, so the cursor goes back into it once the
  // field is enabled again.
  useEffect(() => {
    if (!busy && error) passwordRef.current?.focus();
  }, [busy, error]);

  async function signIn() {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.replace(routes.responder.toVisit);
        router.refresh();
        return;
      }
      setPassword("");
      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as { retry_after?: number } | null;
        const wait = body?.retry_after;
        setError(wait ? `Too many tries. Wait ${wait} seconds and try again.` : "Too many tries. Wait a moment and try again.");
      } else {
        setError("Wrong email or password. Try again.");
      }
    } catch {
      setPassword("");
      setError("Could not reach the hub. Check the Wi-Fi and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-gutter pb-7">
      <form
        className="mx-auto flex w-full max-w-sm flex-col gap-7 pt-19"
        onSubmit={(e) => {
          e.preventDefault();
          void signIn();
        }}
      >
        <h1 className="text-title-page text-ink">Responder sign in</h1>
        <div className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-3 pb-2">
            <Label htmlFor="email" className="text-body-sm font-semibold text-ink">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label htmlFor="password" className="text-body-sm font-semibold text-ink">
              Password
            </Label>
            <div className="relative">
              <Input
                ref={passwordRef}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-14"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              <Button
                type="button"
                variant="tertiary"
                size="icon"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-text hover:text-ink"
                onClick={() => setShowPassword((shown) => !shown)}
                disabled={busy}
              >
                {showPassword ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
              </Button>
            </div>
          </div>
          <p role="alert" className="min-h-5 text-body-sm text-danger">
            {error}
          </p>
          <Button type="submit" disabled={busy || !email.trim() || !password}>
            {busy ? "Signing in" : "Sign in"}
          </Button>
        </div>
      </form>
    </main>
  );
}

export { SignInForm };
