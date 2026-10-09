"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { StatusDot } from "@/components/ui/status-dot";
import type { ConfirmedDamageClass, Urgency } from "@/lib/contracts";
import { readPhotoAgain, saveVerdict } from "@/lib/reports/assessment-client";

type VerdictClass = z.infer<typeof ConfirmedDamageClass>;
type UrgencyValue = z.infer<typeof Urgency>;

const CLASS_OPTIONS: { value: VerdictClass; label: string; tone: "success" | "warning" | "danger" }[] = [
  { value: "none", label: "No damage", tone: "success" },
  { value: "partial", label: "Partially damaged", tone: "warning" },
  { value: "total", label: "Totally damaged", tone: "danger" },
];

const URGENCY_OPTIONS: { value: UrgencyValue; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

type AssessmentFormProps = {
  code: string;
  /** What the form starts on: the current verdict, else the AI's reading. The note starts empty, so one person's words are never saved under another's name. */
  damageClass: VerdictClass | null;
  urgency: UrgencyValue | null;
  canRunAgain: boolean;
};

// Staff's own reading of the family photo. It replaces the AI's class and
// urgency on every screen, the responder's phone included, and never changes a
// total. Saves through PATCH /api/reports/[code]/assessment.
function AssessmentForm({ code, damageClass, urgency, canRunAgain }: AssessmentFormProps) {
  const router = useRouter();
  const noteId = useId();
  const [damage, setDamage] = useState<VerdictClass>(damageClass ?? "partial");
  const [level, setLevel] = useState<UrgencyValue>(urgency ?? "medium");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const failed = await saveVerdict(code, { damage_class: damage, urgency: level, note: note.trim() || null });
    setSaving(false);
    if (failed) setError(failed);
    else startRefresh(() => router.refresh());
  }

  async function runAgain() {
    setError(null);
    setSaving(true);
    const failed = await readPhotoAgain(code);
    setSaving(false);
    if (failed) setError(failed);
    else startRefresh(() => router.refresh());
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1">
        <legend className="pb-1 text-body-sm font-semibold text-ink">Damage</legend>
        <div role="radiogroup" aria-label="Damage" className="flex flex-col">
          {CLASS_OPTIONS.map((option) => (
            <label key={option.value} className="hit flex items-center justify-between border-b border-hairline-soft py-2 text-body-sm text-ink last:border-b-0">
              <span className="flex items-center gap-2">
                <StatusDot tone={option.tone} />
                {option.label}
              </span>
              <input
                type="radio"
                name={`damage-${code}`}
                value={option.value}
                checked={damage === option.value}
                onChange={() => setDamage(option.value)}
                className="size-5 accent-primary"
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <p className="text-body-sm font-semibold text-ink">Urgency</p>
        <Segmented aria-label="Urgency" name={`urgency-${code}`} options={URGENCY_OPTIONS} value={level} onValueChange={setLevel} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={noteId} className="text-body-sm font-semibold text-ink">
          Note
        </Label>
        <Input id={noteId} value={note} maxLength={200} placeholder="Optional" onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="hub" disabled={busy}>
          {busy ? "Saving" : "Save assessment"}
        </Button>
        {canRunAgain ? (
          <Button type="button" variant="secondary" size="hub" disabled={busy} onClick={() => void runAgain()}>
            Run again
          </Button>
        ) : null}
      </div>
      <p role="status" className="text-body-sm text-danger empty:hidden">
        {error}
      </p>
    </form>
  );
}

export { AssessmentForm };
