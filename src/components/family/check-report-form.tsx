"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CameraIcon, LockIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { routes } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/use-mounted";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Counter } from "@/components/ui/counter";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { Row } from "@/components/ui/row";
import { TopBar } from "@/components/ui/top-bar";
import { newClientId } from "@/lib/client-id";
import { checkBackHref, householdRows, isBlankDraft, NEED_OPTIONS, NOT_SET, setCount, setNeed, whatHappened } from "./check-report";
import { EditFieldSheet, type EditableField } from "./edit-field-sheet";
import { enqueue } from "./offline-queue";
import { queueStore } from "./queue-db";
import { clearDraft, toNewReport, type ReportDraft } from "./report-draft";
import { PHOTO_ERRORS, preparePhoto } from "./photo-shrink";
import { reportPhotoBlob, setReportPhoto } from "./report-photo";
import { clearReportPhoto, keepReportPhoto, loadReportPhoto } from "./report-photo-store";
import { canSend, photoFileName, sendReport } from "./send-report";
import { markSentFromDraft, saveSentReport } from "./sent-report";
import { announceQueueChange } from "./use-offline-queue";
import { updateDraft, useReportDraft } from "./use-report-draft";
import { usePhotoUrl, useReportPhoto } from "./use-report-photo";

type CheckReportFormProps = {
  /** The barangays from the hub's settings, for the edit sheet. */
  barangays: string[];
};

// One list style for every section: a hairline between rows, and rows as tall as
// the counters, so the lists read as one. Each row sits in its own block, so the
// hairline falls under it. A row that is a direct child would lose it, because
// Row turns its own border off.
const LIST = "flex flex-col divide-y divide-hairline-soft";
const ROW = "border-b-0 py-2";

// Row takes a plain string for its value when it is a link or a button, so the
// value is styled from the row: the last span in the text block. A value the
// family has not given yet reads as empty, not as an answer.
const EMPTY_VALUE = "[&>span:first-child>span:last-child]:font-normal [&>span:first-child>span:last-child]:text-muted-text";
const ACTION_VALUE = "[&>span:first-child>span:last-child]:text-primary";

const rowFor = (value: string) => cn(ROW, value === NOT_SET && EMPTY_VALUE);

const PROMISES = [
  { icon: <UsersIcon />, label: "Only MDRRMO responders see it" },
  { icon: <MapPinIcon />, label: "Used to plan visits and relief" },
  { icon: <LockIcon />, label: "Stays on this laptop, never online" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="text-title-md text-ink">{title}</h2>
      {children}
    </section>
  );
}

// Step 2 of 2. The family fills in the people, damage, photo and needs by hand.
// Every field is optional, and no AI reads any of it on the phone. Every change
// goes straight into the draft, so Back keeps it. Agree and send is the
// family's consent (a button, not a form, because the edit sheet is a form
// inside this screen and its submit would bubble up), so it is the only place a report is posted. The draft stays
// in place until the report sent screen takes over, so a failed send can be
// tried again with nothing retyped.
function CheckReportForm({ barangays }: CheckReportFormProps) {
  const router = useRouter();
  const draft = useReportDraft();
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);
  const [editing, setEditing] = useState<EditableField | null>(null);
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
    if (result.ok) await keepReportPhoto(result.photo);
    else setPhotoError(PHOTO_ERRORS[result.error]);
    setAdding(false);
  }

  function counter(label: string, field: "people" | "hurt" | "missing") {
    return (
      <div>
        <Counter label={label} value={draft[field]} max={99} onChange={(value) => change(setCount(draft, field, value))} />
      </div>
    );
  }

  async function submit() {
    if (busy || !canSend(draft)) return;
    setBusy(true);
    setError(null);
    // One id per tap. The direct post and the queued copy carry it, so the hub
    // makes one report even when a reply is lost and the phone sends again.
    const clientId = newClientId();
    // The photo_id is made once per tap too, so a resend never makes a second file.
    // After a reload the photo is still in IndexedDB, so read it before asking for it.
    await loadReportPhoto();
    const picked = reportPhotoBlob();
    const photo = picked ? { blob: picked, id: newClientId() } : null;
    const result = await sendReport(draft, fetch, clientId, photo);
    if (!result.ok && result.unreachable) {
      // The hub is out of reach. Keep the report on the phone with its photo,
      // where the saved screen takes over and sends both when the hub is back.
      const body = toNewReport(draft);
      if (body.success) {
        try {
          const report = { ...body.data, photo_id: photo?.id ?? null, client_id: clientId };
          await enqueue(queueStore(), report, photo ? [{ kind: "photo" as const, name: photoFileName(photo.blob), blob: photo.blob }] : []);
          clearDraft();
          setReportPhoto(null);
          announceQueueChange();
          setBusy(false);
          return;
        } catch {
          // Nothing could be saved, so show the plain failure and keep the draft.
        }
      }
    }
    if (!result.ok) {
      setError({ message: result.message, retry: result.retry });
      setBusy(false);
      return;
    }
    saveSentReport(result.code);
    markSentFromDraft(result.code);
    setReportPhoto(null);
    // Replace, so Back from the next screen does not offer to send it again.
    router.replace(routes.family.sent);
  }

  // The server render has an empty draft, so wait for hydration before calling it blank.
  const blank = mounted && isBlankDraft(draft);
  const incomplete = mounted && !canSend(draft);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      <TopBar as="p" title="New report" leading={{ kind: "back", href: checkBackHref() }} />
      <ProgressSteps step={2} className="px-gutter pb-1.5" />

      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
        <h1 className="text-title-page text-ink">Report details</h1>

        {blank ? (
          <p className="text-body-md text-body">
            Start with the household first.{" "}
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
                {counter("People in the house", "people")}
                {counter("Hurt", "hurt")}
                {counter("Missing", "missing")}
              </div>
            </Section>

            <Section title="Damage">
              <div className={LIST}>
                <div>
                  <Row label="What happened" value={whatHappened(draft)} onClick={() => setEditing("what_happened")} className={rowFor(whatHappened(draft))} />
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
              <div role="group" aria-label="Needs" className="grid grid-cols-3 gap-2 pt-2">
                {NEED_OPTIONS.map((need) => (
                  <Chip
                    key={need.value}
                    pressed={draft.needs.includes(need.value)}
                    onPressedChange={(on) => change(setNeed(draft, need.value, on))}
                    className="w-full px-2"
                  >
                    {need.label}
                  </Chip>
                ))}
              </div>
            </Section>

            <ul aria-label="Before you send" className="flex flex-col">
              {PROMISES.map((promise) => (
                <li key={promise.label}>
                  <Row icon={promise.icon} label={null} value={promise.label} className="border-b-0 py-1" />
                </li>
              ))}
            </ul>

            <p role="alert" className="min-h-5 text-body-sm text-danger">
              {error?.message ?? (incomplete ? "Some details are missing. Go back and check your report." : null)}
            </p>
          </>
        )}
      </main>

      <footer className="sticky bottom-0 border-t border-hairline bg-canvas px-gutter pt-3 pb-7">
        <Button type="button" className="w-full" disabled={blank || busy || incomplete} onClick={() => void submit()}>
          {busy ? "Sending" : error?.retry ? "Try again" : "Agree and send"}
        </Button>
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
    </div>
  );
}

export { CheckReportForm };
export type { CheckReportFormProps };
