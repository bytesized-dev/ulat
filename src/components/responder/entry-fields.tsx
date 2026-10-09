"use client";

import { useRef, useState } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Counter } from "@/components/ui/counter";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLASS_OPTIONS,
  type ClassFrom,
  type EntryForm,
  HAZARD_SUGGESTIONS,
  MATERIAL_OPTIONS,
  matchesReport,
  NEED_OPTIONS,
  toggle,
} from "./entry-form";

type EntryFieldsProps = {
  form: EntryForm;
  onChange: (patch: Partial<EntryForm>) => void;
  /** The family report's hurt count, for "Matches report". Null for a house with no report. */
  reportHurt: number | null;
  /** Who suggested the class the form started with, so the responder knows to check it. */
  classFrom: ClassFrom;
};

const CLASS_FROM_TEXT: Record<Exclude<ClassFrom, null>, string> = {
  photo: "Suggested from the family's photo. Change it if the house looks different.",
  staff: "Suggested by hub staff. Change it if the house looks different.",
};

// What the responder decides at the house, under the photos on the assess screen.
function EntryFields({ form, onChange, reportHurt, classFrom }: EntryFieldsProps) {
  // None or Add. Add opens the hazard choices, None sends an empty list.
  const [hazardsOn, setHazardsOn] = useState(() => form.hazards.length > 0);
  // Hazards from the family photo or typed by the responder. They stay listed after being turned off.
  const [otherHazards, setOtherHazards] = useState(() =>
    form.hazards.filter((h) => !(HAZARD_SUGGESTIONS as readonly string[]).includes(h)),
  );
  const [custom, setCustom] = useState("");
  // None keeps the picks here, so Add brings them back.
  const parked = useRef<string[]>([]);
  const hazardChoices = [...HAZARD_SUGGESTIONS, ...otherHazards];

  function chooseNone() {
    if (!hazardsOn) return;
    parked.current = form.hazards;
    onChange({ hazards: [] });
    setHazardsOn(false);
  }

  function chooseAdd() {
    if (hazardsOn) return;
    onChange({ hazards: parked.current });
    setHazardsOn(true);
  }

  function addHazard() {
    const text = custom.trim().slice(0, 80);
    if (text && !hazardChoices.includes(text)) setOtherHazards((o) => [...o, text]);
    if (text && !form.hazards.includes(text)) onChange({ hazards: [...form.hazards, text] });
    setCustom("");
  }

  return (
    <>
      <section className="flex flex-col gap-1" aria-labelledby="class-h">
        <h2 id="class-h" className="text-title-md text-ink">
          Damage class
        </h2>
        {classFrom ? <p className="text-body-sm text-body">{CLASS_FROM_TEXT[classFrom]}</p> : null}
        <div role="radiogroup" aria-labelledby="class-h" className="flex flex-col pt-1">
          {CLASS_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-13 cursor-pointer items-center justify-between border-b border-hairline-soft text-body-md font-medium text-ink last:border-b-0"
            >
              {option.label}
              <input
                type="radio"
                name="damage-class"
                value={option.value}
                checked={form.damage_class === option.value}
                onChange={() => onChange({ damage_class: option.value })}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="flex size-6 items-center justify-center rounded-full border border-muted-soft peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-checked:[&>span]:block"
              >
                <span className="hidden size-2 rounded-full bg-canvas" />
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <Label htmlFor="material">House material</Label>
        <Select value={form.material} onValueChange={(v) => onChange({ material: v as EntryForm["material"] })}>
          <SelectTrigger id="material" className="w-full">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="hazards-h">
        <h2 id="hazards-h" className="text-title-md text-ink">
          Hazards
        </h2>
        <div role="group" aria-labelledby="hazards-h" className="grid grid-cols-3 gap-2">
          <Chip pressed={!hazardsOn} onPressedChange={chooseNone} className="w-full px-2">
            None
          </Chip>
          <Chip pressed={hazardsOn} onPressedChange={chooseAdd} className="w-full px-2">
            Add
          </Chip>
        </div>
        {hazardsOn ? (
          <>
            <div role="group" aria-label="Hazards seen" className="flex flex-wrap gap-2">
              {hazardChoices.map((h) => (
                <Chip key={h} pressed={form.hazards.includes(h)} onPressedChange={() => onChange({ hazards: toggle(form.hazards, h) })}>
                  {h}
                </Chip>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addHazard();
              }}
            >
              <input
                aria-label="Other hazard"
                placeholder="Other hazard"
                value={custom}
                maxLength={80}
                onChange={(e) => setCustom(e.target.value)}
                className="h-14 min-w-0 flex-1 rounded-md border border-hairline bg-canvas px-4 text-body-md text-ink outline-none placeholder:text-muted-text focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" variant="secondary" className="px-5">
                Add
              </Button>
            </form>
          </>
        ) : null}
      </section>

      <section className="flex flex-col" aria-labelledby="people-h">
        <div className="flex items-baseline justify-between pb-1">
          <h2 id="people-h" className="text-title-md text-ink">
            People
          </h2>
          {matchesReport(form.hurt, reportHurt) ? (
            <span className="flex items-center gap-1 text-caption-strong text-success">
              <CheckIcon aria-hidden="true" className="size-3.5" />
              Matches report
            </span>
          ) : null}
        </div>
        <Counter label="People" value={form.people} max={99} onChange={(v) => onChange({ people: v })} className="border-b border-hairline-soft" />
        <Counter label="Hurt" value={form.hurt} max={99} onChange={(v) => onChange({ hurt: v })} className="border-b border-hairline-soft" />
        <Counter label="Missing" value={form.missing} max={99} onChange={(v) => onChange({ missing: v })} />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="needs-h">
        <h2 id="needs-h" className="text-title-md text-ink">
          Needs
        </h2>
        <div role="group" aria-labelledby="needs-h" className="grid grid-cols-3 gap-2">
          {NEED_OPTIONS.map((n) => (
            <Chip
              key={n.value}
              pressed={form.needs.includes(n.value)}
              onPressedChange={() => onChange({ needs: toggle(form.needs, n.value) })}
              className="w-full px-2"
            >
              {n.label}
            </Chip>
          ))}
        </div>
      </section>
    </>
  );
}

export { EntryFields };
