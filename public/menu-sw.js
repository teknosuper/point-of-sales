const STATIC_CACHE = "gtc-menu-static-v1";
const RUNTIME_CACHE = "gtc-menu-runtime-v1";
const APP_SHELL = [
  "/menu-manifest.webmanifest",
  "/menu-pwa-icon.svg",
  "/menu-apple-touch-icon.svg",
  "/menu-offline.html",
  "/daftarmenu"
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
          .filter((key) =>
            key.startsWith("gtc-menu-") &&
            ![STATIC_CACHE, RUNTIME_CACHE].includes(key)
          )
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
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, response.clone());
          }

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match("/daftarmenu") || caches.match("/menu-offline.html");
        })
    );
    return;
  }

  if (url.pathname.startsWith("/api/public/catalog/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
          }

          return response;
        })
        .catch(() => caches.match(request))
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
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, responseClone));
          }

          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
