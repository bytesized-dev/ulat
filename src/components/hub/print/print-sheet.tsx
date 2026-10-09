import { cn } from "@/lib/utils";
import "./print.css";

type PrintSheetProps = React.ComponentProps<"main">;

/** One A4 sheet. On screen it sits on a soft backdrop. When printed it is the page. */
export function PrintSheet({ className, ...props }: PrintSheetProps) {
  return (
    <main
      className={cn("print-sheet mx-auto flex flex-col bg-canvas p-14 text-ink outline outline-hairline print:outline-0", className)}
      {...props}
    />
  );
}

/** The backdrop and the controls bar around a sheet. */
export function PrintFrame({ controls, children }: { controls: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface-soft pb-12 print:min-h-0 print:bg-canvas print:pb-0">
      {controls}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
