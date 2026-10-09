"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EDIT_LIMITS, setHead, setPlace, setWhatHappened } from "./check-report";
import type { ReportDraft } from "./report-draft";

/** The rows on the check screen that open this sheet. */
export type EditableField = "household_head" | "barangay" | "what_happened";

const TITLES: Record<EditableField, string> = {
  household_head: "Head of household",
  barangay: "Barangay",
  what_happened: "What happened",
};

type EditFieldSheetProps = {
  /** The field being edited, or null when the sheet is closed. */
  field: EditableField | null;
  draft: ReportDraft;
  /** The barangays from the hub's settings. */
  barangays: string[];
  onSave: (next: ReportDraft) => void;
  onClose: () => void;
};

// The form mounts each time the sheet opens, so its values start from the
// saved draft and a closed sheet drops whatever was typed.
function EditForm({ field, draft, barangays, onSave }: Omit<EditFieldSheetProps, "field" | "onClose"> & { field: EditableField }) {
  const [head, setHeadText] = useState(draft.household_head);
  const [barangay, setBarangay] = useState(draft.barangay);
  const [purok, setPurok] = useState(draft.purok);
  const [what, setWhat] = useState(draft.what_happened);

  // The saved barangay may no longer be on the hub's list. Keep it choosable.
  const options = barangay && !barangays.includes(barangay) ? [barangay, ...barangays] : barangays;

  // The head of household is the one field a report cannot be sent without.
  const canSave = field !== "household_head" || head.trim() !== "";

  function save() {
    if (!canSave) return;
    if (field === "household_head") onSave(setHead(draft, head));
    else if (field === "barangay") onSave(setPlace(draft, barangay, purok));
    else onSave(setWhatHappened(draft, what));
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {field === "household_head" ? (
        <>
          <Label htmlFor="edit-head" className="sr-only">
            Head of household
          </Label>
          <Input id="edit-head" value={head} maxLength={EDIT_LIMITS.household_head} autoComplete="off" onChange={(event) => setHeadText(event.target.value)} />
        </>
      ) : null}

      {field === "barangay" ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-barangay" className="text-body-sm font-semibold leading-normal text-ink">
              Barangay
            </Label>
            <Select value={barangay} onValueChange={setBarangay} disabled={options.length === 0}>
              <SelectTrigger id="edit-barangay">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {options.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-purok" className="text-body-sm font-semibold leading-normal text-ink">
              Purok
            </Label>
            <Input id="edit-purok" value={purok} maxLength={EDIT_LIMITS.purok} placeholder="Purok 3" autoComplete="off" onChange={(event) => setPurok(event.target.value)} />
          </div>
        </>
      ) : null}

      {field === "what_happened" ? (
        <>
          <Label htmlFor="edit-what" className="sr-only">
            What happened
          </Label>
          <Textarea id="edit-what" value={what} maxLength={EDIT_LIMITS.what_happened} onChange={(event) => setWhat(event.target.value)} />
        </>
      ) : null}

      <Button type="submit" disabled={!canSave}>
        Save
      </Button>
    </form>
  );
}

function EditFieldSheet({ field, draft, barangays, onSave, onClose }: EditFieldSheetProps) {
  return (
    <Sheet open={field !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {field ? (
        <SheetContent title={TITLES[field]}>
          <EditForm field={field} draft={draft} barangays={barangays} onSave={onSave} />
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

export { EditFieldSheet };
