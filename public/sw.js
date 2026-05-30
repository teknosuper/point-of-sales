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

  const bypassCachePaths = [
    "/print-client.html",
  ];

  if (bypassCachePaths.includes(url.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

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

self.addEventListener("message", (event) => {
  const type = event.data?.type;
  const replyPort = event.ports?.[0];

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    replyPort?.postMessage({ ok: true });
    return;
  }

  if (type === "RESET_APP_CACHE") {
    const work = Promise.all([
      caches.delete(RUNTIME_CACHE),
      caches.delete(STATIC_CACHE),
    ])
      .then(() => caches.open(STATIC_CACHE))
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => {
        replyPort?.postMessage({ ok: true });
      })
      .catch((error) => {
        replyPort?.postMessage({
          ok: false,
          error: error?.message || "reset_app_cache_failed",
        });
      });

    if (typeof event.waitUntil === "function") {
      event.waitUntil(work);
    }

    return;
  }

  if (type !== "WARM_ROUTES") return;

  const urls = Array.from(new Set(event.data?.payload?.urls || [])).filter(Boolean);
  const blockedWarmRoutePatterns = [
    /\/transactions\/sync-offline$/i,
    /\/transactions\/store$/i,
    /\/transactions\/addToCart$/i,
    /\/transactions\/searchProduct$/i,
    /\/transactions\/hold$/i,
    /\/transactions\/[^/]+\/resume$/i,
    /\/transactions\/[^/]+\/clearHold$/i,
  ];

  const work = caches.open(RUNTIME_CACHE).then(async (cache) => {
    const results = [];

    for (const url of urls) {
      try {
        const parsed = new URL(url, self.location.origin);
        if (blockedWarmRoutePatterns.some((pattern) => pattern.test(parsed.pathname))) {
          results.push({
            url,
            ok: false,
            skipped: true,
            error: "route_not_cacheable",
          });
          continue;
        }

        const response = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (response && response.ok) {
          await cache.put(url, response.clone());
          results.push({
            url,
            ok: true,
            status: response.status,
          });
          continue;
        }

        results.push({
          url,
          ok: false,
          status: response?.status || 0,
        });
      } catch (error) {
        results.push({
          url,
          ok: false,
          error: "fetch_failed",
        });
      }
    }

    replyPort?.postMessage({
      ok: results.some((item) => item.ok),
      results,
    });
  }).catch((error) => {
    replyPort?.postMessage({
      ok: false,
      error: error?.message || "warm_routes_failed",
      results: [],
    });
  });

  if (typeof event.waitUntil === "function") {
    event.waitUntil(work);
  }
});
