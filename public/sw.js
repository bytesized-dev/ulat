// Keeps the family app shell on the phone so the app still opens when the hub
// cannot be reached. Reports waiting to send live in IndexedDB, not here.
//
// - Family pages: network first, then the last copy. Pages with a person's
//   report (/status) and the hub app are never stored.
// - Responder: only the Queue screen (/r/queue) is stored, so a responder out of
//   range can still see what waits on the phone. Its HTML holds no hub data, the
//   entries are drawn from IndexedDB. Every other /r page reads reports and
//   entries from the hub and is never stored.
// - /_next/static: cache first. Its file names change with every build.
// - Everything else, including /api, goes straight to the network.

// v2: the family voice and typed note pages are gone, so phones drop their cached copies.
const VERSION = "ulat-shell-v2";
const SHELL = ["/", "/report"];
const NAVIGATION_TIMEOUT_MS = 4000;

const QUEUE_PAGE = "/r/queue";

const FAMILY_PAGE = /^\/(report(\/.*)?|safe(\/.*)?|updates|map)?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, fallback = "/") {
  const cache = await caches.open(VERSION);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAVIGATION_TIMEOUT_MS)),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const saved = (await cache.match(request, { ignoreSearch: true, ignoreVary: true })) || (fallback && (await cache.match(fallback)));
    if (saved) return saved;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const saved = await cache.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// The responder pages ask for this once they are open, while the hub still answers.
// A page that sends the browser to the sign in screen is not stored.
async function keepQueueShell() {
  const cache = await caches.open(VERSION);
  const response = await fetch(QUEUE_PAGE, { redirect: "manual" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(QUEUE_PAGE, response);
  // The page's scripts and styles, so it starts without the hub too.
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s\\)<>]+/g) ?? []);
  await Promise.all([...assets].map((asset) => cacheFirst(new Request(asset)).catch(() => undefined)));
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "keep-queue-shell") event.waitUntil(keepQueueShell().catch(() => undefined));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && FAMILY_PAGE.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  } else if (request.mode === "navigate" && url.pathname === QUEUE_PAGE) {
    event.respondWith(networkFirst(request, null));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  }
});
