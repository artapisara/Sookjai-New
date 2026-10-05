/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — Service Worker: รับ Web Push และเปิดแอพเมื่อแตะการแจ้งเตือน */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'สุขใจ', body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'สุขใจ', {
    body: d.body || '', tag: d.tag, icon: 'icon-192.png?v=2', badge: 'icon-192.png?v=2', renotify: !!d.tag, data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  })());
});
