"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import type { Need } from "@/lib/contracts";
import {
  applyExtract,
  emptyHousehold,
  emptySafe,
  saveCheckin,
  saveReport,
  toNewReport,
  toSafeCheckin,
  uncertainLabels,
  validateHousehold,
  validateSafe,
  type HeardNote,
  type HouseholdErrors,
  type HouseholdForm,
  type SafeErrors,
  type SafeForm,
} from "./desk-report";
import { printSlip } from "./code-slip";
import { readVoiceNote } from "./desk-voice";
import { useDeskRecorder } from "./use-desk-recorder";

// The help desk page has a form in the main column and the voice note, the
// code slip and the recent list in the rail. One provider holds what they share.

export type DeskMode = "household" | "safe";
export type VoicePhase = "idle" | "recording" | "reading" | "done" | "unclear" | "blocked";
export type Notice = { tone: "ok" | "error"; text: string };

type DeskState = {
  mode: DeskMode;
  household: HouseholdForm;
  householdErrors: HouseholdErrors;
  safe: SafeForm;
  safeErrors: SafeErrors;
  saving: boolean;
  notice: Notice | null;
  slip: { code: string; name: string } | null;
  voice: { phase: VoicePhase; transcript: string; unsure: string[]; elapsedMs: number };
};

type DeskActions = {
  setMode: (mode: DeskMode) => void;
  editHousehold: (patch: Partial<HouseholdForm>) => void;
  toggleNeed: (need: z.infer<typeof Need>) => void;
  editSafe: (patch: Partial<SafeForm>) => void;
  save: () => Promise<void>;
  startNote: () => Promise<void>;
  stopNote: () => void;
  cancelNote: () => void;
  printAgain: () => void;
};

const DeskContext = createContext<(DeskState & DeskActions) | null>(null);

export function useDesk() {
  const value = useContext(DeskContext);
  if (!value) throw new Error("useDesk needs a DeskProvider");
  return value;
}

/** Moves focus to the first field that failed, so a keyboard user lands on it. */
function focusFirst(ids: string[]) {
  document.getElementById(ids[0])?.focus();
}

const FIELD_IDS = { name: "desk-name", barangay: "desk-barangay", people: "desk-people", hurt: "desk-hurt", missing: "desk-missing", staying_at: "desk-staying" } as const;

export function DeskProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mode, setModeState] = useState<DeskMode>("household");
  const [household, setHousehold] = useState<HouseholdForm>(emptyHousehold);
  const [householdErrors, setHouseholdErrors] = useState<HouseholdErrors>({});
  const [safe, setSafe] = useState<SafeForm>(emptySafe);
  const [safeErrors, setSafeErrors] = useState<SafeErrors>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [slip, setSlip] = useState<DeskState["slip"]>(null);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [heard, setHeard] = useState<HeardNote | null>(null);
  const [transcript, setTranscript] = useState("");
  const [unsure, setUnsure] = useState<string[]>([]);
  // A note read after staff moved to the safe list side belongs to nothing, so it is dropped.
  const modeRef = useRef<DeskMode>("household");

  const { start, stop, cancel, elapsedMs } = useDeskRecorder({
    onFinish: async (audio) => {
      setPhase("reading");
      const result = await readVoiceNote(audio);
      if (modeRef.current !== "household") return;
      if (!result.ok) {
        setHeard(null);
        setPhase("unclear");
        return;
      }
      const { extract } = result;
      setHousehold((form) => applyExtract(form, extract));
      setHouseholdErrors({});
      setHeard({ transcript: extract.transcript, english: extract.english, language: extract.language });
      setTranscript(extract.transcript);
      setUnsure(uncertainLabels(extract));
      setPhase("done");
    },
  });

  const setMode = useCallback(
    (next: DeskMode) => {
      if (next !== "household") cancel();
      modeRef.current = next;
      setModeState(next);
      setNotice(null);
      if (next !== "household") setPhase("idle");
    },
    [cancel],
  );

  const editHousehold = useCallback((patch: Partial<HouseholdForm>) => {
    setHousehold((form) => ({ ...form, ...patch }));
    setHouseholdErrors((errors) => {
      const next = { ...errors };
      for (const key of Object.keys(patch)) delete next[key as keyof HouseholdErrors];
      return next;
    });
    setNotice(null);
  }, []);

  const toggleNeed = useCallback((need: z.infer<typeof Need>) => {
    setHousehold((form) => ({ ...form, needs: form.needs.includes(need) ? form.needs.filter((n) => n !== need) : [...form.needs, need] }));
  }, []);

  const editSafe = useCallback((patch: Partial<SafeForm>) => {
    setSafe((form) => ({ ...form, ...patch }));
    setSafeErrors((errors) => {
      const next = { ...errors };
      for (const key of Object.keys(patch)) delete next[key as keyof SafeErrors];
      return next;
    });
    setNotice(null);
  }, []);

  const save = useCallback(async () => {
    if (saving) return;
    setNotice(null);

    if (mode === "household") {
      const errors = validateHousehold(household);
      setHouseholdErrors(errors);
      const failed = Object.keys(errors) as (keyof HouseholdErrors)[];
      if (failed.length > 0) return focusFirst(failed.map((key) => FIELD_IDS[key]));

      setSaving(true);
      const result = await saveReport(toNewReport(household, heard));
      setSaving(false);
      if (!result.ok) return setNotice({ tone: "error", text: result.message });

      setSlip({ code: result.code, name: household.name });
      setHousehold(emptyHousehold());
      setHeard(null);
      setPhase("idle");
      printSlip(result.code, household.name);
      router.refresh();
      return;
    }

    const errors = validateSafe(safe);
    setSafeErrors(errors);
    const failed = Object.keys(errors) as (keyof SafeErrors)[];
    if (failed.length > 0) return focusFirst(failed.map((key) => FIELD_IDS[key]));

    setSaving(true);
    const result = await saveCheckin(toSafeCheckin(safe));
    setSaving(false);
    if (!result.ok) return setNotice({ tone: "error", text: result.message });

    setNotice({ tone: "ok", text: `${safe.name.trim()} is on the safe list` });
    setSafe(emptySafe());
    router.refresh();
  }, [saving, mode, household, heard, safe, router]);

  const startNote = useCallback(async () => {
    const result = await start();
    if (result === "busy" || result === "cancelled") return;
    setPhase(result === "recording" ? "recording" : result === "blocked" ? "blocked" : "unclear");
  }, [start]);

  const cancelNote = useCallback(() => {
    cancel();
    setPhase("idle");
  }, [cancel]);

  const printAgain = useCallback(() => {
    if (slip) printSlip(slip.code, slip.name);
  }, [slip]);

  const value = useMemo(
    () => ({
      mode,
      household,
      householdErrors,
      safe,
      safeErrors,
      saving,
      notice,
      slip,
      voice: { phase, transcript, unsure, elapsedMs },
      setMode,
      editHousehold,
      toggleNeed,
      editSafe,
      save,
      startNote,
      stopNote: stop,
      cancelNote,
      printAgain,
    }),
    [mode, household, householdErrors, safe, safeErrors, saving, notice, slip, phase, transcript, unsure, elapsedMs, stop, setMode, editHousehold, toggleNeed, editSafe, save, startNote, cancelNote, printAgain],
  );

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
}
