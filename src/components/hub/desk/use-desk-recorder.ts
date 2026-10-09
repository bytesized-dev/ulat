"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_NOTE_SECONDS, micFailure, pickMimeType } from "./desk-voice";

// Records one note on the laptop with MediaRecorder. It stops itself at 30
// seconds and reports the time. The screen decides what each result looks like.

const TICK_MS = 200;

type Session = { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; timer: number; cancelled: boolean };

/** "busy" means a recording or a microphone prompt is already under way, "cancelled" that cancel ran during the prompt. */
export type StartResult = "recording" | "blocked" | "failed" | "busy" | "cancelled";

export function useDeskRecorder({ onFinish }: { onFinish: (audio: Blob) => void }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const session = useRef<Session | null>(null);
  // True while the browser waits for the person to allow the microphone.
  const asking = useRef(false);
  const abandoned = useRef(false);

  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  });

  const release = useCallback((s: Session) => {
    window.clearInterval(s.timer);
    s.stream.getTracks().forEach((track) => track.stop());
    if (session.current === s) session.current = null;
  }, []);

  const start = useCallback(async (): Promise<StartResult> => {
    if (session.current || asking.current) return "busy";
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return "blocked";

    let stream: MediaStream;
    asking.current = true;
    abandoned.current = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      return abandoned.current ? "cancelled" : micFailure(error);
    } finally {
      asking.current = false;
    }

    if (abandoned.current) {
      stream.getTracks().forEach((track) => track.stop());
      return "cancelled";
    }

    try {
      const mimeType = pickMimeType((mime) => MediaRecorder.isTypeSupported(mime));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const startedAt = Date.now();
      const s: Session = { recorder, stream, chunks: [], cancelled: false, timer: 0 };

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
        if (elapsed >= MAX_NOTE_SECONDS * 1000 && recorder.state === "recording") recorder.stop();
      }, TICK_MS);

      setElapsedMs(0);
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
    if (asking.current) abandoned.current = true;
    const s = session.current;
    if (!s) return;
    s.cancelled = true;
    if (s.recorder.state === "recording") s.recorder.stop();
    else release(s);
  }, [release]);

  // Leaving the page must turn the microphone off.
  useEffect(() => cancel, [cancel]);

  return { start, stop, cancel, elapsedMs };
}
