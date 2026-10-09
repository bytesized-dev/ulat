import Link from "next/link";
import { IconPlate } from "@/components/ui/icon-plate";
import { Logo } from "@/components/ui/logo";
import { routes } from "@/lib/contracts/routes";
import type { PosterData } from "@/lib/hub/print";
import { PrintSheet } from "./print-sheet";
import { QrCode } from "./qr-code";

const stepTitle = "text-title-bar text-ink";
const stepNote = "text-body-sm text-body";

/** The join poster for the evacuation center on one A4 sheet. */
export function PosterSheet({ poster }: { poster: PosterData }) {
  const steps = [
    { title: `Join Wi-Fi ${poster.wifiName}`, note: poster.wifiPassword ? `Password ${poster.wifiPassword}` : null },
    { title: "Scan the code", note: poster.hubHost ? `Or open ${poster.hubHost}` : null },
    { title: "Tell us what happened", note: "Speak or type" },
  ];

  return (
    <PrintSheet aria-labelledby="poster-title" className="gap-10 p-16">
      <header className="flex items-center justify-between gap-4">
        <Logo priority className="w-24" />
        <span className="text-body-sm text-body">{`MDRRMO, ${poster.town}`}</span>
      </header>

      <h1 id="poster-title" className="text-8xl leading-none font-normal tracking-tighter text-ink">
        Report your home here
      </h1>

      <div className="flex items-center justify-between gap-10">
        <ol className="flex min-w-0 flex-1 list-none flex-col gap-6">
          {steps.map((step, i) => (
            <li key={step.title} className="flex items-center gap-4">
              <IconPlate className="font-mono text-mono-sm">{i + 1}</IconPlate>
              <div className="flex flex-col">
                <p className={stepTitle}>{step.title}</p>
                {step.note ? <p className={stepNote}>{step.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>

        <div className="flex size-60 shrink-0 items-center justify-center rounded-xl bg-surface-soft p-4">
          {poster.hubAddress ? (
            <QrCode value={poster.hubAddress} label={`QR code for ${poster.hubHost}`} className="rounded-lg" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-body-sm text-body">No hub address saved yet.</p>
              <Link href={routes.hub.setup} className="hit text-body-sm font-semibold text-primary print:hidden">
                Kit setup
              </Link>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-auto flex items-center justify-between gap-4 rounded-xl bg-surface-dark px-8 py-6">
        <span className="text-body-md text-canvas">Works without internet.</span>
        <span className="text-body-sm text-muted-soft">No phone? Help desk.</span>
      </footer>
    </PrintSheet>
  );
}
