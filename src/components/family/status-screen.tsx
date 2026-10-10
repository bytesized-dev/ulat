"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { StatusDot } from "@/components/ui/status-dot";
import { Timeline } from "@/components/ui/timeline";
import { TopBar } from "@/components/ui/top-bar";
import { routes } from "@/lib/contracts";
import { parseSentReport, readSentRaw } from "./sent-report";
import { useReportStatus } from "./use-report-status";
import { normalizeCode, placeOf, resultOf, timelineItems } from "./status-view";
import { FamilyScreen } from "./family-screen";

// A family looks up its own report by code. Before a responder confirms it,
// the screen shows the household and where the report is. After, it leads with
// the result. It stays current on its own while it is open. With no code in the
// link, it opens the report this phone sent, so nobody types the code again.
// Check another code puts the lookup back.
const subscribeNever = () => () => {};

function StatusScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const linked = normalizeCode(params.get("code") ?? "") || null;
  const saved = parseSentReport(useSyncExternalStore(subscribeNever, readSentRaw, () => null))?.code ?? null;
  const [typed, setTyped] = useState<string | null>(null);
  const [another, setAnother] = useState(false);
  const code = linked ?? (another ? null : saved);
  const { view, message, refresh } = useReportStatus(code);
  const errorId = useId();

  const result = view ? resultOf(view) : null;

  function checkAnother() {
    setAnother(true);
    setTyped("");
    if (linked) router.replace(routes.family.status());
  }

  if (view && result) {
    return (
      <FamilyScreen>
        <TopBar title={`Report ${view.code}`} as="p" leading={{ kind: "back", href: routes.family.home }} />
        <main className="flex flex-1 flex-col gap-6 px-gutter pt-5 pb-7">
          <div className="flex flex-col gap-1">
            <p className="text-caption text-body">Result</p>
            <h1 className="flex items-center gap-3 text-display-md text-ink">
              <StatusDot tone={result.tone} className="size-3" />
              {result.label}
            </h1>
            {result.confirmedBy ? <p className="text-body-sm text-body">Confirmed by {result.confirmedBy}</p> : null}
          </div>
          <Timeline aria-label="Report progress" items={timelineItems(view)} />
          <p className="rounded-xl bg-surface-soft p-4 text-body-sm text-body">Ask the help desk about relief. Bring your code.</p>
          <Button type="button" variant="tertiary" className="w-full" onClick={checkAnother}>
            Check another code
          </Button>
        </main>
      </FamilyScreen>
    );
  }

  // Shows what the family typed, or the code being shown until they type.
  const field = typed ?? code ?? "";

  return (
    <FamilyScreen>
      <TopBar title="My report" leading={{ kind: "back", href: routes.family.home }} />
      <main className="flex flex-1 flex-col gap-6 px-gutter pt-5 pb-7">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = normalizeCode(field);
            if (!next) return;
            if (next === code) refresh();
            else router.replace(routes.family.status(next));
          }}
        >
          <Label htmlFor="code" className="sr-only">
            Report code
          </Label>
          <div className="flex gap-2">
            <Input
              id="code"
              value={field}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={8}
              placeholder="K7P4"
              aria-invalid={message && !view ? true : undefined}
              aria-describedby={message && !view ? errorId : undefined}
              className="rounded-pill border-transparent bg-surface-strong font-mono tracking-widest uppercase"
            />
            <Button type="submit">Check</Button>
          </div>
          {message && !view ? (
            <p id={errorId} role="alert" className="px-1 text-body-sm text-danger">
              {message}
            </p>
          ) : null}
        </form>

        {view ? (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-title-sm text-ink">{view.household_head}</p>
                {view.urgent ? <Pill dot="danger">Urgent</Pill> : null}
              </div>
              <p className="text-body-sm text-body">{placeOf(view)}</p>
            </div>
            <Timeline aria-label="Report progress" items={timelineItems(view)} />
            {message ? (
              <p role="status" className="text-body-sm text-body">
                {message}
              </p>
            ) : null}
          </>
        ) : null}
      </main>
    </FamilyScreen>
  );
}

export { StatusScreen };
