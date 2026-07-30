'use client';

import { useEffect } from 'react';

/**
 * Registers public/sw.js. Renders nothing.
 *
 * Registration is deliberately not gated on the page being a room: the worker's
 * only job is installability plus an offline fallback, and both want to be in
 * place before someone installs from the landing page.
 *
 * Skipped in development. A service worker that outlives a dev session keeps
 * answering navigations from a stale precache against a server that has since
 * restarted, and the resulting "why is my edit not showing" is a genuinely
 * expensive hour. `next dev --experimental-https` is the way to exercise it
 * locally when that is the thing being tested.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // No `await` on the registration promise and nothing rendered from it: a
    // failed registration must not affect the tank. It only ever costs the
    // offline page.
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((cause) => {
      console.warn('[kibo] service worker registration failed:', cause);
    });
  }, []);

  return null;
}
