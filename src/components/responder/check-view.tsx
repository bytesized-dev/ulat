"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Counter } from "@/components/ui/counter";
import { DarkHero } from "@/components/ui/dark-hero";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/status-dot";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { useLiveEvents } from "@/lib/live/use-live-events";
import { cn } from "@/lib/utils";
import { MAX_PHOTOS } from "./capture";
import {
  type AiDraft,
  buildConfirm,
  CLASS_OPTIONS,
  CLASS_TONE,
  type CheckForm,
  canConfirm,
  confidenceWords,
  HAZARD_SUGGESTIONS,
  initialForm,
  isUnclear,
  MATERIAL_OPTIONS,
  matchesReport,
  NEED_OPTIONS,
  toggle,
} from "./check-draft";

type CheckViewProps = {
  entryId: string;
  /** The family report code, or the entry number for a house with no report. */
  title: string;
  house: { report_code: string | null; barangay: string; purok: string | null; household_head: string | null };
  entry: Parameters<typeof initialForm>[0];
  ai: AiDraft;
  photos: { id: string; label: string | null }[];
  reportHurt: number | null;
  /** The hub has an entry.photo_added event for this entry. */
  hasNewPhoto: boolean;
};

/** How long to wait for the new draft after a photo before giving up on the event. */
const REDRAFT_WAIT_MS = 65_000;

