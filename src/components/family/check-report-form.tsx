"use client";

import { useState } from "react";
import Link from "next/link";
import { CameraIcon, ChevronRightIcon, PlayIcon } from "lucide-react";
import { routes } from "@/lib/contracts";
import { useMounted } from "@/lib/use-mounted";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Counter } from "@/components/ui/counter";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { Row } from "@/components/ui/row";
import { StatusDot } from "@/components/ui/status-dot";
import { TopBar } from "@/components/ui/top-bar";
import { checkBackHref, householdRows, isBlankDraft, NEED_OPTIONS, needsCheck, setCount, setNeed, whatHappened } from "./check-report";
import { EditFieldSheet, type EditableField } from "./edit-field-sheet";
import type { ReportDraft } from "./report-draft";
import { updateDraft, useReportDraft } from "./use-report-draft";
import { WhatWeHeardSheet } from "./what-we-heard-sheet";

type CheckReportFormProps = {
  /** The barangays from the hub's settings, for the edit sheet. */
  barangays: string[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-title-md text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** The marker under a field the model was not sure about. The words say it, the dot only backs them up. */
function PleaseCheck() {
  return (
    <p className="flex items-center gap-2 pb-3 text-caption text-body">
      <StatusDot tone="warning" />
      Please check
    </p>
  );
}

// Step 3 of 4. The family reads what the hub understood and fixes the numbers
// and needs here. Every change goes straight into the draft, so Back and Continue
// both keep it, and the send screen reads the same draft.
function CheckReportForm({ barangays }: CheckReportFormProps) {
  const draft = useReportDraft();
  const mounted = useMounted();
  const [editing, setEditing] = useState<EditableField | null>(null);
  const [hearing, setHearing] = useState(false);

  const household = householdRows(draft);
  const change = (next: ReportDraft) => updateDraft(next);

  function counter(label: string, field: "people" | "hurt" | "missing") {
    return (
      <div>
        <Counter label={label} value={draft[field]} max={99} onChange={(value) => change(setCount(draft, field, value))} />
        {needsCheck(draft, field) ? <PleaseCheck /> : null}
      </div>
    );
  }

  // The server render has an empty draft, so wait for hydration before calling it blank.
  const blank = mounted && isBlankDraft(draft);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      <TopBar as="p" title="New report" leading={{ kind: "back", href: checkBackHref(draft) }} />
      <ProgressSteps step={3} className="px-gutter pb-1.5" />

      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
        <h1 className="text-title-page text-ink">Check your report</h1>

        {blank ? (
          <p className="text-body-md text-body">
            There is nothing to check yet.{" "}
            <Link href={routes.family.report} className="font-semibold text-primary">
              Start your report
            </Link>
          </p>
        ) : (
          <>
            <Section title="Household">
              <div className="flex flex-col">
                <Row label="Head of household" value={household.head} onClick={() => setEditing("household_head")} className="border-b-0" />
                {needsCheck(draft, "household_head") ? <PleaseCheck /> : null}
                <Row label="Barangay" value={household.barangay} onClick={() => setEditing("barangay")} className="border-b-0" />
                <Row label="Location" value={household.location} href={routes.family.location} className="border-b-0" />
              </div>
            </Section>

            <Section title="People">
              <div className="flex flex-col divide-y divide-hairline-soft">
                {counter("In the house", "people")}
                {counter("Hurt", "hurt")}
                {counter("Missing", "missing")}
              </div>
            </Section>

            <Section title="Damage">
              <div className="flex flex-col">
                <Row label="What happened" value={whatHappened(draft)} onClick={() => setEditing("what_happened")} className="border-b-0" />
                {needsCheck(draft, "what_happened") ? <PleaseCheck /> : null}
                <Row label="Photo" value="Add a photo" trailing={<CameraIcon aria-hidden="true" className="size-5 text-muted-soft" />} className="border-b-0" />
              </div>
            </Section>

            <Section title="Needs">
              <div role="group" aria-label="Needs" className="flex flex-wrap gap-2 pt-2">
                {NEED_OPTIONS.map((need) => (
                  <Chip key={need.value} pressed={draft.needs.includes(need.value)} onPressedChange={(on) => change(setNeed(draft, need.value, on))}>
                    {need.label}
                  </Chip>
                ))}
              </div>
              {needsCheck(draft, "needs") ? (
                <div className="pt-3">
                  <PleaseCheck />
                </div>
              ) : null}
            </Section>

            {draft.spoken ? (
              <button
                type="button"
                onClick={() => setHearing(true)}
                className="flex min-h-16 items-center gap-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-dark text-canvas">
                  <PlayIcon className="size-4 fill-current" />
                </span>
                <span className="flex-1 text-body-md font-medium text-ink">Your voice note</span>
                <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-muted-soft" />
              </button>
            ) : null}
          </>
        )}
      </main>

      <footer className="bg-canvas px-gutter pt-3 pb-7">
        {blank ? (
          <Button className="w-full" disabled>
            Continue
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href={routes.family.send}>Continue</Link>
          </Button>
        )}
      </footer>

      <EditFieldSheet
        field={editing}
        draft={draft}
        barangays={barangays}
        onSave={(next) => {
          change(next);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
      <WhatWeHeardSheet open={hearing} draft={draft} onClose={() => setHearing(false)} />
    </div>
  );
}

export { CheckReportForm };
export type { CheckReportFormProps };
