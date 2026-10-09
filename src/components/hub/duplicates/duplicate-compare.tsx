import { MapView, type MapPin } from "@/components/map";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DUPLICATE_RADIUS_M, needsLabel, normalizeName, type DuplicatePair, type DuplicateSide } from "@/lib/hub/duplicates";
import { bboxCenter, type Bbox } from "@/lib/hub/map-projection";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type DuplicateCompareProps = {
  pair: DuplicatePair;
  /** The town's box. The map starts there and then moves in on the pair. */
  bbox: Bbox;
};

const head = "h-auto px-0 pb-3 text-caption text-muted-text";
const cell = "px-0 py-3.5 pr-4 text-body-sm";

/** The two sides of a row. Values that differ are bold, so the gap is the first thing the eye finds. */
function rows(a: DuplicateSide, b: DuplicateSide): { field: string; a: string; b: string }[] {
  const place = (s: DuplicateSide) => [s.barangay, s.purok].filter(Boolean).join(", ");
  const sent = (s: DuplicateSide) => `${formatTime(s.sent_at)}, ${s.sent_by}`;
  return [
    { field: "Name", a: a.household_head, b: b.household_head },
    { field: "Purok", a: place(a), b: place(b) },
    { field: "People", a: String(a.people), b: String(b.people) },
    { field: "Hurt", a: String(a.hurt), b: String(b.hurt) },
    { field: "Missing", a: String(a.missing), b: String(b.missing) },
    { field: "Needs", a: needsLabel(a.needs), b: needsLabel(b.needs) },
    { field: "Sent", a: sent(a), b: sent(b) },
  ];
}

/** The same text apart from case and spacing is not a difference worth bold. */
const differs = (a: string, b: string) => normalizeName(a) !== normalizeName(b);

const kind = (s: DuplicateSide) => (s.type === "report" ? "report" : "entry");

/** "Two reports", "A report and an entry", with the distance in mono when both have GPS. */
function Lead({ pair }: { pair: DuplicatePair }) {
  const what = pair.a.type === pair.b.type ? "Two reports" : `A ${kind(pair.a)} and an ${kind(pair.b)}`;
  if (pair.distance_m === null) return <p className="text-body-sm text-muted-text">{what}, no GPS</p>;
  return (
    <p className="text-body-sm text-muted-text">
      {what}, <span className="font-mono text-mono-sm">{Math.round(pair.distance_m)} m</span> apart
    </p>
  );
}

/** The pair side by side: heading, a small map when both have GPS, and the fields in two columns. */
function DuplicateCompare({ pair, bbox }: DuplicateCompareProps) {
  const { a, b } = pair;
  const pins: MapPin[] = [a, b].flatMap((side) =>
    side.lat !== null && side.lng !== null
      ? [{ id: `${side.type}-${side.id}`, kind: "unvisited" as const, lat: side.lat, lng: side.lng, label: `${side.label}, ${side.household_head}` }]
      : [],
  );
  const middle =
    pins.length === 2 ? bboxCenter([Math.min(...pins.map((p) => p.lng)), Math.min(...pins.map((p) => p.lat)), Math.max(...pins.map((p) => p.lng)), Math.max(...pins.map((p) => p.lat))]) : null;

  return (
    <div className="flex flex-col gap-9">
      <section aria-labelledby="pair-title" className="flex flex-col gap-1">
        <h2 id="pair-title" className="text-display-md text-ink">
          {a.household_head}
        </h2>
        <Lead pair={pair} />
      </section>

      {middle ? (
        <MapView
          layout="hub"
          label={`Where the two are, within ${DUPLICATE_RADIUS_M} m`}
          bbox={bbox}
          pins={pins}
          selectedId={pins[0].id}
          focus={middle}
          zoomControls={false}
          className="h-55"
        />
      ) : null}

      <Table>
        <TableHeader>
          <TableRow className="border-hairline-soft hover:bg-transparent">
            <TableHead className={head}>Field</TableHead>
            <TableHead className={cn(head, "font-mono text-mono-xs")}>{a.label}</TableHead>
            <TableHead className={cn(head, "font-mono text-mono-xs")}>{b.label}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows(a, b).map((row) => (
            <TableRow key={row.field} className="border-hairline-soft hover:bg-transparent">
              <TableCell className={cn(cell, "text-muted-text")}>{row.field}</TableCell>
              <TableCell className={cn(cell, "text-ink", differs(row.a, row.b) && "font-semibold")}>{row.a}</TableCell>
              <TableCell className={cn(cell, "text-ink", differs(row.a, row.b) && "font-semibold")}>{row.b}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export { DuplicateCompare };
