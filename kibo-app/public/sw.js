// KIBO service worker.
//
// This exists to make the app installable and to fail honestly offline. It is
// NOT a caching layer for the tank.
//
// The constraint from Agent.md: "cache the shell only. Keep the aquarium
// online-only — a cached stale tank is worse than an honest offline state." A
// tank is two people's live presence. Serving yesterday's from disk would show
// someone a partner who is not there, which is a worse lie than a blank screen.
//
// So: navigations go to the network first and fall back to a static offline page
// only when the network is gone. Nothing else is intercepted at all — Supabase
// REST, realtime websockets, and Next's hashed build assets all pass straight
// through, because a stale JS chunk against a fresh server is its own bug class.

const OFFLINE_URL = '/offline';
const CACHE = 'kibo-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // `reload` bypasses the HTTP cache, so an install never precaches a copy
      // that was already stale in the browser cache.
      await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
      // Take over without waiting for every old tab to close. Safe here because
      // this worker holds no versioned app payload — only the offline page.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any earlier shell cache, so a rename of CACHE is a clean cutover.
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // A fetch handler is required for installability, but this is the only kind of
  // request it has an opinion about. Everything else is left to the browser,
  // which is the point.
  if (request.mode !== 'navigate' || request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch {
        // Genuinely offline — fetch rejects rather than returning a status. A 500
        // from the server is NOT this branch, and should not be, because a real
        // error page is more useful than "you're offline" when you aren't.
        const cache = await caches.open(CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return (
          offline ??
          new Response('Offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      }
    })()
  );
});
