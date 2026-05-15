const STATIC_CACHE = "poinza-static-v2";
const RUNTIME_CACHE = "poinza-runtime-v2";
const APP_SHELL = [
  "/manifest.webmanifest",
  "/pwa-icon.svg",
  "/pwa-icon-maskable.svg",
  "/apple-touch-icon.svg",
  "/offline.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, cloned);
          }

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/offline.html");
        })
    );
    return;
  }

  const cacheableDestinations = ["style", "script", "image", "font", "manifest"];
  if (!cacheableDestinations.includes(request.destination)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, cloned));
          }

          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
