"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyboardIcon, MicIcon, MicOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconPlate } from "@/components/ui/icon-plate";
import { Pill } from "@/components/ui/pill";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { TopBar } from "@/components/ui/top-bar";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/contracts";
import { applyExtract, loadDraft } from "./report-draft";
import { updateDraft } from "./use-report-draft";
import { useReducedMotion } from "./use-reduced-motion";
import { useVoiceRecorder } from "./use-voice-recorder";
import { formatTimer, MAX_NOTE_SECONDS, readVoiceNote } from "./voice-note";
import { VoiceWaveform } from "./voice-waveform";

const HINTS = ["People", "Hurt or missing", "Damage", "Needs"];

// One screen with five states. Ready is where it starts. Recording, reading,
// unclear (we could not hear it) and blocked (microphone off) follow from what
// the family does and what the hub answers.
type Phase = "ready" | "recording" | "reading" | "unclear" | "blocked";

function MicButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-26 items-center justify-center rounded-full bg-primary text-primary-foreground ring-14 ring-primary-soft outline-none transition-colors hover:bg-primary-active active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-16 focus-visible:outline-primary"
    >
      <MicIcon aria-hidden="true" className="size-9" />
    </button>
  );
}

function TypeInstead({ variant = "tertiary" }: { variant?: "tertiary" | "secondary" }) {
  return (
    <Button asChild variant={variant} className={cn(variant === "tertiary" && "h-11 self-center px-2")}>
      <Link href={routes.family.type}>
        {variant === "tertiary" ? <KeyboardIcon aria-hidden="true" /> : null}
        Type instead
      </Link>
    </Button>
  );
}

function VoiceNoteScreen() {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("ready");
  const [transcript, setTranscript] = useState<string | null>(null);

  const recorder = useVoiceRecorder({
    onFinish: async (audio) => {
      setTranscript(null);
      setPhase("reading");
      const result = await readVoiceNote(audio);
      if (!result.ok) {
        setPhase("unclear");
        return;
      }
      // Saved now, so Back from the check screen finds the note again.
      updateDraft(applyExtract(loadDraft(), result.extract));
      setTranscript(result.extract.transcript);
    },
  });

  async function begin() {
    const result = await recorder.start();
    setPhase(result === "recording" ? "recording" : result === "blocked" ? "blocked" : "unclear");
  }

  function cancel() {
    recorder.cancel();
    setPhase("ready");
  }

  const bar =
    phase === "recording" ? (
      <TopBar as="p" title="New report" leading={{ kind: "close", label: "Cancel recording", onClick: cancel }} />
    ) : phase === "reading" ? (
      <TopBar as="p" title="New report" />
    ) : (
      <TopBar as="p" title="New report" leading={{ kind: "back", href: routes.family.report }} />
    );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      {bar}
      <ProgressSteps step={2} className="px-gutter pb-1.5" />

      {phase === "ready" ? (
        <>
          <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
            <div className="flex flex-col gap-2">
              <h1 className="text-title-page text-ink">Tell us what happened</h1>
              <p className="text-body-sm text-body">Up to {MAX_NOTE_SECONDS} seconds. Any language.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {HINTS.map((hint) => (
                <Pill key={hint}>{hint}</Pill>
              ))}
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-5">
              <MicButton label="Start recording" onClick={() => void begin()} />
              <p className="text-body-md font-semibold text-ink">Tap to record</p>
            </div>
          </main>
          <footer className="flex flex-col px-gutter pt-3 pb-7">
            <TypeInstead />
          </footer>
        </>
      ) : null}

      {phase === "recording" ? (
        <>
          <main className="flex flex-1 flex-col items-center gap-7 px-gutter pt-11 pb-7">
            <Pill dot="danger">Recording</Pill>
            <div className="flex flex-col items-center gap-3">
              <p role="timer" className="font-mono text-mono-xl tabular text-ink">
                {formatTimer(recorder.elapsedMs)}
              </p>
              <p className="text-body-sm text-body">of {formatTimer(MAX_NOTE_SECONDS * 1000)}</p>
            </div>
            <VoiceWaveform levels={recorder.levels} still={reducedMotion} />
          </main>
          <footer className="flex flex-col items-center gap-3 px-gutter pt-3 pb-7">
            <button
              type="button"
              aria-label="Stop and send"
              onClick={recorder.stop}
              className="flex size-20 items-center justify-center rounded-full bg-surface-strong outline-none transition-colors hover:bg-hairline active:bg-hairline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span aria-hidden="true" className="size-7 rounded-sm bg-danger" />
            </button>
            <p aria-hidden="true" className="text-body-md font-semibold text-ink">
              Stop
            </p>
          </footer>
        </>
      ) : null}

      {phase === "reading" ? (
        <>
          <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={cn("size-5.5 shrink-0 rounded-full border-2 border-primary", transcript === null && "animate-spin border-surface-strong border-t-primary")}
              />
              <h1 className="text-title-page text-ink">Reading your note</h1>
            </div>
            {transcript !== null ? (
              <div className="flex flex-col gap-1 rounded-lg bg-surface-soft p-4">
                <p className="text-body-sm text-body">We heard</p>
                <p className="text-body-md text-ink">{transcript}</p>
              </div>
            ) : null}
            <p role="status" className="sr-only">
              {transcript === null ? "Reading your note" : "We heard your note"}
            </p>
          </main>
          <footer className="flex flex-col px-gutter pt-3 pb-7">
            {transcript !== null ? (
              <Button asChild variant="tertiary" className="h-11 self-center px-2">
                <Link href={routes.family.check}>
                  Open report
                </Link>
              </Button>
            ) : null}
          </footer>
        </>
      ) : null}

      {phase === "unclear" ? (
        <>
          <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
            <div className="flex flex-col gap-2">
              <h1 className="text-title-page text-ink">We couldn&apos;t hear that</h1>
              <p className="text-body-sm text-body">Try again closer to the phone.</p>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-5">
              <MicButton label="Record again" onClick={() => void begin()} />
              <p className="text-body-md font-semibold text-ink">Record again</p>
            </div>
          </main>
          <footer className="flex flex-col px-gutter pt-3 pb-7">
            <TypeInstead />
          </footer>
        </>
      ) : null}

      {phase === "blocked" ? (
        <>
          <main className="flex flex-1 flex-col gap-5 px-gutter pt-5 pb-7">
            <IconPlate>
              <MicOffIcon />
            </IconPlate>
            <div className="flex flex-col gap-2">
              <h1 className="text-title-page text-ink">Microphone is off</h1>
              <p className="text-body-sm text-body">Allow it in your browser settings, then try again.</p>
            </div>
          </main>
          <footer className="flex flex-col gap-2.5 px-gutter pt-3 pb-7">
            <Button onClick={() => void begin()}>Try again</Button>
            <TypeInstead variant="secondary" />
          </footer>
        </>
      ) : null}
    </div>
  );
}

export { VoiceNoteScreen };
