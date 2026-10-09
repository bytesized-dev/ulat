"use client";

import { useEffect } from "react";
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
import { useReportDraft, updateDraft } from "./use-report-draft";

type WhoseHouseholdFormProps = {
  /** The barangays from the hub's settings. */
  barangays: string[];
};

// Step 1 of 4. Every change goes straight into the report draft, so leaving
// and coming back keeps the answers. The barangay shown is the saved one when
// it is still on the hub's list, and the first one otherwise.
function WhoseHouseholdForm({ barangays }: WhoseHouseholdFormProps) {
  const draft = useReportDraft();
  const mounted = useMounted();
  const barangay = barangays.includes(draft.barangay) ? draft.barangay : (barangays[0] ?? "");

  // The select shows the first barangay before anyone picks one, so save it
  // too. Otherwise the draft would say nothing for what the family sees. It
  // waits for hydration, because until then the draft is the empty server one
  // and would overwrite a barangay saved earlier.
  useEffect(() => {
    if (mounted && barangay !== draft.barangay) updateDraft({ barangay });
  }, [mounted, barangay, draft.barangay]);

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
            checked={draft.source === "family"}
            onChange={() => updateDraft({ source: "family" })}
          />
          <HouseholdOption
            name="who"
            icon={<UsersIcon />}
            label="A neighbor's"
            checked={draft.source === "neighbor"}
            onChange={() => updateDraft({ source: "neighbor" })}
          />
        </div>

        <div className="flex flex-col gap-4.5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="barangay" className="text-body-sm font-semibold leading-normal text-ink">
              Barangay
            </Label>
            <Select value={barangay} onValueChange={(value) => updateDraft({ barangay: value })} disabled={barangays.length === 0}>
              <SelectTrigger id="barangay">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {barangays.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="purok" className="text-body-sm font-semibold leading-normal text-ink">
              Purok
            </Label>
            <Input id="purok" value={draft.purok} placeholder="Purok 3" autoComplete="off" onChange={(event) => updateDraft({ purok: event.target.value })} />
          </div>
        </div>
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
