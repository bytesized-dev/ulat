"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon } from "lucide-react";
import { routes } from "@/lib/contracts";
import { formatTime } from "@/lib/time";
import { useMounted } from "@/lib/use-mounted";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/ui/timeline";
import { TopBar } from "@/components/ui/top-bar";
import { clearDraft } from "./report-draft";
import { parseSentReport, readSentRaw, takeSentFromDraft } from "./sent-report";

const subscribeNever = () => () => {};

/** Copies with the clipboard API, and with a hidden field where the page is not on HTTPS. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the older way.
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.className = "fixed top-0 left-0 opacity-0";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

// The report is already on the hub. This screen shows its code and where it
// goes next. A family that lands here without having sent one goes home.
function ReportSent() {
  const router = useRouter();
  const mounted = useMounted();
  const raw = useSyncExternalStore(subscribeNever, () => readSentRaw(), () => null);
  const sent = useMemo(() => parseSentReport(raw), [raw]);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (!mounted) return;
    // Only the report just sent from the draft spends it. An older code opened by
    // its address must not wipe a draft the family is still filling in.
    if (sent) {
      if (takeSentFromDraft(sent.code)) clearDraft();
    } else router.replace(routes.family.home);
  }, [mounted, sent, router]);

  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), 2500);
    return () => clearTimeout(timer);
  }, [copy]);

  if (!sent) return null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      <TopBar as="p" title="" leading={{ kind: "close", href: routes.family.home }} />

      <main className="flex flex-1 flex-col gap-8 px-gutter pt-5 pb-7">
        <div className="flex flex-col items-center gap-5 pt-6 text-center">
          <span aria-hidden="true" className="flex size-18 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-9" strokeWidth={2.4} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-title-page text-ink">Report sent</h1>
            <p className="text-body-md text-body">Responders can see it now.</p>
          </div>
        </div>

        <section aria-label="Your report code" className="flex flex-col items-center gap-3.5 rounded-lg bg-surface-soft p-6 text-center">
          <p className="text-body-sm text-body">Your report code</p>
          <p className="pl-2 font-mono text-mono-lg text-ink tabular" aria-label={sent.code.split("").join(" ")}>
            {sent.code}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="hub"
            className="bg-canvas"
            onClick={async () => setCopy((await copyText(sent.code)) ? "copied" : "failed")}
          >
            {copy === "copied" ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
            {copy === "copied" ? "Copied" : "Copy code"}
          </Button>
          {/* Read out when the code is copied, and shown only when copying fails. */}
          <p role="status" className={copy === "failed" ? "text-body-sm text-body" : "sr-only"}>
            {copy === "copied" ? "Code copied" : copy === "failed" ? "Could not copy. Write the code down." : null}
          </p>
        </section>

        <Timeline
          aria-label="Your report"
          className="px-1"
          items={[
            { label: "Sent", time: formatTime(sent.sent_at), state: "done" },
            { label: "Responder visits", state: "current" },
            { label: "Counted", state: "upcoming" },
          ]}
        />
      </main>

      <footer className="flex flex-col gap-2.5 bg-canvas px-gutter pt-3 pb-7">
        <Button asChild>
          <Link href={routes.family.status(sent.code)}>Check my report</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={routes.family.home}>Done</Link>
        </Button>
      </footer>
    </div>
  );
}

export { ReportSent };
