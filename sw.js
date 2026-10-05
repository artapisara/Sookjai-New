/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — Service Worker: เปิดแอพได้แม้ไม่มีอินเทอร์เน็ต (เก็บตัวแอพไว้ในเครื่อง) + รับ Web Push และเปิดแอพเมื่อแตะการแจ้งเตือน
 * ข้อมูลสุขภาพไม่ถูกเก็บที่นี่ — แอพเก็บสำเนาข้อมูลล่าสุดเองในเครื่อง (ดู SupaDB.saveSnapshot) · คำขอไป Supabase ไม่ผ่านแคชนี้
 */
const CACHE = 'sukjai-app-v3';
const SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'manifest.json', 'icon.svg?v=2', 'icon-192.png?v=2', 'icon-180.png?v=2',
  'js/util.js', 'js/avatars.js', 'js/db.js', 'js/app.js', 'js/forms.js', 'js/care.js', 'js/more.js', 'js/pages.js', 'js/history.js', 'js/premium.js', 'js/notify.js',
  'assets/icons/medicine.png', 'assets/icons/schedule.png', 'assets/icons/home.png', 'assets/icons/family.png', 'assets/icons/settings.png',
  'assets/icons/bandaid.png', 'assets/icons/summary.png', 'assets/icons/history.png', 'assets/icons/stock.png'];
const EXTRA_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))); // ไฟล์ไหนโหลดไม่ได้ก็ข้าม ไม่ให้ติดตั้งล้ม
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k.startsWith('sukjai-app-')) await caches.delete(k);
  await self.clients.claim();
})()));

// ออนไลน์ = ใช้ของใหม่จากเน็ตแล้วเก็บสำเนา · ออฟไลน์ = ใช้สำเนาที่เก็บไว้
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !EXTRA_HOSTS.includes(url.hostname)) return; // Supabase (ข้อมูล/รูป) ไม่ผ่านแคช
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: false }) || await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const shell = await cache.match('index.html') || await cache.match('./'); if (shell) return shell; }
      throw err;
    }
  })());
});

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
