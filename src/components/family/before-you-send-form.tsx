"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { routes } from "@/lib/contracts";
import { useMounted } from "@/lib/use-mounted";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { Row } from "@/components/ui/row";
import { TopBar } from "@/components/ui/top-bar";
import { newClientId } from "@/lib/client-id";
import { enqueue } from "./offline-queue";
import { queueStore } from "./queue-db";
import { clearDraft, toNewReport } from "./report-draft";
import { canSend, sendReport, summarizeDraft } from "./send-report";
import { markSentFromDraft, saveSentReport } from "./sent-report";
import { setVoiceAudio, voiceAudioBlob, voiceFileName } from "./voice-audio";
import { announceQueueChange } from "./use-offline-queue";
import { useReportDraft } from "./use-report-draft";

const PROMISES = [
  { icon: <UsersIcon />, label: "Only MDRRMO responders see it" },
  { icon: <MapPinIcon />, label: "Used to plan visits and relief" },
  { icon: <LockIcon />, label: "Stays on this laptop, never online" },
];

// Step 4 of 4. Agree and send is the family's consent, so it is the only place
// a report is posted. The draft stays in place until the report sent screen
// takes over, so a failed send can be tried again with nothing retyped.
function BeforeYouSendForm() {
  const router = useRouter();
  const draft = useReportDraft();
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: boolean } | null>(null);

  const summary = summarizeDraft(draft);
  // The server render has an empty draft, so wait for hydration before saying it is incomplete.
  const incomplete = mounted && !canSend(draft);

  async function submit() {
    if (busy || !canSend(draft)) return;
    setBusy(true);
    setError(null);
    // One id per tap. The direct post and the queued copy carry it, so the hub
    // makes one report even when a reply is lost and the phone sends again.
    const clientId = newClientId();
    // A typed note has no voice_id, and a reload loses the recording in memory.
    // Either way the report goes without audio.
    const audio = draft.voice_id ? voiceAudioBlob() : null;
    const result = await sendReport(draft, fetch, clientId, audio);
    if (!result.ok && result.unreachable) {
      // The hub is out of reach. Keep the report on the phone with its
      // recording, where the saved screen takes over and sends both when the
      // hub is back.
      const body = toNewReport(draft);
      if (body.success) {
        try {
          const report = { ...body.data, voice_id: audio ? body.data.voice_id : null, client_id: clientId };
          await enqueue(queueStore(), report, audio ? [{ kind: "audio", name: voiceFileName(audio), blob: audio }] : []);
          clearDraft();
          setVoiceAudio(null);
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
    setVoiceAudio(null);
    // Replace, so Back from the next screen does not offer to send it again.
    router.replace(routes.family.sent);
  }

  return (
    <form
      className="mx-auto flex min-h-dvh w-full max-w-prose flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <TopBar as="p" title="New report" leading={{ kind: "back", href: routes.family.check }} />
      <ProgressSteps step={4} className="px-gutter pb-1.5" />

      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
        <h1 className="text-title-page text-ink">Before you send</h1>

        <section aria-label="Your report" className="flex flex-col gap-1 rounded-lg bg-surface-soft p-4">
          <div className="flex items-baseline justify-between gap-4">
            <p className="min-w-0 text-title-sm break-words text-ink">{summary.household}</p>
            <Link href={routes.family.check} className="hit shrink-0 text-body-sm font-semibold text-primary">
              Edit
            </Link>
          </div>
          {summary.place ? <p className="text-body-sm text-body">{summary.place}</p> : null}
          <ul className="flex flex-wrap gap-2 pt-2">
            {summary.pills.map((pill) => (
              <li key={pill.label}>
                <Pill dot={pill.dot}>{pill.label}</Pill>
              </li>
            ))}
          </ul>
        </section>

        <ul className="flex flex-col">
          {PROMISES.map((promise) => (
            <li key={promise.label}>
              <Row icon={promise.icon} label={null} value={promise.label} className="border-b-0" />
            </li>
          ))}
        </ul>

        <p role="alert" className="min-h-5 text-body-sm text-danger">
          {error?.message ?? (incomplete ? "Some details are missing. Go back and check your report." : null)}
        </p>
      </main>

      <footer className="bg-canvas px-gutter pt-3 pb-7">
        <Button type="submit" className="w-full" disabled={busy || incomplete}>
          {busy ? "Sending" : error?.retry ? "Try again" : "Agree and send"}
        </Button>
      </footer>
    </form>
  );
}

export { BeforeYouSendForm };
