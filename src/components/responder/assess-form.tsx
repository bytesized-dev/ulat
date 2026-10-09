"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, MapPinIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { buildForm, buildMeta, type Gps, gpsText, type House, MAX_PHOTOS, nextLabel, sendError } from "./capture";
import { NoteRecorder } from "./note-recorder";

type Photo = { file: File; label: string; url: string };

type AssessFormProps = { house: House };

function AssessForm({ house }: AssessFormProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
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

  function addPhoto(file: File | undefined) {
    const label = nextLabel(photos.length);
    if (!file || !label) return;
    setPhotos((p) => [...p, { file, label, url: URL.createObjectURL(file) }]);
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].url);
    // Labels follow the slot, so the remaining photos shift up.
    setPhotos((p) => p.filter((_, i) => i !== index).map((x, i) => ({ ...x, label: nextLabel(i) ?? x.label })));
  }

  async function send() {
    if (busy || photos.length === 0) return;
    const meta = buildMeta(house, photos.map((p) => p.label), gps);
    if (!meta.success) return setError("This house is missing its barangay. Go back and open it again.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/entries", { method: "POST", body: buildForm(meta.data, photos.map((p) => p.file), note) });
      const body = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (res.ok && body?.id) {
        router.push(routes.responder.drafting(body.id));
        return;
      }
      setError(sendError(res.status, body?.error));
    } catch {
      setError("Could not reach the hub. Check the Wi-Fi and try again.");
    } finally {
      setBusy(false);
    }
  }

  const next = nextLabel(photos.length);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar
        as="p"
        title={house.report_code ?? "New house"}
        leading={{ kind: "back", onClick: () => router.back() }}
        className="[&_p]:font-mono"
      />
      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-6">
        <h1 className="text-title-page text-ink">Assess the house</h1>
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
                  className="hit absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-surface-dark text-canvas"
                >
                  <XIcon aria-hidden="true" className="size-4" />
                </button>
              </div>
            ))}
            {next ? (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex aspect-3/4 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-hairline text-caption text-ink"
              >
                <CameraIcon aria-hidden="true" className="size-5" />
                <b className="font-semibold">{next}</b>
              </button>
            ) : null}
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
        <section className="flex flex-col gap-3" aria-labelledby="note-h">
          <h2 id="note-h" className="text-title-md text-ink">
            Note
          </h2>
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
        <p role="alert" className="min-h-5 text-body-sm text-danger">
          {error}
        </p>
      </main>
      <footer className="px-gutter pb-6">
        <Button type="button" className="w-full" disabled={busy || photos.length === 0} onClick={() => void send()}>
          {busy ? "Sending" : "Send to hub"}
        </Button>
      </footer>
    </div>
  );
}

export { AssessForm };
