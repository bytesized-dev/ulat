import { lastName } from "@/lib/hub/desk-name";

// The slip staff hand to the family. It is a small page of its own, printed
// from a hidden frame, so the hub's sidebar and top bar never reach the paper.

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** "Santiago household" for the name staff typed. */
export function slipHousehold(name: string): string {
  const last = lastName(name);
  return last ? `${last} household` : "Household";
}

/** The printable page. The code is the report code and the name is escaped. */
export function slipHtml(code: string, name: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Code slip ${escapeHtml(code)}</title>
<style>
  body { margin: 0; padding: 2rem; font-family: system-ui, sans-serif; text-align: center; }
  p { margin: 0; }
  .label { font-size: 1rem; }
  .code { margin: 1rem 0; font-family: ui-monospace, Menlo, monospace; font-size: 4rem; font-weight: 500; letter-spacing: 0.16em; }
  .household { font-size: 1.25rem; font-weight: 600; }
  .keep { margin-top: 1.5rem; font-size: 1rem; }
</style>
</head>
<body>
<p class="label">Code slip</p>
<p class="code">${escapeHtml(code)}</p>
<p class="household">${escapeHtml(slipHousehold(name))}</p>
<p class="keep">Keep this code. It shows where your report is.</p>
</body>
</html>`;
}

/** Prints the slip. A browser that blocks the frame leaves the on-screen slip for staff to show. */
export function printSlip(code: string, name: string, doc: Document = document): void {
  const frame = doc.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.className = "fixed size-0 border-0";
  frame.srcdoc = slipHtml(code, name);
  frame.onload = () => {
    try {
      frame.contentWindow?.print();
    } finally {
      // Printing is modal in most browsers, so by now the dialog is done.
      setTimeout(() => frame.remove(), 1000);
    }
  };
  doc.body.appendChild(frame);
}
