// A small installability + offline-page worker. It does not cache lessons, APIs or payments.
const CACHE = "sabboura-v1";
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
  // Drop caches left by earlier names of the site.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  const path = new URL(event.request.url).pathname;
  const fallback = path.startsWith("/en") ? "/en/offline" : "/ar/offline";
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(fallback)) || Response.error()));
});
