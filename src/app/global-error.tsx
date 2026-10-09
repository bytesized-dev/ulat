"use client";

// Replaces the root layout when it fails, so it cannot rely on globals.css or
// any component. Plain elements and system fonts only.

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Something went wrong</h1>
        <p>The application could not render. Try again, and if it keeps happening, tell the hub staff.</p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
