"use client";

import { useEffect, useLayoutEffect } from "react";
import Link from "next/link";
import { HomeIcon, UsersIcon } from "lucide-react";
import { routes } from "@/lib/contracts";
import { useMounted } from "@/lib/use-mounted";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TopBar } from "@/components/ui/top-bar";
import { HouseholdOption } from "./household-option";
import type { ReportDraft } from "./report-draft";
import { useReportDraft, updateDraft } from "./use-report-draft";

type WhoseHouseholdFormProps = {
  /** The barangays from the hub's settings. */
  barangays: string[];
  /** The choices for where a neighbor can be found. */
  whereToFind: string[];
  /** The household the link asked for, as in /report?for=neighbor. */
  requestedSource?: ReportDraft["source"] | null;
};

type FieldProps = {
  id: string;
  label: string;
  children: React.ReactNode;
};

function Field({ id, label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-body-sm font-semibold leading-normal text-ink">
        {label}
      </Label>
      {children}
    </div>
  );
}

type ListSelectProps = {
  id: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
};

function ListSelect({ id, value, options, onChange }: ListSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={options.length === 0}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((name) => (
          <SelectItem key={name} value={name}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Step 1 of 4. Every change goes straight into the report draft, so leaving
// and coming back keeps the answers. The barangay shown is the saved one when
// it is still on the hub's list, and the first one otherwise. The same goes for
// where to find a neighbor.
function WhoseHouseholdForm({ barangays, whereToFind, requestedSource = null }: WhoseHouseholdFormProps) {
  const draft = useReportDraft();
  const mounted = useMounted();
  // Until the page hydrates the draft is the empty server one, so the layout
  // follows the link: /report?for=neighbor starts as a neighbor's report.
  const source = mounted ? draft.source : (requestedSource ?? draft.source);
  const neighbor = source === "neighbor";
  const barangay = barangays.includes(draft.barangay) ? draft.barangay : (barangays[0] ?? "");
  const reporterWhere = whereToFind.includes(draft.reporter_where) ? draft.reporter_where : (whereToFind[0] ?? "");

  // The link sets the household once, when the page opens, and the family can
  // still change it. A layout effect keeps the saved draft from showing the
  // other layout for a frame.
  useLayoutEffect(() => {
    if (mounted && requestedSource) updateDraft({ source: requestedSource });
  }, [mounted, requestedSource]);

  // The selects show the first choice before anyone picks one, so save it too.
  // Otherwise the draft would say nothing for what the family sees. This waits
  // for hydration, because until then the draft is the empty server one and
  // would overwrite a choice saved earlier. Where to find you only counts for
  // a neighbor's report.
  useEffect(() => {
    if (!mounted) return;
    if (barangay !== draft.barangay) updateDraft({ barangay });
    if (neighbor && reporterWhere !== draft.reporter_where) updateDraft({ reporter_where: reporterWhere });
  }, [mounted, neighbor, barangay, draft.barangay, reporterWhere, draft.reporter_where]);

  const barangayField = (
    <Field id="barangay" label="Barangay">
      <ListSelect id="barangay" value={barangay} options={barangays} onChange={(value) => updateDraft({ barangay: value })} />
    </Field>
  );

  const purokField = (
    <Field id="purok" label="Purok">
      <Input id="purok" value={draft.purok} placeholder="Purok 3" autoComplete="off" onChange={(event) => updateDraft({ purok: event.target.value })} />
    </Field>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-prose flex-col">
      <TopBar title="New report" as="p" leading={{ kind: "back", href: routes.family.home }} />
      <ProgressSteps step={1} className="px-gutter pb-1.5" />

      <main className="flex flex-1 flex-col gap-7 px-gutter pt-5 pb-7">
        <h1 className="text-title-page text-ink">Whose household?</h1>

        <div role="radiogroup" aria-label="Household" className="flex flex-col">
          <HouseholdOption
            name="who"
            icon={<HomeIcon />}
            label="My household"
            checked={!neighbor}
            onChange={() => updateDraft({ source: "family" })}
          />
          <HouseholdOption
            name="who"
            icon={<UsersIcon />}
            label="A neighbor's"
            checked={neighbor}
            onChange={() => updateDraft({ source: "neighbor" })}
          />
        </div>

        {neighbor ? (
          <>
            <section aria-labelledby="their-house" className="flex flex-col gap-4.5">
              <h2 id="their-house" className="text-title-md text-ink">
                Their house
              </h2>
              {barangayField}
              {purokField}
              <Field id="household-head" label="Their name">
                <Input id="household-head" value={draft.household_head} autoComplete="off" onChange={(event) => updateDraft({ household_head: event.target.value })} />
              </Field>
            </section>

            <section aria-labelledby="you" className="flex flex-col gap-4.5">
              <h2 id="you" className="text-title-md text-ink">
                You
              </h2>
              <Field id="reporter-name" label="Your name">
                <Input id="reporter-name" value={draft.reporter_name} autoComplete="name" onChange={(event) => updateDraft({ reporter_name: event.target.value })} />
              </Field>
              <Field id="reporter-where" label="Where to find you">
                <ListSelect id="reporter-where" value={reporterWhere} options={whereToFind} onChange={(value) => updateDraft({ reporter_where: value })} />
              </Field>
            </section>
          </>
        ) : (
          <div className="flex flex-col gap-4.5">
            {barangayField}
            {purokField}
          </div>
        )}
      </main>

      <footer className="px-gutter pt-3 pb-7">
        <Button asChild className="w-full">
          <Link href={routes.family.voice}>
            Continue
          </Link>
        </Button>
      </footer>
    </div>
  );
}

export { WhoseHouseholdForm };
export type { WhoseHouseholdFormProps };
