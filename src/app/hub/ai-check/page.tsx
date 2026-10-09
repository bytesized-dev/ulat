import type { Metadata } from "next";
import { AiCheckEmpty, AiCheckHero, AiCheckRail, DamageClassTable, VoiceNotesTable } from "@/components/hub/kit/ai-check-sections";
import { HubPage } from "@/components/hub/hub-page";
import { routes } from "@/lib/contracts/routes";
import { readEvalResults } from "@/lib/hub/ai-check";

export const metadata: Metadata = { title: "AI check" };

// The page reads eval/results.json on every request, so a new run shows on reload.
export const dynamic = "force-dynamic";

// Shows what `pnpm eval` wrote. It never calls the model.
export default async function AiCheckPage() {
  const reading = await readEvalResults();
  return (
    <HubPage title="AI check" active={routes.hub.aiCheck} rail={<AiCheckRail reading={reading} />}>
      {reading.status === "ok" ? (
        <div className="flex flex-col gap-9">
          <AiCheckHero results={reading.results} />
          <DamageClassTable results={reading.results} />
          <VoiceNotesTable results={reading.results} />
        </div>
      ) : (
        <AiCheckEmpty reading={reading} />
      )}
    </HubPage>
  );
}
