"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PrinterIcon } from "lucide-react";
import type { z } from "zod";
import type { ConfirmedDamageClass, EntryConfirm, Material, Need } from "@/lib/contracts/schemas";
import { editEntry } from "@/lib/hub/api-client";
import type { EntryDetail } from "@/lib/hub/entries";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NEED_OPTIONS, parseCount } from "../desk/desk-report";
import "./entry-print.css";

type Entry = EntryDetail["entry"];
type Damage = z.infer<typeof ConfirmedDamageClass>;
type MaterialValue = z.infer<typeof Material>;
type NeedValue = z.infer<typeof Need>;

const damageOptions: { value: Damage; label: string }[] = [
  { value: "none", label: "None" },
  { value: "partial", label: "Partially" },
  { value: "total", label: "Totally" },
];

const materialOptions: { value: MaterialValue; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "mixed", label: "Mixed" },
  { value: "concrete", label: "Concrete" },
  { value: "unknown", label: "Unknown" },
];

type EditForm = { damage: Damage; material: MaterialValue; people: string; hurt: string; missing: string; needs: NeedValue[] };

const COUNT_ERROR = "Enter 0 to 99";
const COUNTS = [
  ["edit-people", "People", "people"],
  ["edit-hurt", "Hurt", "hurt"],
  ["edit-missing", "Missing", "missing"],
] as const;

function startingForm(entry: Entry): EditForm {
  return {
    damage: entry.damage_class ?? "none",
    material: entry.material ?? "unknown",
    people: String(entry.people),
    hurt: String(entry.hurt),
    missing: String(entry.missing),
    needs: entry.needs,
  };
}

/** The body PATCH /api/entries/[id] takes. Hazards and families stay as they are, since the form does not show them. */
function toConfirm(form: EditForm, entry: Entry): EntryConfirm {
  return {
    damage_class: form.damage,
    material: form.material,
    hazards: entry.hazards,
    families: entry.families,
    people: parseCount(form.people) ?? 0,
    hurt: parseCount(form.hurt) ?? 0,
    missing: parseCount(form.missing) ?? 0,
    needs: form.needs,
  };
}

const saveErrors = {
  unauthorized: "Your session ended. Lock the hub and sign in again.",
  not_found: "This entry is gone.",
  settled: "This entry changed. Reload and try again.",
  failed: "Could not save. Try again.",
} as const;

function EditDialog({ entry }: { entry: Entry }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<EditForm>(() => startingForm(entry));
  const [errors, setErrors] = React.useState<Partial<Record<"people" | "hurt" | "missing", string>>>({});
  const [saving, setSaving] = React.useState(false);
  const [failure, setFailure] = React.useState<string | null>(null);

  function change(next: boolean) {
    setOpen(next);
    if (next) {
      // Every open starts from what the entry holds now.
      setForm(startingForm(entry));
      setErrors({});
      setFailure(null);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const found: typeof errors = {};
    for (const [, , key] of COUNTS) if (parseCount(form[key]) === null) found[key] = COUNT_ERROR;
    setErrors(found);
    const first = COUNTS.find(([, , key]) => found[key]);
    if (first) {
      document.getElementById(first[0])?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    const result = await editEntry(entry.id, toConfirm(form, entry));
    setSaving(false);
    if (result !== "ok") {
      setFailure(saveErrors[result]);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="hub">
          <PencilIcon aria-hidden="true" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form noValidate onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle className="text-title-md">Edit entry</DialogTitle>
            <DialogDescription>Each change you save goes in the history.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <span aria-hidden="true" className="text-caption font-semibold text-ink">
              Damage
            </span>
            <Segmented aria-label="Damage" name="edit-damage" options={damageOptions} value={form.damage} onValueChange={(damage) => setForm({ ...form, damage })} className="self-start" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-material" className="text-caption font-semibold text-ink">
              Material
            </Label>
            <Select value={form.material} onValueChange={(material) => setForm({ ...form, material: material as MaterialValue })}>
              <SelectTrigger id="edit-material" size="hub">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {materialOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {COUNTS.map(([id, label, key]) => (
              <div key={id} className="flex flex-col gap-2">
                <Label htmlFor={id} className="text-caption font-semibold text-ink">
                  {label}
                </Label>
                <Input
                  id={id}
                  size="hub"
                  inputMode="numeric"
                  maxLength={2}
                  autoComplete="off"
                  className="font-mono"
                  value={form[key]}
                  onChange={(e) => {
                    setForm({ ...form, [key]: e.target.value });
                    setErrors({ ...errors, [key]: undefined });
                  }}
                  aria-invalid={errors[key] ? true : undefined}
                  aria-describedby={errors[key] ? `${id}-error` : undefined}
                />
                {errors[key] ? (
                  <p id={`${id}-error`} className="text-caption text-danger">
                    {errors[key]}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div role="group" aria-labelledby="edit-needs-label" className="flex flex-col gap-2">
            <span id="edit-needs-label" className="text-caption font-semibold text-ink">
              Needs
            </span>
            <div className="flex flex-wrap gap-2">
              {NEED_OPTIONS.map((need) => (
                <Chip
                  key={need.value}
                  pressed={form.needs.includes(need.value)}
                  onPressedChange={() => setForm({ ...form, needs: form.needs.includes(need.value) ? form.needs.filter((n) => n !== need.value) : [...form.needs, need.value] })}
                >
                  {need.label}
                </Chip>
              ))}
            </div>
          </div>

          {failure ? (
            <p role="alert" className="text-body-sm text-danger">
              {failure}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="hub">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="hub" disabled={saving}>
              {saving ? "Saving" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type EntryActionsProps = { entry: Entry };

/**
 * Edit and Print for the entry detail page. Edit shows only for a confirmed
 * entry: the route confirms whatever staff save, so a draft or an entry
 * waiting for review is settled from the Review screen, not from here.
 * Both hide when the page prints.
 */
export function EntryActions({ entry }: EntryActionsProps) {
  return (
    <div className="flex items-center gap-3 print:hidden">
      {entry.status === "confirmed" ? <EditDialog entry={entry} /> : null}
      <Button variant="secondary" size="hub" onClick={() => window.print()}>
        <PrinterIcon aria-hidden="true" />
        Print
      </Button>
    </div>
  );
}