function CheckView({ entryId, title, house, entry, ai, photos, reportHurt, hasNewPhoto }: CheckViewProps) {
  const router = useRouter();
  const { latest } = useLiveEvents();
  const unclear = isUnclear(ai);
  const [form, setForm] = useState<CheckForm>(() => initialForm(entry, ai));
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const classGroup = useRef<HTMLDivElement>(null);
  const redrafted = useRef(false);

  // entry.drafted is published when the new photo has been read. It can arrive before the upload response does.
  useEffect(() => {
    if (latest?.type !== "entry.drafted" || latest.entry_id !== entryId) return;
    redrafted.current = true;
    if (reading) {
      queueMicrotask(() => {
        setReading(false);
        router.refresh();
      });
    }
  }, [latest, entryId, reading, router]);

  useEffect(() => {
    if (!reading) return;
    const timer = setTimeout(() => {
      setReading(false);
      router.refresh();
    }, REDRAFT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [reading, router]);

  const set = <K extends keyof CheckForm>(key: K, value: CheckForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const classChosen = canConfirm(form);
  const showDetails = !unclear || classChosen;
  const suggestions = HAZARD_SUGGESTIONS.filter((h) => !form.hazards.includes(h));
  const canAddPhoto = photos.length < MAX_PHOTOS;

  function addHazard() {
    const text = custom.trim().slice(0, 80);
    if (text && !form.hazards.includes(text)) set("hazards", [...form.hazards, text]);
    setCustom("");
    setAdding(false);
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    redrafted.current = false;
    try {
      const body = new FormData();
      body.set("photo", file);
      body.set("label", (ai.need_more ?? "Extra").slice(0, 80));
      const res = await fetch(`/api/entries/${entryId}/photos`, { method: "POST", body });
      if (!res.ok) {
        setError(res.status === 400 ? "That photo could not be used. Try another one." : "Could not add the photo. Try again.");
        return;
      }
      // Fixtures are instant, so the draft is already done. The real model can take a minute.
      if (redrafted.current) router.refresh();
      else setReading(true);
    } catch {
      setError("Could not reach the hub. Check the Wi-Fi and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (busy) return;
    const built = buildConfirm(form, hasNewPhoto);
    if (!built?.success) return setError("Choose a damage class and check the counts.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(built.data),
      });
      if (res.ok) {
        router.push(routes.responder.confirmed(entryId));
        return;
      }
      setError("Could not save the entry. Try again.");
    } catch {
      setError("Could not reach the hub. Check the Wi-Fi and try again.");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    const q = new URLSearchParams();
    if (house.report_code) q.set("code", house.report_code);
    else {
      q.set("barangay", house.barangay);
      if (house.purok) q.set("purok", house.purok);
      if (house.household_head) q.set("head", house.household_head);
    }
    router.push(`${routes.responder.assess(crypto.randomUUID())}?${q.toString()}`);
  }

  const classGroupEl = (
    <section className="flex flex-col gap-1" aria-labelledby="class-h">
      <h2 id="class-h" className="pb-2 text-title-md text-ink">
        Damage class
      </h2>
      <div ref={classGroup} role="radiogroup" aria-labelledby="class-h" className="flex flex-col">
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
              onChange={() => set("damage_class", option.value)}
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
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar as="p" title="Check the draft" leading={{ kind: "back", onClick: () => router.back() }} trailing={<span className="font-mono text-mono-sm text-body">{title}</span>} />
      <main className="flex flex-1 flex-col gap-7 px-gutter pt-3 pb-6">
        {unclear ? (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-title-page text-ink">Can&apos;t tell yet</h1>
              {ai.need_more ? <p className="text-body-md text-body">Add a photo: {ai.need_more.charAt(0).toLowerCase() + ai.need_more.slice(1)}.</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} role="img" aria-label={photo.label ?? "Photo"} className="relative aspect-3/4 overflow-hidden rounded-lg bg-body">
                  {/* eslint-disable-next-line @next/next/no-img-element -- served by the hub itself */}
                  <img src={`/api/files/${photo.id}`} alt="" className="size-full object-cover" />
                  <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-pill bg-surface-dark px-2 text-caption-strong text-canvas">
                    {photo.label ?? "Photo"}
                  </span>
                </div>
              ))}
              {canAddPhoto ? (
                <button
                  type="button"
                  disabled={busy || reading}
                  onClick={() => camera.current?.click()}
                  className="flex aspect-3/4 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary text-caption-strong text-primary disabled:text-muted-soft"
                >
                  <CameraIcon aria-hidden="true" className="size-5" />
                  {reading ? "Reading the photo" : (ai.need_more ?? "One more photo")}
                </button>
              ) : null}
            </div>
            {classGroupEl}
          </>
        ) : (
          <>
            <DarkHero>
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-sm text-muted-soft">Hub suggests</span>
                <Pill className="bg-surface-dark-elevated text-canvas">{confidenceWords(ai.confidence)}</Pill>
              </div>
              <p className="mt-4 flex items-center gap-3 text-display-md text-canvas">
                {ai.damage_class && ai.damage_class !== "unclear" ? <StatusDot tone={CLASS_TONE[ai.damage_class]} className="size-3" /> : null}
                {CLASS_OPTIONS.find((o) => o.value === ai.damage_class)?.label}
              </p>
              {ai.reason ? <p className="mt-3 text-body-md text-muted-soft">{ai.reason}</p> : null}
            </DarkHero>
            {classGroupEl}
          </>
        )}

        {showDetails ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="material">House material</Label>
              <Select value={form.material} onValueChange={(v) => set("material", v as CheckForm["material"])}>
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
              <div className="flex flex-wrap gap-2">
                {form.hazards.map((h) => (
                  <Chip key={h} pressed={form.hazards.includes(h)} onPressedChange={() => set("hazards", toggle(form.hazards, h))}>
                    {h}
                  </Chip>
                ))}
                <Chip pressed={adding} onPressedChange={setAdding}>
                  Add
                </Chip>
              </div>
              {adding ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((h) => (
                      <Chip key={h} pressed={false} onPressedChange={() => set("hazards", [...form.hazards, h])}>
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
                    aria-label="Hazard"
                    value={custom}
                    maxLength={80}
                    onChange={(e) => setCustom(e.target.value)}
                    className="h-14 min-w-0 flex-1 rounded-md border border-hairline bg-canvas px-4 text-body-md text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <Counter label="People" value={form.people} max={99} onChange={(v) => set("people", v)} className="border-b border-hairline-soft" />
              <Counter label="Hurt" value={form.hurt} max={99} onChange={(v) => set("hurt", v)} className="border-b border-hairline-soft" />
              <Counter label="Missing" value={form.missing} max={99} onChange={(v) => set("missing", v)} />
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="needs-h">
              <h2 id="needs-h" className="text-title-md text-ink">
                Needs
              </h2>
              <div className="flex flex-wrap gap-2">
                {NEED_OPTIONS.map((n) => (
                  <Chip key={n.value} pressed={form.needs.includes(n.value)} onPressedChange={() => set("needs", toggle(form.needs, n.value))}>
                    {n.label}
                  </Chip>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <p role="alert" className="min-h-5 text-body-sm text-danger">
          {error}
        </p>
      </main>

      <footer className="flex flex-col gap-1 px-gutter pb-6">
        {showDetails ? (
          <Button type="button" className="w-full" disabled={busy || !classChosen} onClick={() => void confirm()}>
            {busy ? "Saving" : "Confirm entry"}
          </Button>
        ) : (
          <Button type="button" className="w-full" disabled={busy || reading || !canAddPhoto} onClick={() => camera.current?.click()}>
            <CameraIcon aria-hidden="true" />
            Take photo
          </Button>
        )}
        {unclear ? (
          showDetails ? (
            canAddPhoto ? (
              <Button type="button" variant="tertiary" className="w-full" disabled={busy || reading} onClick={() => camera.current?.click()}>
                Take photo
              </Button>
            ) : null
          ) : (
            <Button type="button" variant="tertiary" className="w-full" onClick={() => classGroup.current?.querySelector("input")?.focus()}>
              Choose myself
            </Button>
          )
        ) : (
          <Button type="button" variant="tertiary" className={cn("w-full")} onClick={retake}>
            Retake photos
          </Button>
        )}
      </footer>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void uploadPhoto(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export { CheckView };
