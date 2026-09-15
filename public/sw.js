
// Service Worker بسيط لتمكين ميزات الـ PWA وتثبيت التطبيق
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // تمرير الطلبات كما هي (الهدف الأساسي هو إرضاء معايير التثبيت في المتصفحات)
  event.respondWith(fetch(event.request));
});
