"use client";

import { useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import type { ReportDraft } from "./report-draft";
import { voiceAudioUrl } from "./voice-audio";
import { formatTimer, progressStep } from "./voice-note";
import { cn } from "@/lib/utils";

// Widths for 0 to 12 twelfths. Full class names, so Tailwind sees each one.
const FILLS = ["w-0", "w-1/12", "w-2/12", "w-3/12", "w-4/12", "w-5/12", "w-6/12", "w-7/12", "w-8/12", "w-9/12", "w-10/12", "w-11/12", "w-full"];

type WhatWeHeardSheetProps = {
  open: boolean;
  draft: ReportDraft;
  onClose: () => void;
};

// The player only shows when this phone still holds the recording. The words
// and the translation come from the draft, so they show either way.
function Player({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [length, setLength] = useState(0);
  const [at, setAt] = useState(0);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  // A browser recording has no length in its header, so it reports Infinity.
  // Seeking far past the end makes the browser work out the real length.
  function onMetadata(el: HTMLAudioElement) {
    if (Number.isFinite(el.duration)) setLength(el.duration);
    else el.currentTime = 1e101;
  }

  function onTime(el: HTMLAudioElement) {
    if (el.currentTime > 1e100 || (length === 0 && Number.isFinite(el.duration) && el.currentTime >= el.duration)) {
      if (Number.isFinite(el.duration)) setLength(el.duration);
      el.currentTime = 0;
      setAt(0);
      return;
    }
    setAt(el.currentTime);
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-dark text-canvas outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {playing ? <PauseIcon aria-hidden="true" className="size-4 fill-current" /> : <PlayIcon aria-hidden="true" className="size-4 fill-current" />}
      </button>
      <div
        role="progressbar"
        aria-label="Playback"
        aria-valuemin={0}
        aria-valuemax={Math.round(length)}
        aria-valuenow={Math.round(at)}
        className="h-1 flex-1 overflow-hidden rounded-pill bg-surface-strong"
      >
        <div className={cn("h-full rounded-pill bg-ink transition-[width] duration-200", FILLS[progressStep(at, length)])} />
      </div>
      <span className="font-mono text-mono-sm text-muted-text tabular">{formatTimer((playing || at > 0 ? at : length) * 1000)}</span>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => onMetadata(event.currentTarget)}
        onTimeUpdate={(event) => onTime(event.currentTarget)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setAt(0);
        }}
      />
    </div>
  );
}

function Heard({ draft }: { draft: ReportDraft }) {
  const [src] = useState(voiceAudioUrl);
  const english = draft.english.trim();
  const original = draft.transcript.trim();

  return (
    <>
      {src ? <Player src={src} /> : null}
      {original ? <p className="text-body-md text-ink">{original}</p> : null}
      {english && english !== original ? (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-soft p-4">
          <p className="text-body-sm text-body">English</p>
          <p className="text-body-md text-ink">{english}</p>
        </div>
      ) : null}
      <SheetClose asChild>
        <Button>Done</Button>
      </SheetClose>
    </>
  );
}

function WhatWeHeardSheet({ open, draft, onClose }: WhatWeHeardSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      {open ? (
        <SheetContent title="What we heard">
          <Heard draft={draft} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

export { WhatWeHeardSheet };
