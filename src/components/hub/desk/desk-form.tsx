"use client";

import { PrinterIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useDesk, type DeskMode } from "./desk-context";
import { NEED_OPTIONS } from "./desk-report";

const MODES = [
  { value: "household", label: "Household report" },
  { value: "safe", label: "Safe list" },
] as const;

function Field({ id, label, error, className, children }: { id: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className="text-caption font-semibold text-ink">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BarangaySelect({ id, value, options, error, onChange }: { id: string; value: string; options: string[]; error?: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
      <SelectTrigger id={id} size="hub" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
        <SelectValue placeholder={options.length === 0 ? "No barangays set up" : "Pick a barangay"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function invalid(error?: string, id?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
}

function HouseholdFields({ barangays }: { barangays: string[] }) {
  const { household: form, householdErrors: errors, editHousehold, toggleNeed } = useDesk();
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Field id="desk-name" label="Name" error={errors.name}>
          <Input id="desk-name" size="hub" maxLength={120} autoComplete="off" value={form.name} onChange={(e) => editHousehold({ name: e.target.value })} {...invalid(errors.name, "desk-name")} />
        </Field>
        <Field id="desk-barangay" label="Barangay" error={errors.barangay}>
          <BarangaySelect id="desk-barangay" value={form.barangay} options={barangays} error={errors.barangay} onChange={(barangay) => editHousehold({ barangay })} />
        </Field>
        <Field id="desk-purok" label="Purok">
          <Input id="desk-purok" size="hub" maxLength={60} autoComplete="off" value={form.purok} onChange={(e) => editHousehold({ purok: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(
          [
            ["desk-people", "People", "people"],
            ["desk-hurt", "Hurt", "hurt"],
            ["desk-missing", "Missing", "missing"],
          ] as const
        ).map(([id, label, key]) => (
          <Field key={id} id={id} label={label} error={errors[key]}>
            <Input id={id} size="hub" inputMode="numeric" maxLength={2} autoComplete="off" className="font-mono" value={form[key]} onChange={(e) => editHousehold({ [key]: e.target.value })} {...invalid(errors[key], id)} />
          </Field>
        ))}
      </div>
      <Field id="desk-what" label="What happened">
        <Input id="desk-what" size="hub" maxLength={200} autoComplete="off" value={form.what} onChange={(e) => editHousehold({ what: e.target.value })} />
      </Field>
      <div role="group" aria-labelledby="desk-needs-label" className="flex flex-col gap-2">
        <span id="desk-needs-label" className="text-caption font-semibold text-ink">
          Needs
        </span>
        <div className="flex flex-wrap gap-2">
          {NEED_OPTIONS.map((need) => (
            <Chip key={need.value} pressed={form.needs.includes(need.value)} onPressedChange={() => toggleNeed(need.value)}>
              {need.label}
            </Chip>
          ))}
        </div>
      </div>
    </>
  );
}

function SafeFields({ barangays, staying }: { barangays: string[]; staying: string[] }) {
  const { safe: form, safeErrors: errors, editSafe } = useDesk();
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Field id="desk-name" label="Name" error={errors.name}>
          <Input id="desk-name" size="hub" maxLength={120} autoComplete="off" value={form.name} onChange={(e) => editSafe({ name: e.target.value })} {...invalid(errors.name, "desk-name")} />
        </Field>
        <Field id="desk-barangay" label="Barangay" error={errors.barangay}>
          <BarangaySelect id="desk-barangay" value={form.barangay} options={barangays} error={errors.barangay} onChange={(barangay) => editSafe({ barangay })} />
        </Field>
        <Field id="desk-staying" label="Staying at" error={errors.staying_at}>
          <Input id="desk-staying" size="hub" maxLength={120} autoComplete="off" list="desk-staying-options" value={form.staying_at} onChange={(e) => editSafe({ staying_at: e.target.value })} {...invalid(errors.staying_at, "desk-staying")} />
          <datalist id="desk-staying-options">
            {staying.map((place) => (
              <option key={place} value={place} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field id="desk-message" label="Message">
        <Input id="desk-message" size="hub" maxLength={240} autoComplete="off" value={form.message} onChange={(e) => editSafe({ message: e.target.value })} />
      </Field>
    </>
  );
}

type DeskFormProps = { barangays: string[]; staying: string[] };

/** The main column: the mode switch, the form for that mode and the save button. */
export function DeskForm({ barangays, staying }: DeskFormProps) {
  const { mode, setMode, save, saving, notice } = useDesk();
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex max-w-170 flex-col gap-9"
    >
      <Segmented<DeskMode> aria-label="Mode" name="desk-mode" options={MODES} value={mode} onValueChange={setMode} className="self-start" />
      <div className="flex flex-col gap-6">
        {mode === "household" ? <HouseholdFields barangays={barangays} /> : <SafeFields barangays={barangays} staying={staying} />}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="hub" disabled={saving}>
            {mode === "household" ? <PrinterIcon aria-hidden="true" /> : <ShieldCheckIcon aria-hidden="true" />}
            {saving ? "Saving" : mode === "household" ? "Save and print slip" : "Add to safe list"}
          </Button>
          {notice ? (
            <p role={notice.tone === "error" ? "alert" : "status"} className={cn("text-body-sm", notice.tone === "error" ? "text-danger" : "text-body")}>
              {notice.text}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
