"use client";

import { useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

type FamilyVoiceNoteProps = {
  /** The report id. /api/files serves the family's recording by it. */
  reportId: string;
  hasAudio: boolean;
  transcript: string | null;
  english: string | null;
};

function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// The transcript is in the family's language, the English line is the
// translation. The recording needs the responder session to play.
function FamilyVoiceNote({ reportId, hasAudio, transcript, english }: FamilyVoiceNoteProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [length, setLength] = useState<number | null>(null);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  return (
    <section aria-label="The family's note" className="rounded-xl bg-surface-soft p-4">
      {hasAudio ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "Pause the family's note" : "Play the family's note"}
            className="inline-flex size-11 items-center justify-center rounded-full bg-ink text-canvas outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {playing ? <PauseIcon aria-hidden="true" className="size-4" /> : <PlayIcon aria-hidden="true" className="size-4" />}
          </button>
          {length !== null ? <span className="font-mono text-mono-sm text-muted-text">{clock(length)}</span> : null}
          <audio
            ref={audio}
            src={`/api/files/${reportId}`}
            preload="metadata"
            onLoadedMetadata={(e) => setLength(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        </div>
      ) : null}
      {transcript ? <p className={hasAudio ? "mt-3 text-body-md text-ink" : "text-body-md text-ink"}>{transcript}</p> : null}
      {english ? <p className="mt-3 text-body-sm text-body">{english}</p> : null}
    </section>
  );
}

export { FamilyVoiceNote };
