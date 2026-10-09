"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-auth flex-col justify-center gap-4 px-gutter py-12">
      <h1 className="text-heading font-medium">Something went wrong</h1>
      <p className="text-body text-text-2">Try again. If it keeps happening, tell the hub staff.</p>
      <Button type="button" variant="outline" className="self-start" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
