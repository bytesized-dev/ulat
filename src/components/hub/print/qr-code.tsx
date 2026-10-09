import { qrPath } from "@/lib/hub/print";
import { cn } from "@/lib/utils";

type QrCodeProps = {
  /** What the code encodes. */
  value: string;
  label: string;
  className?: string;
};

/** The QR code as an inline SVG, drawn on the server. Nothing is fetched. */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { size, d } = qrPath(value);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn("block aspect-square w-full text-ink", className)}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
