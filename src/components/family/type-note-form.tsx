"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MicIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { Textarea } from "@/components/ui/textarea";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { loadDraft, saveDraft } from "./report-draft";
import { draftFromNote, NOTE_LIMIT, readNote } from "./type-note";

const HINTS = ["People", "Hurt or missing", "Damage", "Needs"];

const subscribeNever = () => () => {};

function TypeNoteForm() {
  const router = useRouter();
  const [typed, setTyped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);

  // Coming back from the check screen, the family sees what they wrote. The
  // server has no sessionStorage, so it renders an empty box.
  const saved = useSyncExternalStore(
    subscribeNever,
    () => loadDraft().transcript.slice(0, NOTE_LIMIT),
    () => "",
  );
  const text = typed ?? saved;

  const ready = text.trim().length > 0 && !busy;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const result = await readNote(text);
    if (!result.ok) {
      setError({ message: result.message, retry: result.retry });
      setBusy(false);
      return;
    }
    saveDraft(draftFromNote(loadDraft(), text, result.extract));
    router.push(routes.family.check);
  }

  return (
    <form
      className="flex min-h-dvh flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <TopBar as="p" title="New report" leading={{ kind: "back", href: routes.family.report }} />
      <ProgressSteps step={2} className="px-gutter pb-1.5" />
      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
        <h1 className="text-title-page text-ink">Tell us what happened</h1>
        <div className="flex flex-wrap gap-2">
          {HINTS.map((hint) => (
            <Pill key={hint}>{hint}</Pill>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="note" className="sr-only">
            What happened
          </label>
          <Textarea
            id="note"
            value={text}
            maxLength={NOTE_LIMIT}
            disabled={busy}
            aria-describedby="note-count"
            placeholder="Five of us live here. My son hurt his foot. The roof is gone. We need water and a tarp."
            className="min-h-50 resize-none"
            onChange={(e) => setTyped(e.target.value)}
          />
          <p id="note-count" className="text-right font-mono text-mono-xs text-body tabular">
            {text.length}/{NOTE_LIMIT}
          </p>
          <p role="alert" className="min-h-5 text-body-sm text-danger">
            {error?.message}
          </p>
        </div>
      </main>
      <footer className="flex flex-col gap-2.5 bg-canvas px-gutter pt-3 pb-7">
        <Button type="submit" disabled={!ready}>
          {busy ? "Reading your note" : error?.retry ? "Try again" : "Continue"}
        </Button>
        <Button asChild variant="tertiary" className="h-11 self-center px-2">
          <Link href={routes.family.voice}>
            <MicIcon aria-hidden="true" />
            Record instead
          </Link>
        </Button>
      </footer>
    </form>
  );
}

export { TypeNoteForm };
