"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Counter } from "@/components/ui/counter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetTrigger } from "@/components/ui/sheet";
import { Row } from "@/components/ui/row";
import { Textarea } from "@/components/ui/textarea";
import { TopBar } from "@/components/ui/top-bar";

const needs = ["Water", "Food", "Tarp", "Medicine", "Hygiene kit", "Baby needs"];

export function ChipDemo() {
  const [on, setOn] = React.useState<string[]>(["Water", "Tarp"]);
  return (
    <div className="flex flex-wrap gap-2">
      {needs.map((need) => (
        <Chip key={need} pressed={on.includes(need)} onPressedChange={(next) => setOn((current) => (next ? [...current, need] : current.filter((item) => item !== need)))}>
          {need}
        </Chip>
      ))}
      <Chip pressed={false} disabled>
        Disabled
      </Chip>
    </div>
  );
}

export function CounterDemo() {
  const [inHouse, setInHouse] = React.useState(5);
  const [hurt, setHurt] = React.useState(1);
  const [missing, setMissing] = React.useState(0);
  return (
    <div className="flex flex-col divide-y divide-hairline-soft">
      <Counter label="In the house" value={inHouse} onChange={setInHouse} />
      <Counter label="Hurt" value={hurt} onChange={setHurt} max={inHouse} />
      <Counter label="Missing" value={missing} onChange={setMissing} />
    </div>
  );
}

export function SegmentedDemo() {
  const [phone, setPhone] = React.useState("all");
  const [hub, setHub] = React.useState("entries");
  return (
    <div className="flex flex-col items-start gap-4">
      <Segmented
        aria-label="Filter, hub"
        name="kit-segmented-hub"
        size="hub"
        value={hub}
        onValueChange={setHub}
        options={[
          { value: "entries", label: "Entries" },
          { value: "families", label: "Families" },
          { value: "duplicates", label: "Duplicates" },
        ]}
      />
      <Segmented
        aria-label="Filter, phone"
        name="kit-segmented-phone"
        size="phone"
        value={phone}
        onValueChange={setPhone}
        options={[
          { value: "all", label: "All" },
          { value: "urgent", label: "Urgent" },
          { value: "done", label: "Done" },
        ]}
      />
    </div>
  );
}

export function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary">Edit entry</Button>
      </SheetTrigger>
      <SheetContent title="Edit entry">
        <div className="flex flex-col gap-2">
          <Label htmlFor="kit-sheet-name">Head of household</Label>
          <Input id="kit-sheet-name" defaultValue="Rosa Dela Cruz" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="kit-sheet-note">What happened</Label>
          <Textarea id="kit-sheet-note" defaultValue="The roof is gone." />
        </div>
        <SheetFooter>
          <Button>Save changes</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function SelectDemo({ size }: { size: "phone" | "hub" }) {
  return (
    <Select defaultValue="san-isidro">
      <SelectTrigger size={size} aria-label={`Barangay, ${size}`}>
        <SelectValue placeholder="Barangay" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="san-isidro">San Isidro</SelectItem>
        <SelectItem value="santa-cruz">Santa Cruz</SelectItem>
        <SelectItem value="mabini">Mabini</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ButtonRowDemo() {
  const [added, setAdded] = React.useState(false);
  return <Row onClick={() => setAdded(true)} label="Photo" value={added ? "Photo added" : "Add a photo"} />;
}

export function CloseTopBarDemo() {
  const [saved, setSaved] = React.useState(false);
  return (
    <TopBar
      title="Edit"
      leading={{ kind: "close", onClick: () => setSaved(false) }}
      trailing={
        <Button variant="tertiary" size="hub" onClick={() => setSaved(true)}>
          {saved ? "Saved" : "Save"}
        </Button>
      }
    />
  );
}
