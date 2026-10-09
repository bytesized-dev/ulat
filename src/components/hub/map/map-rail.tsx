"use client";

import Link from "next/link";
import { PinMark } from "@/components/map/pin-mark";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/pill";
import { LAYERS, summarizePoint } from "@/lib/hub/map-layers";
import { useHubMap } from "./map-provider";

const heading = "text-title-md text-ink";

/** The selected pin, then a toggle with a count for each layer. */
export function HubMapRail() {
  const { selected, layers, counts, toggle } = useHubMap();
  const summary = selected ? summarizePoint(selected) : null;

  return (
    <div className="flex flex-col gap-9">
      <section aria-labelledby="selected-pin" aria-live="polite" className="flex flex-col items-start gap-3">
        <p id="selected-pin" className="text-caption text-muted-text">
          Selected
        </p>
        {selected && summary ? (
          <>
            <h2 className="text-title-bar text-ink">{selected.title}</h2>
            <Pill dot={summary.tone}>{summary.status}</Pill>
            {selected.detail ? <p className="text-body-sm text-body">{selected.detail}</p> : null}
            {summary.action ? (
              <Button asChild variant="secondary" size="hub" className="mt-1 w-full">
                <Link href={summary.action.href}>{summary.action.label}</Link>
              </Button>
            ) : null}
          </>
        ) : (
          <p className="text-body-sm text-body">Select a pin on the map to see it here</p>
        )}
      </section>

      <section aria-labelledby="layers">
        <h2 id="layers" className={heading}>
          Layers
        </h2>
        <ul className="mt-2 flex flex-col">
          {LAYERS.map(({ layer, label, swatch }) => (
            <li key={layer}>
              <Label className="hit h-11 gap-3 text-body-sm font-medium">
                <Checkbox checked={layers[layer]} onCheckedChange={() => toggle(layer)} className="size-4.5" />
                <PinMark kind={swatch} at="legend" />
                {label}
                <span className="ml-auto font-mono text-mono-xs text-muted-text">{counts[layer]}</span>
              </Label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
