"use client";

import { MicIcon } from "lucide-react";
import type { DeskRecent } from "@/lib/hub/desk";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { slipHousehold } from "./code-slip";
import { useDesk, type VoicePhase } from "./desk-context";
import { formatTimer, MAX_NOTE_SECONDS } from "./desk-voice";

const micButton =
  "flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ring-8 ring-primary-soft outline-none transition-colors hover:bg-primary-active active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-primary";

const IDLE_TEXT: Record<Exclude<VoicePhase, "recording" | "reading">, { title: string; line: string }> = {
  idle: { title: "Record their note", line: "AI fills the form" },
  done: { title: "Record again", line: "AI fills the form" },
  unclear: { title: "We couldn't hear that", line: "Record again" },
  blocked: { title: "Microphone is off", line: "Allow it in the browser, then try again" },
};

function VoiceCard() {
  const { voice, startNote, stopNote, cancelNote } = useDesk();
  const { phase } = voice;

  return (
    <section aria-label="Voice note" className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {phase === "recording" ? (
          <button
            type="button"
            aria-label="Stop and read the note"
            onClick={stopNote}
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-strong outline-none transition-colors hover:bg-hairline active:bg-hairline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="size-5 rounded-sm bg-danger" />
          </button>
        ) : phase === "reading" ? (
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center">
            <span className="size-6 animate-spin rounded-full border-2 border-surface-strong border-t-primary motion-reduce:animate-none" />
          </span>
        ) : (
          <button type="button" aria-label="Record their voice note" onClick={() => void startNote()} className={micButton}>
            <MicIcon aria-hidden="true" className="size-6" />
          </button>
        )}
        <div className="flex min-w-0 flex-col">
          {phase === "recording" ? (
            <>
              <b className="text-body-md font-semibold text-ink">Recording</b>
              <span role="timer" className="font-mono text-mono-sm text-body tabular">
                {formatTimer(voice.elapsedMs)} of {formatTimer(MAX_NOTE_SECONDS * 1000)}
              </span>
            </>
          ) : phase === "reading" ? (
            <b className="text-body-md font-semibold text-ink">Reading the note</b>
          ) : (
            <>
              <b className="text-body-md font-semibold text-ink">{IDLE_TEXT[phase].title}</b>
              <span className="text-caption text-body">{IDLE_TEXT[phase].line}</span>
            </>
          )}
        </div>
      </div>
      {phase === "recording" ? (
        <Button type="button" variant="tertiary" size="hub" onClick={cancelNote} className="self-start">
          Cancel
        </Button>
      ) : null}
      {phase === "done" ? (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-soft p-4">
          <p className="text-caption text-body">We heard</p>
          <p className="text-body-sm text-ink">{voice.transcript}</p>
          {voice.unsure.length > 0 ? <p className="pt-1 text-caption text-body">Check: {voice.unsure.join(", ")}</p> : null}
        </div>
      ) : null}
      <p role="status" className="sr-only">
        {phase === "reading" ? "Reading the note" : phase === "done" ? "We heard the note" : phase === "unclear" ? "We couldn't hear that" : ""}
      </p>
    </section>
  );
}

function CodeSlip() {
  const { slip, printAgain } = useDesk();
  if (!slip) return null;
  return (
    <section aria-label="Code slip" className="flex flex-col items-center gap-2 rounded-xl bg-surface-soft p-6 text-center">
      <p className="text-caption text-body">Code slip</p>
      <p className="font-mono text-mono-lg text-ink" aria-label={`Code ${slip.code.split("").join(" ")}`}>
        {slip.code}
      </p>
      <p className="text-body-sm font-semibold text-ink">{slipHousehold(slip.name)}</p>
      <Button type="button" variant="tertiary" size="hub" onClick={printAgain}>
        Print again
      </Button>
    </section>
  );
}

function Recent({ items }: { items: DeskRecent[] }) {
  return (
    <section aria-labelledby="desk-recent" className="flex flex-col gap-3">
      <h2 id="desk-recent" className="text-title-md text-ink">
        Recent
      </h2>
      {items.length === 0 ? (
        <p className="text-body-sm text-body">Nothing filed yet</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={`${item.kind}-${item.at}-${item.label}`} className="flex min-h-11 items-center justify-between gap-3 border-b border-hairline-soft text-body-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                {item.kind === "report" ? <span className="font-mono text-mono-sm text-ink">{item.code}</span> : null}
                <span className={cn("truncate text-body")}>{item.label}</span>
              </span>
              <time dateTime={item.at} className="shrink-0 font-mono text-mono-xs text-body">
                {formatTime(item.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The right rail: the voice note, the code slip once a report is saved, and what the desk filed last. */
export function DeskRail({ recent }: { recent: DeskRecent[] }) {
  const { mode } = useDesk();
  return (
    <div className="flex flex-col gap-9">
      {mode === "household" ? <VoiceCard /> : null}
      <CodeSlip />
      <Recent items={recent} />
    </div>
  );
}
