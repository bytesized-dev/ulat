import { subscribe } from "@/lib/live/bus";
import { canSee, viewerFromRequest } from "@/lib/live/scope";
import { markSeen } from "@/lib/status/phones";
import { startStatusTicker } from "@/lib/status";

export const runtime = "nodejs";
// A stream is never cached or prerendered.
export const dynamic = "force-dynamic";

const PING_MS = 20_000;

export async function GET(request: Request) {
  const result = await viewerFromRequest(request);
  if (!result.ok) return Response.json({ error: "bad_code" }, { status: 400 });
  const { viewer } = result;
  startStatusTicker();
  // The hub laptop is not a phone. A phone's stream keeps its address fresh on
  // every ping, so an open stream keeps counting in the phones number.
  const isPhone = viewer.role !== "staff";

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      const unsubscribe = subscribe(viewer, (event) => {
        if (canSee(viewer, event)) write(`data: ${JSON.stringify(event)}\n\n`);
      });
      // The comment line keeps phones, Caddy and Wi-Fi from closing an idle stream.
      const ping = setInterval(() => {
        write(": ping\n\n");
        if (isPhone) markSeen(request);
      }, PING_MS);
      if (isPhone) markSeen(request);

      let closed = false;
      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };

      request.signal.addEventListener("abort", cleanup, { once: true });
      // Retry after 3 s, then the first thing a client sees is a live stream.
      write("retry: 3000\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
