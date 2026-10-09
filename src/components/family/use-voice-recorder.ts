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

/**
 * "busy" means a recording or a microphone prompt is already under way, and
 * "cancelled" means cancel ran while the prompt was open. The screen ignores both.
 */
export type StartResult = "recording" | "blocked" | "failed" | "busy" | "cancelled";

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
  // Set when cancel runs during that wait, for example when the person leaves
  // the page before answering. The microphone must not start after that.
  const abandoned = useRef(false);

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
    if (session.current || asking.current) return "busy";
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return "blocked";

    // Made here, inside the tap, because a browser keeps an audio context
    // that starts later asleep, and the waveform would stay flat. The
    // waveform is a nicety, so a browser without Web Audio still records.
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
    } catch {
      context = null;
    }

    let stream: MediaStream;
    asking.current = true;
    abandoned.current = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      void context?.close().catch(() => {});
      return abandoned.current ? "cancelled" : micFailure(error);
    } finally {
      asking.current = false;
    }

    if (abandoned.current) {
      stream.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => {});
      return "cancelled";
    }

    try {
      const mimeType = pickMimeType((mime) => MediaRecorder.isTypeSupported(mime));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      let analyser: AnalyserNode | null = null;
      try {
        if (context) {
          analyser = context.createAnalyser();
          analyser.fftSize = 256;
          context.createMediaStreamSource(stream).connect(analyser);
          void context.resume().catch(() => {});
        }
      } catch {
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
      void context?.close().catch(() => {});
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
    if (asking.current) abandoned.current = true;
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
