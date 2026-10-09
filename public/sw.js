// Keeps the family app shell on the phone so the app still opens when the hub
// cannot be reached. Reports waiting to send live in IndexedDB, not here.
//
// - Family pages: network first, then the last copy. Pages with a person's
//   report (/status) and the responder and hub apps are never stored.
// - /_next/static: cache first. Its file names change with every build.
// - Everything else, including /api, goes straight to the network.

const VERSION = "ulat-shell-v1";
const SHELL = ["/", "/report"];
const NAVIGATION_TIMEOUT_MS = 4000;

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

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAVIGATION_TIMEOUT_MS)),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const saved = (await cache.match(request, { ignoreSearch: true })) || (await cache.match("/"));
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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && FAMILY_PAGE.test(url.pathname)) {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  }
});
