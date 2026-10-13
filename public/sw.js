// My Places service worker: offline app shell, cached boundaries/tiles, and
// last-seen API data so the map still opens without a connection.
const VERSION = "v2";
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const TILES = "tiles";
const API = "api";
const PRECACHE = ["/", "/offline", "/geo/countries.json", "/geo/india-states.json", "/icons/icon-192.png"];
const MAX_TILES = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, STATIC, TILES, API].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // Sent on logout so the next person on this device can't see cached data
  if (event.data === "clear-user-cache") event.waitUntil(Promise.all([caches.delete(API), caches.delete(SHELL)]));
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (fallbackUrl) return (await caches.match(fallbackUrl)) ?? Response.error();
    return Response.error();
  }
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === "opaque") {
    cache.put(request, res.clone());
    if (limit) trim(cache, limit);
  }
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit ?? fresh;
}

async function trim(cache, limit) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.hostname === "tiles.openfreemap.org") {
    event.respondWith(url.pathname.startsWith("/styles") ? staleWhileRevalidate(request, TILES) : cacheFirst(request, TILES, MAX_TILES));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL, "/offline"));
  } else if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    // Production build assets are content-hashed, so they never go stale
    event.respondWith(cacheFirst(request, STATIC));
  } else if (url.pathname === "/maplibre-gl-worker.mjs") {
    // Unversioned file: serve from cache but refresh it for next time
    event.respondWith(staleWhileRevalidate(request, STATIC));
  } else if (url.pathname.startsWith("/geo/") || url.pathname.startsWith("/api/geo/")) {
    event.respondWith(staleWhileRevalidate(request, STATIC));
  } else if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth")) {
    event.respondWith(networkFirst(request, API));
  }
});
