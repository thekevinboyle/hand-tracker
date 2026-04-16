// Hand Tracker FX service worker (Task 5.1).
// Cache-first for /models/* and /wasm/*; pass-through for everything else.
// Bump CACHE_NAME whenever any asset under /models or /wasm changes — the
// activate handler purges stale caches by name mismatch.
const CACHE_NAME = 'hand-tracker-fx-models-v1';
const CACHE_FIRST_PATTERNS = [/^\/models\//, /^\/wasm\//];

self.addEventListener('install', () => {
  // Take control on first install so cache seeding starts on the very first
  // visit (rather than the second after the user reloads).
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!CACHE_FIRST_PATTERNS.some((re) => re.test(url.pathname))) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const response = await fetch(event.request);
      // Only cache successful, same-origin, non-opaque responses. `response.ok`
      // excludes 4xx/5xx; opaque cross-origin responses were already filtered
      // by the origin check above.
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })(),
  );
});
