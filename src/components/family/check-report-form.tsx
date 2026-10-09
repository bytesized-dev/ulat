"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CameraIcon, ChevronRightIcon, PlayIcon } from "lucide-react";
import { routes } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Counter } from "@/components/ui/counter";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { Row } from "@/components/ui/row";
import { StatusDot } from "@/components/ui/status-dot";
import { TopBar } from "@/components/ui/top-bar";
import { checkBackHref, householdRows, isBlankDraft, NEED_OPTIONS, needsCheck, NOT_SET, setCount, setNeed, whatHappened } from "./check-report";
import { EditFieldSheet, type EditableField } from "./edit-field-sheet";
import type { ReportDraft } from "./report-draft";
import { PHOTO_ERRORS, preparePhoto } from "./report-photo";
import { clearReportPhoto, setReportPhoto } from "./report-photo-store";
import { updateDraft, useReportDraft } from "./use-report-draft";
import { usePhotoUrl, useReportPhoto } from "./use-report-photo";
import { voiceAudioDuration } from "./voice-audio";
import { formatTimer } from "./voice-note";
import { WhatWeHeardSheet } from "./what-we-heard-sheet";

type CheckReportFormProps = {
  /** The barangays from the hub's settings, for the edit sheet. */
  barangays: string[];
};

// One list style for every section: a hairline between rows, and rows as tall as
// the counters, so the lists read as one. Each row sits in its own block, with
// its Please check marker, so the hairline falls under the marker. A row that is
// a direct child would lose it, because Row turns its own border off.
const LIST = "flex flex-col divide-y divide-hairline-soft";
const ROW = "border-b-0 py-2";

// Row takes a plain string for its value when it is a link or a button, so the
// value is styled from the row: the last span in the text block. A value the
// family has not given yet reads as empty, not as an answer.
const EMPTY_VALUE = "[&>span:first-child>span:last-child]:font-normal [&>span:first-child>span:last-child]:text-muted-text";
const ACTION_VALUE = "[&>span:first-child>span:last-child]:text-primary";

const rowFor = (value: string) => cn(ROW, value === NOT_SET && EMPTY_VALUE);

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
  const { photo } = useReportPhoto();
  const photoUrl = usePhotoUrl(photo);
  const [unshownUrl, setUnshownUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const household = householdRows(draft);
  const change = (next: ReportDraft) => updateDraft(next);

  async function addPhoto(file: File) {
    setAdding(true);
    setPhotoError(null);
    const result = await preparePhoto(file);
    if (result.ok) await setReportPhoto(result.photo);
    else setPhotoError(PHOTO_ERRORS[result.error]);
    setAdding(false);
  }

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
  // Known only while the recording is still on the phone.
  const voiceLength = voiceAudioDuration();

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
              <div className={LIST}>
                <div>
                  <Row label="Head of household" value={household.head} onClick={() => setEditing("household_head")} className={rowFor(household.head)} />
                  {needsCheck(draft, "household_head") ? <PleaseCheck /> : null}
                </div>
                <div>
                  <Row label="Barangay" value={household.barangay} onClick={() => setEditing("barangay")} className={rowFor(household.barangay)} />
                </div>
                <div>
                  <Row label="Location" value={household.location} href={routes.family.location} className={rowFor(household.location)} />
                </div>
              </div>
            </Section>

            <Section title="People">
              <div className={LIST}>
                {counter("In the house", "people")}
                {counter("Hurt", "hurt")}
                {counter("Missing", "missing")}
              </div>
            </Section>

            <Section title="Damage">
              <div className={LIST}>
                <div>
                  <Row label="What happened" value={whatHappened(draft)} onClick={() => setEditing("what_happened")} className={rowFor(whatHappened(draft))} />
                  {needsCheck(draft, "what_happened") ? <PleaseCheck /> : null}
                </div>
                <div>
                  {photo ? (
                    <Row
                      label="Photo"
                      value={
                        photoUrl && photoUrl !== unshownUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a remote image
                          <img src={photoUrl} alt="Your photo" onError={() => setUnshownUrl(photoUrl)} className="mt-1 block size-14 rounded-md object-cover" />
                        ) : (
                          // A photo this browser cannot draw, such as HEIC in Chrome, is still kept and sent.
                          <span role="img" aria-label="Your photo" className="mt-1 flex size-14 items-center justify-center rounded-md bg-surface-strong text-ink">
                            <CameraIcon aria-hidden="true" className="size-5" />
                          </span>
                        )
                      }
                      trailing={
                        <span className="flex items-center gap-4">
                          <button
                            type="button"
                            aria-label="Change photo"
                            disabled={adding}
                            onClick={() => picker.current?.click()}
                            className="hit text-body-sm font-semibold text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Change
                          </button>
                          <button
                            type="button"
                            aria-label="Remove photo"
                            disabled={adding}
                            onClick={() => {
                              setPhotoError(null);
                              void clearReportPhoto();
                            }}
                            className="hit text-body-sm font-semibold text-danger outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Remove
                          </button>
                        </span>
                      }
                      className={ROW}
                    />
                  ) : (
                    <Row
                      label="Photo"
                      value={adding ? "Adding photo" : "Add a photo"}
                      trailing={<CameraIcon aria-hidden="true" className="size-5 text-primary" />}
                      disabled={adding}
                      onClick={() => picker.current?.click()}
                      className={cn(ROW, ACTION_VALUE)}
                    />
                  )}
                  {/* No capture attribute, so the phone offers the camera and the gallery, and it works over plain HTTP. */}
                  <input
                    ref={picker}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void addPhoto(file);
                    }}
                  />
                  {photoError ? (
                    <p role="alert" className="pb-3 text-body-sm text-danger">
                      {photoError}
                    </p>
                  ) : null}
                </div>
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
                {voiceLength !== null ? <span className="font-mono text-body-sm text-body tabular">{formatTimer(voiceLength)}</span> : null}
                <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-muted-soft" />
              </button>
            ) : null}
          </>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-hairline bg-canvas px-gutter pt-3 pb-7">
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
