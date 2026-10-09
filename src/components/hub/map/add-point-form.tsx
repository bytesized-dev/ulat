"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { routes } from "@/lib/contracts/routes";
import { savePlace } from "@/lib/hub/api-client";
import type { NewPlaceInput } from "@/lib/hub/places";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";

type AddPointFormProps = {
  /** Where the pin is on the map. Save waits for one. */
  position: { lat: number; lng: number } | null;
  /** Saves the place. Returns false when it did not go through. */
  onSave?: (place: NewPlaceInput) => Promise<boolean>;
};

const typeOptions: { value: NewPlaceInput["type"]; label: string }[] = [
  { value: "relief", label: "Relief" },
  { value: "shelter", label: "Shelter" },
  { value: "hazard", label: "Hazard" },
];

const fieldLabel = "text-caption-strong text-ink";

// The rail on /hub/map/add. The map beside it places the pin and passes the
// position in. Saving goes back to the hub map.
export function AddPointForm({ position, onSave = savePlace }: AddPointFormProps) {
  const router = useRouter();
  const [type, setType] = React.useState<NewPlaceInput["type"]>("relief");
  const [name, setName] = React.useState("");
  const [when, setWhen] = React.useState("");
  const [visible, setVisible] = React.useState(true);
  const [postAsUpdate, setPostAsUpdate] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!position) return;
    setSaving(true);
    setFailed(false);
    const ok = await onSave({
      type,
      name: name.trim(),
      details: null,
      when_text: when.trim() || null,
      lat: position.lat,
      lng: position.lng,
      visible,
      post_as_update: visible && postAsUpdate,
    });
    setSaving(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    router.push(routes.hub.map);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <h2 className="text-display-md">Add a point</h2>

      <Segmented aria-label="Type" name="place-type" options={typeOptions} value={type} onValueChange={setType} className="self-start" />

      <div className="flex flex-col gap-2">
        <Label htmlFor="place-name" className={fieldLabel}>
          What&apos;s there
        </Label>
        <Input id="place-name" size="hub" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="place-when" className={fieldLabel}>
          When
        </Label>
        <Input id="place-when" size="hub" maxLength={80} value={when} onChange={(e) => setWhen(e.target.value)} />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="hit h-11 gap-3 text-body-sm font-medium">
          <Checkbox checked={visible} onCheckedChange={(checked) => setVisible(checked === true)} className="size-4.5" />
          Show to families
        </Label>
        <Label className="hit h-11 gap-3 text-body-sm font-medium">
          <Checkbox
            checked={visible && postAsUpdate}
            disabled={!visible}
            onCheckedChange={(checked) => setPostAsUpdate(checked === true)}
            className="size-4.5"
          />
          Post as update
        </Label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="hub" disabled={saving || !position || !name.trim()}>
          Save
        </Button>
        <Button asChild size="hub" variant="secondary">
          <Link href={routes.hub.map}>Cancel</Link>
        </Button>
      </div>
      {failed ? (
        <p role="alert" className="text-body-sm text-danger">
          Could not save. Try again.
        </p>
      ) : null}
    </form>
  );
}
