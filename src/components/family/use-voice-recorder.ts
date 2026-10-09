"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_NOTE_SECONDS, micFailure, pickMimeType, WAVEFORM_BARS } from "./voice-note";

// Records one note with MediaRecorder. It stops itself at 30 seconds, reports
// the time and keeps a short scrolling history of how loud the microphone is
// for the waveform. The screen decides what each result looks like.

const TICK_MS = 60;
const FLAT = Array.from({ length: WAVEFORM_BARS }, () => 0);

type Session = {
  recorder: MediaRecorder;
  stream: MediaStream;
  context: AudioContext | null;
  chunks: Blob[];
  timer: number;
  cancelled: boolean;
};

export type StartResult = "recording" | "blocked" | "failed";

type Options = {
  /** Called with the finished recording, after stop or at the time limit. Not after cancel. */
  onFinish: (audio: Blob) => void;
};

function useVoiceRecorder({ onFinish }: Options) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>(FLAT);
  const session = useRef<Session | null>(null);
  // True while the browser waits for the person to allow the microphone.
  const asking = useRef(false);

  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  });

  const release = useCallback((s: Session) => {
    window.clearInterval(s.timer);
    s.stream.getTracks().forEach((track) => track.stop());
    void s.context?.close().catch(() => {});
    if (session.current === s) session.current = null;
  }, []);

  const start = useCallback(async (): Promise<StartResult> => {
    if (session.current || asking.current) return "recording";
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return "blocked";

    let stream: MediaStream;
    asking.current = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      return micFailure(error);
    } finally {
      asking.current = false;
    }

    try {
      const mimeType = pickMimeType((mime) => MediaRecorder.isTypeSupported(mime));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      // The waveform is a nicety. A browser without Web Audio still records.
      let context: AudioContext | null = null;
      let analyser: AnalyserNode | null = null;
      try {
        context = new AudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
      } catch {
        context = null;
        analyser = null;
      }
      const samples = new Uint8Array(analyser?.fftSize ?? 0);

      const startedAt = Date.now();
      const s: Session = { recorder, stream, context, chunks: [], cancelled: false, timer: 0 };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) s.chunks.push(event.data);
      };
      recorder.onstop = () => {
        release(s);
        if (!s.cancelled) finish.current(new Blob(s.chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
      };

      s.timer = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setElapsedMs(Math.min(elapsed, MAX_NOTE_SECONDS * 1000));
        if (analyser) {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / samples.length) * 4);
          setLevels((previous) => [...previous.slice(1), level]);
        }
        if (elapsed >= MAX_NOTE_SECONDS * 1000 && recorder.state === "recording") recorder.stop();
      }, TICK_MS);

      setElapsedMs(0);
      setLevels(FLAT);
      session.current = s;
      recorder.start();
      return "recording";
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      return "failed";
    }
  }, [release]);

  /** Ends the recording. The result arrives through onFinish. */
  const stop = useCallback(() => {
    const s = session.current;
    if (s?.recorder.state === "recording") s.recorder.stop();
  }, []);

  /** Throws the recording away and lets go of the microphone. */
  const cancel = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.cancelled = true;
    if (s.recorder.state === "recording") s.recorder.stop();
    else release(s);
  }, [release]);

  // Leaving the page must turn the microphone off.
  useEffect(() => cancel, [cancel]);

  return { start, stop, cancel, elapsedMs, levels };
}

export { useVoiceRecorder };
