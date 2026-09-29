// Minimal service worker (no caching) so the PWA registration succeeds.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
