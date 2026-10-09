import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIN_LENGTH } from "./pin-entry";

const keyClass =
  "flex h-16 items-center justify-center rounded-md text-title-bar text-ink outline-none transition-colors hover:bg-surface-soft active:bg-surface-strong focus-visible:ring-2 focus-visible:ring-ring disabled:text-muted-soft";

type PinPadProps = {
  length: number;
  disabled?: boolean;
  onDigit: (digit: string) => void;
  onDelete: () => void;
};

// Six dots and a 3 by 4 keypad. The keys are real buttons, 64px tall.
function PinPad({ length, disabled, onDigit, onDelete }: PinPadProps) {
  return (
    <>
      <div role="img" aria-label={`${length} of ${PIN_LENGTH} digits entered`} className="flex justify-center gap-5 pb-1 pt-2">
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn("size-3.5 rounded-pill border", i < length ? "border-ink bg-ink" : "border-hairline bg-canvas")}
          />
        ))}
      </div>
      <div className="grid grid-cols-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => onDigit(d)} className={keyClass}>
            {d}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" disabled={disabled} onClick={() => onDigit("0")} className={keyClass}>
          0
        </button>
        <button type="button" disabled={disabled} aria-label="Delete digit" onClick={onDelete} className={keyClass}>
          <ChevronLeftIcon aria-hidden="true" className="size-6" />
        </button>
      </div>
    </>
  );
}

export { PinPad };
