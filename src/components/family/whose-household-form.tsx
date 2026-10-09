"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HomeIcon, UsersIcon } from "lucide-react";
import { routes } from "@/lib/contracts";
import { useMounted } from "@/lib/use-mounted";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { SearchSelect } from "@/components/ui/search-select";
import { TopBar } from "@/components/ui/top-bar";
import { HouseholdOption } from "./household-option";
import type { ReportDraft } from "./report-draft";
import { useReportDraft, updateDraft } from "./use-report-draft";
import { firstMissing, type StartError, type StartField } from "./whose-household";

type WhoseHouseholdFormProps = {
  /** The barangays from the hub's settings. */
  barangays: string[];
  /** The household the link asked for, as in /report?for=neighbor. */
  requestedSource?: ReportDraft["source"] | null;
};

type FieldProps = {
  id: string;
  label: string;
  /** What is wrong with the field, shown under it. */
  error?: string;
  children: React.ReactNode;
};

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-body-sm font-semibold leading-normal text-ink">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-body-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// A focused field scrolls into view above the footer, never under it: the
// margin is a little more than the footer is tall.
const CLEAR_OF_FOOTER = "scroll-mb-36";

// Step 1 of 4. Every change goes straight into the report draft, so leaving
// and coming back keeps the answers. Nothing is picked for the family: the
// barangay stays empty until they choose one. Continue checks the required
// fields, shows the first one that is empty and moves focus to it.
function WhoseHouseholdForm({ barangays, requestedSource = null }: WhoseHouseholdFormProps) {
  const router = useRouter();
  const draft = useReportDraft();
  const mounted = useMounted();
  const [error, setError] = useState<StartError | null>(null);
  const fields = useRef<Record<StartField, HTMLElement | null>>({ household_head: null, barangay: null, reporter_name: null });
  // Until the page hydrates the draft is the empty server one, so the layout
  // follows the link: /report?for=neighbor starts as a neighbor's report.
  const source = mounted ? draft.source : (requestedSource ?? draft.source);
  const neighbor = source === "neighbor";
  // A saved barangay the hub no longer lists shows as not chosen.
  const barangay = barangays.includes(draft.barangay) ? draft.barangay : "";

  // The link sets the household once, when the page opens, and the family can
  // still change it. A layout effect keeps the saved draft from showing the
  // other layout for a frame.
  useLayoutEffect(() => {
    if (mounted && requestedSource) updateDraft({ source: requestedSource });
  }, [mounted, requestedSource]);

  // Focus follows the message, once it is on screen. Each tap on Continue sets
  // a new error, so the same field is focused again if it is still empty.
  useEffect(() => {
    if (error) fields.current[error.field]?.focus();
  }, [error]);

  function change(field: StartField | null, update: Partial<ReportDraft>) {
    updateDraft(update);
    if (field && error?.field === field) setError(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = firstMissing({ ...draft, source, barangay }, barangays);
    setError(missing);
    if (!missing) router.push(routes.family.voice);
  }

  function fieldProps(field: StartField, id: string) {
    const invalid = error?.field === field;
    return {
      id,
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? `${id}-error` : undefined,
      className: CLEAR_OF_FOOTER,
    };
  }

  const errorFor = (field: StartField) => (error?.field === field ? error.message : undefined);

  const barangayField = (
    <Field id="barangay" label="Barangay" error={errorFor("barangay")}>
      <SearchSelect
        {...fieldProps("barangay", "barangay")}
        ref={(node) => {
          fields.current.barangay = node;
        }}
        title="Barangay"
        placeholder="Choose barangay"
        options={barangays}
        value={barangay}
        onValueChange={(value) => change("barangay", { barangay: value })}
      />
    </Field>
  );

  const purokField = (
    <Field id="purok" label="Purok">
      <Input id="purok" className={CLEAR_OF_FOOTER} value={draft.purok} maxLength={60} autoComplete="off" onChange={(event) => change(null, { purok: event.target.value })} />
    </Field>
  );

  const headField = (
    <Field id="household-head" label={neighbor ? "Neighbor's name" : "Head of household"} error={errorFor("household_head")}>
      <Input
        {...fieldProps("household_head", "household-head")}
        ref={(node) => {
          fields.current.household_head = node;
        }}
        value={draft.household_head}
        maxLength={120}
        autoComplete="off"
        onChange={(event) => change("household_head", { household_head: event.target.value })}
      />
    </Field>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      <TopBar title="New report" as="p" leading={{ kind: "back", href: routes.family.home }} />
      <ProgressSteps step={1} className="px-gutter pb-1.5" />

      <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col">
        <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
          <h1 className="text-title-page text-ink">Whose household?</h1>

          <div role="radiogroup" aria-label="Household" className="flex flex-col">
            <HouseholdOption
              name="who"
              icon={<HomeIcon />}
              label="My household"
              checked={!neighbor}
              onChange={() => {
                setError(null);
                updateDraft({ source: "family" });
              }}
            />
            <HouseholdOption
              name="who"
              icon={<UsersIcon />}
              label="A neighbor's"
              checked={neighbor}
              onChange={() => {
                setError(null);
                updateDraft({ source: "neighbor" });
              }}
            />
          </div>

          {headField}

          <section aria-labelledby="location" className="flex flex-col gap-4.5">
            <h2 id="location" className="text-title-md text-ink">
              {neighbor ? "Neighbor's location" : "Your location"}
            </h2>
            {barangayField}
            {purokField}
          </section>

          {neighbor ? (
            <section aria-labelledby="about-you" className="flex flex-col gap-4.5">
              <h2 id="about-you" className="text-title-md text-ink">
                About you
              </h2>
              <Field id="reporter-name" label="Your name" error={errorFor("reporter_name")}>
                <Input
                  {...fieldProps("reporter_name", "reporter-name")}
                  ref={(node) => {
                    fields.current.reporter_name = node;
                  }}
                  value={draft.reporter_name}
                  maxLength={120}
                  autoComplete="name"
                  onChange={(event) => change("reporter_name", { reporter_name: event.target.value })}
                />
              </Field>
              <Field id="reporter-where" label="Where to find you">
                <Input
                  id="reporter-where"
                  className={CLEAR_OF_FOOTER}
                  value={draft.reporter_where}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(event) => change(null, { reporter_where: event.target.value })}
                />
              </Field>
            </section>
          ) : null}
        </main>

        <footer className="sticky bottom-0 border-t border-hairline bg-canvas px-gutter pt-3 pb-7">
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </footer>
      </form>
    </div>
  );
}

export { WhoseHouseholdForm };
export type { WhoseHouseholdFormProps };
