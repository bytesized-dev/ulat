import { QR_QUIET_ZONE, qrPath } from "@/lib/hub/print";
import { cn } from "@/lib/utils";

type QrCodeProps = {
  /** What the code encodes. */
  value: string;
  label: string;
  className?: string;
};

/** The QR code as an inline SVG on a canvas background with its quiet zone, drawn on the server. Nothing is fetched. */
export function QrCode({ value, label, className }: QrCodeProps) {
  const { size, d } = qrPath(value);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE} ${size + 2 * QR_QUIET_ZONE} ${size + 2 * QR_QUIET_ZONE}`}
      shapeRendering="crispEdges"
      className={cn("block aspect-square w-full bg-canvas text-ink", className)}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
