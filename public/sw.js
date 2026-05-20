// SkyBook service worker — hand-written for Turbopack compatibility.
//
// Strategies:
//   - Navigations (HTML)       → Network-first, fallback to cache, then /offline.
//                                /bookings stays readable offline via its cached
//                                last response.
//   - /api/flights, /search/*  → StaleWhileRevalidate (instant from cache, fresh
//                                in the background).
//   - /_next/static, /icons, fonts → CacheFirst.
//   - POST and cross-origin    → passthrough.

const VERSION = "skybook-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const NAV_CACHE = `${VERSION}-nav`;
const DATA_CACHE = `${VERSION}-data`;
const STATIC_CACHE = `${VERSION}-static`;

const PRECACHE_URLS = [
  "/offline",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => !n.startsWith(VERSION))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Static assets: CacheFirst.
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Flight search / API: StaleWhileRevalidate.
  // /search/* is a page navigation, so we also fall back to /offline if both
  // network AND cache miss (e.g. offline on first visit).
  if (
    url.pathname.startsWith("/api/flights") ||
    url.pathname.startsWith("/search/")
  ) {
    const isHtml =
      req.mode === "navigate" || req.headers.get("accept")?.includes("text/html");
    event.respondWith(staleWhileRevalidate(req, DATA_CACHE, isHtml));
    return;
  }

  // Page navigations: network-first, fall back to last cached, then /offline.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirstNavigation(req));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return hit || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName, htmlOfflineFallback = false) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(async () => {
      if (hit) return hit;
      if (htmlOfflineFallback) {
        const offline = await caches.match("/offline");
        if (offline) return offline;
      }
      return Response.error();
    });
  return hit || fresh;
}

async function networkFirstNavigation(req) {
  const cache = await caches.open(NAV_CACHE);
  try {
    const res = await fetch(req);
    // Only cache successful HTML so we don't pin error pages.
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    const offline = await caches.match("/offline");
    return offline || new Response("Offline", { status: 503 });
  }
}
