const STATIC_CACHE = "gtc-dashboard-static-v2";
const RUNTIME_CACHE = "gtc-dashboard-runtime-v2";
const IMAGE_CACHE = "gtc-dashboard-images-v2";
const APP_SHELL = [
  "/dashboard-manifest.webmanifest",
  "/media/gtclogo.png",
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
          .filter((key) =>
            key.startsWith("gtc-dashboard-") &&
            ![STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE].includes(key)
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
            const responseClone = response.clone();
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, responseClone);
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

  if (request.destination === "image") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              cache.put(request, responseClone);
            }

            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  const cacheableDestinations = ["style", "script", "font", "manifest"];
  if (!cacheableDestinations.includes(request.destination)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then(async (response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, responseClone);
          }

          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

self.addEventListener("push", (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return {
        title: "GTC KASIR",
        body: event.data ? event.data.text() : "",
      };
    }
  })();

  const title = payload.title || "GTC KASIR";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/pwa-icon.svg",
    badge: payload.badge || "/pwa-icon.svg",
    tag: payload.tag || "gtc-dashboard",
    data: {
      url: payload.url || "/dashboard",
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin).toString();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin + "/dashboard") && "focus" in client) {
          client.navigate?.(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
