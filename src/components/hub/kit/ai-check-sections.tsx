import * as React from "react";
import { DarkHero } from "@/components/ui/dark-hero";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import { formatDate, formatTime } from "@/lib/time";
import {
  AI_ANSWERS,
  DAMAGE_CLASSES,
  VOICE_LANGUAGE_ROWS,
  weakSpots,
  type AiCheckReading,
  type EvalResultsFile,
} from "@/lib/hub/ai-check";
import { formatCount, formatRate, formatSeconds, modelLabel } from "@/lib/hub/kit-format";
import { KitRow, KitRows } from "./kit-card";

/** The stats under the last run date. "Sec per photo" is the median, because the first call includes loading the model. */
export function AiCheckHero({ results }: { results: EvalResultsFile }) {
  const stats = [
    { label: "Test photos", value: formatCount(results.counts.photos.run) },
    { label: "People agreed", value: formatRate(results.photos.agreement.rate) },
    { label: "AI matched", value: formatRate(results.photos.accuracy.rate) },
    { label: "Sec per photo", value: formatSeconds(results.photos.seconds.median) },
  ];
  return (
    <DarkHero size="hub" as="h2" eyebrow={`Last run ${formatDate(results.generated_at)}, ${formatTime(results.generated_at)}`}>
      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-body-sm text-muted-soft">{stat.label}</dt>
            <dd className="font-mono text-mono-md text-canvas tabular">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </DarkHero>
  );
}

/** What the page shows when pnpm eval has not written a file, or wrote one the page cannot read. */
export function AiCheckEmpty({ reading }: { reading: Exclude<AiCheckReading, { status: "ok" }> }) {
  return (
    <section className="rounded-xl bg-surface-soft p-8">
      <h2 className="text-title-md text-ink">{reading.status === "missing" ? "Not run yet" : "Results not readable"}</h2>
      <p className="mt-2 text-body-sm text-body">
        {reading.status === "invalid" ? `${reading.reason} ` : null}
        {reading.status === "missing" ? "Run this on the hub with Ollama running, then reload." : "Run this again to write a new file."}
      </p>
      <code className="mt-4 inline-block rounded-md bg-surface-strong px-3 py-2 font-mono text-mono-sm text-ink">pnpm eval</code>
    </section>
  );
}

/** Labeled by people on the left, answered by the AI across the top. Partial and total mixed up carry a warning dot. */
export function DamageClassTable({ results }: { results: EvalResultsFile }) {
  const matrix = results.photos.confusion_matrix;
  return (
    <section aria-labelledby="damage-class">
      <h2 id="damage-class" className="text-title-md text-ink">
        Damage class
      </h2>
      <div role="table" aria-label="Labeled damage class against the AI answer" className="mt-4 grid grid-cols-5 gap-2">
        <div role="row" className="contents">
          <span role="columnheader" className="text-caption text-muted-text">
            Labeled
          </span>
          {AI_ANSWERS.map((answer) => (
            <span key={answer.id} role="columnheader" className="text-center text-caption text-muted-text">
              {answer.label}
            </span>
          ))}
        </div>
        {DAMAGE_CLASSES.map((row) => (
          <div key={row.id} role="row" className="contents">
            <span role="rowheader" className="flex items-center text-body-md font-semibold text-ink">
              {row.label}
            </span>
            {AI_ANSWERS.map((answer) => {
              const correct = row.id === answer.id;
              const mixedUp = (row.id === "partial" && answer.id === "total") || (row.id === "total" && answer.id === "partial");
              return (
                <span
                  key={answer.id}
                  role="cell"
                  className={cn(
                    "flex h-12 items-center justify-center gap-2 rounded-md font-mono text-mono-sm tabular",
                    correct ? "bg-surface-dark text-canvas" : "bg-surface-soft text-ink",
                  )}
                >
                  {mixedUp ? <StatusDot tone="warning" label="Partial and total mixed up" /> : null}
                  {formatCount(matrix[row.id][answer.id])}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 text-caption text-muted-text">Yellow dots: partial and total mixed up.</p>
    </section>
  );
}

export function VoiceNotesTable({ results }: { results: EvalResultsFile }) {
  return (
    <section aria-labelledby="voice-notes">
      <h2 id="voice-notes" className="text-title-md text-ink">
        Voice notes
      </h2>
      <table className="mt-4 w-full text-body-md">
        <thead>
          <tr className="text-caption text-muted-text">
            <th scope="col" className="py-2 text-left font-medium">Language</th>
            <th scope="col" className="py-2 text-right font-medium">Notes</th>
            <th scope="col" className="py-2 text-right font-medium">All right</th>
          </tr>
        </thead>
        <tbody>
          {VOICE_LANGUAGE_ROWS.map((row) => {
            const language = results.voice.languages[row.id];
            return (
              <tr key={row.id} className="border-t border-hairline-soft">
                <th scope="row" className="h-12 text-left font-semibold text-ink">{row.label}</th>
                <td className="text-right font-mono text-mono-sm tabular">{formatCount(language.notes)}</td>
                <td className="text-right font-mono text-mono-sm tabular">{formatRate(language.all_right_rate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/** The right rail. Running and Weak spots read the file, and the two fixed rows state how the hub is built. */
export function AiCheckRail({ reading }: { reading: AiCheckReading }) {
  const results = reading.status === "ok" ? reading.results : null;
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-title-md text-ink">Running</h2>
        <KitRows className="mt-3">
          <KitRow label="Model">{results ? modelLabel(results.model) : "Unknown"}</KitRow>
          <KitRow label="Where">This laptop</KitRow>
          <KitRow label="Sent online">None</KitRow>
        </KitRows>
      </section>
      <section>
        <h2 className="text-title-md text-ink">Power</h2>
        <KitRows className="mt-3">
          <KitRow label="Per 100 houses" mono>
            {results?.battery.percent_per_100_houses != null ? formatPercentPoints(results.battery.percent_per_100_houses) : "n/a"}
          </KitRow>
          <KitRow label="Per charge" mono>
            {formatCount(results?.battery.houses_per_full_charge)}
          </KitRow>
        </KitRows>
      </section>
      <section>
        <h2 className="text-title-md text-ink">Weak spots</h2>
        {results ? (
          <ul className="mt-3 flex flex-col gap-2 text-body-sm text-body">
            {weakSpots(results).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-body-sm text-body">Nothing to show until the AI check has run.</p>
        )}
      </section>
    </div>
  );
}

/** Battery percent used, such as "12%". The file holds percent points, not a 0 to 1 rate. */
function formatPercentPoints(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}
