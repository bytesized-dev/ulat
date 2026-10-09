"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setSimulationAction } from "@/lib/clear-data/actions";

/** The Simulation mode switch of the Kit setup page. It saves through setSimulationAction. */
export function SimulationSwitch({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    const before = on;
    setOn(next);
    setFailed(false);
    startTransition(async () => {
      const result = await setSimulationAction(next);
      if (!result.ok) {
        setOn(before);
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="simulation-switch" className="text-body-sm font-semibold text-ink">
        Simulation
      </label>
      <Switch id="simulation-switch" aria-label="Simulation mode" checked={on} disabled={pending} onCheckedChange={change} />
      {failed ? (
        <span role="alert" className="text-body-sm text-danger">
          Not saved
        </span>
      ) : null}
    </div>
  );
}
