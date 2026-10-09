"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon, PauseIcon, PlayIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration, MAX_NOTE_SECONDS } from "./capture";

type NoteRecorderProps = {
  note: Blob | null;
  seconds: number;
  onChange: (note: Blob | null, seconds: number) => void;
};

const BAR_HEIGHTS = ["h-2", "h-3", "h-4", "h-6", "h-8"];

// Decorative bars. The recording is not analysed, so the shape is fixed.
const BARS = Array.from({ length: 32 }, (_, i) => BAR_HEIGHTS[Math.round(Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37)) * 4)]);

function pickMime(): string | undefined {
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
}

function NoteRecorder({ note, seconds, onChange }: NoteRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const asking = useRef(false);
  const unmounted = useRef(false);

  // The object URL is made and revoked in the same effect, so a render that
  // React throws away never leaves one behind.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return queueMicrotask(() => setUrl(null));
    const made = URL.createObjectURL(note);
    queueMicrotask(() => setUrl(made));
    return () => URL.revokeObjectURL(made);
  }, [note]);

  // Leaving the screen mid-recording stops the recorder and releases the mic.
  // Its onstop is cleared first, because it would set state on a gone component.
  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      if (timer.current) clearInterval(timer.current);
      const rec = recorder.current;
      if (!rec) return;
      rec.onstop = null;
      if (rec.state !== "inactive") rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    // A second tap while the permission prompt is open would start a second recorder.
    if (asking.current) return;
    asking.current = true;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // The responder left while the prompt was open. Nothing is recording, so
      // the mic is released here.
      if (unmounted.current) return stream.getTracks().forEach((t) => t.stop());
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        setRecording(false);
        const length = Math.min((Date.now() - startedAt) / 1000, MAX_NOTE_SECONDS);
        onChange(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }), length);
      };
      rec.start();
      recorder.current = rec;
      setRecording(true);
      setElapsed(0);
      timer.current = setInterval(() => {
        const s = (Date.now() - startedAt) / 1000;
        setElapsed(s);
        if (s >= MAX_NOTE_SECONDS) rec.stop();
      }, 250);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Microphone is off. Allow it in your browser settings to record a note."
          : name === "NotFoundError"
            ? "No microphone found on this phone."
            : "Could not start the microphone. Try again.",
      );
    } finally {
      asking.current = false;
    }
  }

  function recordAgain() {
    audio.current?.pause();
    setPlaying(false);
    onChange(null, 0);
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play();
  }

  if (!note) {
    return (
      <div className="flex flex-col gap-2">
        <Button type="button" variant="secondary" onClick={recording ? stop : start}>
          {recording ? <SquareIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />}
          {recording ? `Stop, ${formatDuration(elapsed)}` : "Record a note"}
        </Button>
        <p className="text-body-sm text-body">Up to {MAX_NOTE_SECONDS} seconds.</p>
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface-soft p-4">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          aria-label={playing ? "Pause your note" : "Play your note"}
          onClick={toggle}
          className="rounded-full bg-surface-dark text-canvas hover:bg-surface-dark-elevated"
        >
          {playing ? <PauseIcon aria-hidden="true" /> : <PlayIcon aria-hidden="true" />}
        </Button>
        <div aria-hidden="true" className="flex h-8 flex-1 items-center justify-between">
          {BARS.map((h, i) => (
            <span key={i} className={`w-0.5 rounded-pill bg-ink ${h}`} />
          ))}
        </div>
        <span className="font-mono text-mono-sm text-body">{formatDuration(seconds)}</span>
      </div>
      {url ? (
        <audio ref={audio} src={url} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      ) : null}
      <Button type="button" variant="tertiary" size="hub" onClick={recordAgain}>
        Record again
      </Button>
    </div>
  );
}

export { NoteRecorder };
