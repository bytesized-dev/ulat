"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, MapPinIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Gps, gpsText, type House, MAX_PHOTOS, nextLabel, PHOTO_LABELS } from "./capture";
import { NoteRecorder } from "./note-recorder";
import { enqueue } from "./offline-queue";
import { type ClientIds, createClientIds, sendEntry, UNCLEAR_ANSWER } from "./send-entry";
import { announceQueueChange } from "./use-queue-sync";

const fieldLabel = "text-body-sm font-semibold text-ink";

type Photo = { file: File; label: string; url: string };

// With newHouse, the responder types the house in, because no family report named it.
type AssessFormProps = { house: House; newHouse?: boolean; barangays?: string[] };

function AssessForm({ house: given, newHouse = false, barangays = [] }: AssessFormProps) {
  const [fields, setFields] = useState({ barangay: given.barangay, purok: given.purok ?? "", head: given.household_head ?? "" });
  const house: House = newHouse
    ? { report_code: null, barangay: fields.barangay, purok: fields.purok.trim() || null, household_head: fields.head.trim() || null }
    : given;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  // Made on the first Send and kept for the life of this form, so a tap after a lost reply is a resend.
  const clientIds = useRef<ClientIds | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [gps, setGps] = useState<Gps | null>(null);
  const [gpsFailed, setGpsFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return queueMicrotask(() => setGpsFailed(true));
    const id = navigator.geolocation.watchPosition(
      (p) => setGps({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: p.coords.accuracy }),
      () => setGpsFailed(true),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Photos still on screen when the responder leaves give their object URLs back.
  const shown = useRef<string[]>([]);
  useEffect(() => {
    shown.current = photos.map((p) => p.url);
  }, [photos]);
  useEffect(() => () => shown.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function addPhoto(file: File | undefined) {
    const label = nextLabel(photos.length);
    if (!file || !label) return;
    // Made here, not inside the updater: React may run an updater twice, and the
    // extra URL would never be revoked.
    const url = URL.createObjectURL(file);
    setPhotos((p) => [...p, { file, label, url }]);
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].url);
    // Labels follow the slot, so the remaining photos shift up.
    setPhotos((p) => p.filter((_, i) => i !== index).map((x, i) => ({ ...x, label: nextLabel(i) ?? x.label })));
  }

  async function send() {
    // The ref answers at once. State would still read false for a second tap in
    // the same frame, and each POST makes its own entry.
    if (sending.current || photos.length === 0) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    clientIds.current ??= createClientIds();
    const outcome = await sendEntry({ house, labels: photos.map((p) => p.label), gps, photos: photos.map((p) => p.file), note, ids: clientIds.current });
    if (outcome.kind === "saved") {
      // Stay locked while the next screen loads, so a late tap cannot post again.
      router.push(routes.responder.drafting(outcome.id));
      return;
    }
    if (outcome.kind === "invalid") setError("This house is missing its barangay. Go back and open it again.");
    else if (outcome.kind === "unclear") setError(UNCLEAR_ANSWER);
    else if (outcome.kind === "refused") setError(outcome.message);
    else {
      // The hub is out of reach: keep the entry on the phone. It sends from the Queue tab, under the same id.
      try {
        await enqueue(outcome.meta, photos.map((p) => p.file), note);
        // The layout tries to send at once, in case only this request failed.
        announceQueueChange();
        // Stay locked while the Queue tab loads, as after a send.
        router.push(routes.responder.queue);
        return;
      } catch {
        setError("Could not reach the hub, and this phone could not save it. Try again.");
      }
    }
    sending.current = false;
    setBusy(false);
  }

  const next = nextLabel(photos.length);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        as="p"
        title={house.report_code ?? "New house"}
        leading={{ kind: "back", href: house.report_code ? routes.responder.report(house.report_code) : routes.responder.toVisit }}
        className={house.report_code ? "[&_p]:font-mono" : undefined}
      />
      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-6">
        <h1 className="text-title-page text-ink">{newHouse ? "House with no report" : "Assess the house"}</h1>
        {newHouse ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nb" className={fieldLabel}>
                Barangay
              </Label>
              <Select value={fields.barangay} onValueChange={(barangay) => setFields((f) => ({ ...f, barangay }))}>
                <SelectTrigger id="nb">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {barangays.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="np" className={fieldLabel}>
                Purok
              </Label>
              <Input id="np" value={fields.purok} maxLength={60} onChange={(e) => setFields((f) => ({ ...f, purok: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nh" className={fieldLabel}>
                Head of household
              </Label>
              <Input id="nh" value={fields.head} maxLength={120} onChange={(e) => setFields((f) => ({ ...f, head: e.target.value }))} />
            </div>
          </div>
        ) : null}
        <section className="flex flex-col gap-3" aria-labelledby="photos-h">
          <div className="flex items-baseline justify-between">
            <h2 id="photos-h" className="text-title-md text-ink">
              Photos
            </h2>
            <span className="font-mono text-mono-sm text-body">
              {photos.length}/{MAX_PHOTOS}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={p.url} className="relative aspect-3/4 overflow-hidden rounded-lg bg-body">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a remote image */}
                <img src={p.url} alt={p.label} className="size-full object-cover" />
                <span className="absolute bottom-2 left-2 rounded-pill bg-surface-dark px-2 text-caption-strong text-canvas">{p.label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${p.label} photo`}
                  onClick={() => removePhoto(i)}
                  className="absolute top-0 right-0 flex size-11 items-center justify-center text-canvas"
                >
                  {/* The tile clips anything outside it, so the 44px tap area is the button itself. */}
                  <span className="flex size-7 items-center justify-center rounded-full bg-surface-dark">
                    <XIcon aria-hidden="true" className="size-4" />
                  </span>
                </button>
              </div>
            ))}
            {next
              ? // A new house shows all the empty slots, as the design does. Each tap fills the next one.
                (newHouse ? PHOTO_LABELS.slice(photos.length) : [next]).map((label) => (
                  <button
                    key={label}
                    type="button"
                    aria-label={`Add ${label} photo`}
                    onClick={() => input.current?.click()}
                    className="flex aspect-3/4 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-hairline text-caption text-ink"
                  >
                    <CameraIcon aria-hidden="true" className="size-5" />
                    <b className="font-semibold">{label}</b>
                  </button>
                ))
              : null}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              addPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </section>
        <section className="flex flex-col gap-3" aria-label="Note">
          {/* The design names the section only once there is a note to play back. Before that the row says what to do. */}
          {note ? <h2 className="text-title-md text-ink">Note</h2> : null}
          <NoteRecorder
            note={note}
            seconds={seconds}
            onChange={(n, s) => {
              setNote(n);
              setSeconds(s);
            }}
          />
        </section>
        <p className="flex items-center gap-2 text-body-sm text-body">
          <MapPinIcon aria-hidden="true" className={gps ? "size-4 text-success" : "size-4 text-muted"} />
          {gpsText(gps, gpsFailed)}
        </p>
        {photos.length === 0 ? <p className="text-body-sm text-body">Add at least one photo to send.</p> : null}
        <p role="alert" className="min-h-5 text-body-sm text-danger">
          {error}
        </p>
      </main>
      <footer className="px-gutter pb-7">
        <Button type="button" className="w-full" disabled={busy || photos.length === 0 || !house.barangay} aria-busy={busy} onClick={() => void send()}>
          {busy ? "Sending" : "Send to hub"}
        </Button>
      </footer>
    </div>
  );
}

export { AssessForm };
