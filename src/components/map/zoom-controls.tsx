import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const round = "size-11 rounded-full bg-canvas text-ink shadow-float hover:bg-surface-soft";

/** Floating zoom buttons, bottom right of the map. */
export function ZoomControls({ onZoomIn, onZoomOut }: { onZoomIn: () => void; onZoomOut: () => void }) {
  return (
    <div className="absolute right-3 bottom-3 flex flex-col gap-2">
      <Button type="button" variant="secondary" className={round} aria-label="Zoom in" onClick={onZoomIn}>
        <Plus />
      </Button>
      <Button type="button" variant="secondary" className={round} aria-label="Zoom out" onClick={onZoomOut}>
        <Minus />
      </Button>
    </div>
  );
}
