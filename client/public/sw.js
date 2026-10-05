// Retires the service worker that an earlier version of this site (Aug-Oct 2026) installed
// in visitors' browsers. That worker served styles and scripts "cache-first" and broke
// the FontAwesome stylesheet with a cached opaque response.
//
// Browsers re-check /sw.js on every visit. This version has no fetch handler (requests go
// straight to the network), deletes the old caches, unregisters itself and reloads the open
// tabs once. Keep this file deployed for several months so returning visitors pick it up.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach((client) => client.navigate(client.url));
    })()
  );
});
