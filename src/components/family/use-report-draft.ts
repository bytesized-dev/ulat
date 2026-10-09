"use client";

import { useSyncExternalStore } from "react";
import { DRAFT_KEY, emptyDraft, loadDraft, saveDraft, type ReportDraft } from "./report-draft";

// The draft lives in sessionStorage, which has no change event inside the same
// tab. This keeps a small store on top of it so every screen that reads the
// draft re-renders when another one writes it. The snapshot is cached by the
// stored string, because useSyncExternalStore needs the same object back until
// the draft really changes.

const listeners = new Set<() => void>();
let cache: { raw: string | null; draft: ReportDraft } | null = null;

// What the server render and the first client render both see.
const serverDraft = emptyDraft();

function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): ReportDraft {
  const raw = readRaw();
  if (cache?.raw !== raw) cache = { raw, draft: loadDraft() };
  return cache.draft;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Merges the change into the saved draft and tells every reader. */
export function updateDraft(change: Partial<ReportDraft>): ReportDraft {
  const draft = saveDraft(change);
  // Keeps the screen right even when the browser refuses to store anything.
  cache = { raw: readRaw(), draft };
  listeners.forEach((listener) => listener());
  return draft;
}

/** The report draft, empty on the server and until the page hydrates. */
export function useReportDraft(): ReportDraft {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverDraft);
}
