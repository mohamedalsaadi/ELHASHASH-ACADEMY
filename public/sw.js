// A small installability + offline-page worker. It does not cache lessons, APIs or payments.
const CACHE = "aacademy-v1";
const OFFLINE = ["/ar/offline", "/en/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(OFFLINE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  const path = new URL(event.request.url).pathname;
  const fallback = path.startsWith("/en") ? "/en/offline" : "/ar/offline";
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(fallback)) || Response.error()));
});
