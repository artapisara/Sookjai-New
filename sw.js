/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — Service Worker: เปิดแอปได้แม้ไม่มีอินเทอร์เน็ต (เก็บตัวแอปไว้ในเครื่อง) + รับ Web Push และเปิดแอปเมื่อแตะการแจ้งเตือน
 * ข้อมูลสุขภาพไม่ถูกเก็บที่นี่ — แอปเก็บสำเนาข้อมูลล่าสุดเองในเครื่อง (ดู SupaDB.saveSnapshot) · คำขอไป Supabase ไม่ผ่านแคชนี้
 */
const CACHE = 'sukjai-app-v233';
const SHELL = ['./', 'index.html', 'styles.css', 'fonts/fonts.css', 'fonts/sarabun-thai-400-normal.woff2', 'fonts/sarabun-latin-400-normal.woff2', 'fonts/sarabun-thai-500-normal.woff2', 'fonts/sarabun-latin-500-normal.woff2', 'fonts/sarabun-thai-600-normal.woff2', 'fonts/sarabun-latin-600-normal.woff2', 'fonts/sarabun-thai-700-normal.woff2', 'fonts/sarabun-latin-700-normal.woff2', 'fonts/prompt-thai-300-normal.woff2', 'fonts/prompt-latin-300-normal.woff2', 'fonts/prompt-thai-400-normal.woff2', 'fonts/prompt-latin-400-normal.woff2', 'fonts/prompt-thai-500-normal.woff2', 'fonts/prompt-latin-500-normal.woff2', 'fonts/prompt-thai-600-normal.woff2', 'fonts/prompt-latin-600-normal.woff2', 'fonts/prompt-thai-700-normal.woff2', 'fonts/prompt-latin-700-normal.woff2', 'fonts/prompt-thai-800-normal.woff2', 'fonts/prompt-latin-800-normal.woff2', 'config.js', 'manifest.json', 'icon.svg?v=2', 'icon-192.png?v=2', 'icon-180.png?v=2',
  'js/util.js', 'js/limits.js', 'js/avatars.js', 'js/db.js', 'js/photoedit.js', 'js/app.js', 'js/forms.js', 'js/care.js', 'js/more.js', 'js/pages.js', 'js/pdfcanvas.js', 'js/history.js', 'js/stickers.js', 'js/health.js', 'js/report.js', 'js/premium.js', 'js/notify.js',
  'assets/icons/medicine.png', 'assets/icons/schedule.png', 'assets/icons/home.png', 'assets/icons/family.png', 'assets/icons/settings.png',
  'assets/icons/bandaid.png', 'assets/icons/summary.png', 'assets/icons/history.png', 'assets/icons/notebook.svg', 'vendor/html2canvas.min.js', 'vendor/jspdf.umd.min.js', 'assets/icons/stock.png', 'assets/icons/blood-pressure.png', 'assets/icons/report-notes.png', 'assets/slots/morning.png', 'assets/slots/day.png', 'assets/slots/evening.png', 'assets/slots/night.png', 'assets/moods/happy.png', 'assets/moods/calm.png', 'assets/moods/meh.png', 'assets/moods/tired.png', 'assets/moods/sad.png', 'assets/moods/worried.png'];
const EXTRA_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

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
      const res = await fetch(req, same ? { cache: 'no-cache' } : undefined); // ตรวจกับเซิร์ฟเวอร์ทุกครั้ง ไม่ใช้ไฟล์เก่าจากแคชเบราว์เซอร์
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
  const opt = { body: d.body || '', tag: d.tag, icon: 'icon-192.png?v=2', badge: 'icon-192.png?v=2', renotify: !!d.tag, data: { url: d.url || '/', token: d.token, fn: d.fn, med: d.med } };
  if (Array.isArray(d.actions) && d.actions.length) opt.actions = d.actions.slice(0, 2); // ปุ่ม "กินแล้ว" / "เตือนอีก 15 นาที" (Android/Chrome — iPhone ไม่แสดงปุ่ม)
  event.waitUntil(self.registration.showNotification(d.title || 'สุขใจ', opt));
});

/** กดปุ่มในการแจ้งเตือน: ส่งคำสั่งไปที่ Edge Function (notification-action) โดยตรง ไม่ต้องเปิดแอป · ถ้าทำไม่ได้ ให้แอปทำแทน */
async function handleAction(d, act) {
  const ack = async (title) => {
    await self.registration.showNotification(title, { tag: 'sukjai-ack', icon: 'icon-192.png?v=2', badge: 'icon-192.png?v=2', silent: true });
    await new Promise((r) => setTimeout(r, 3500));
    (await self.registration.getNotifications({ tag: 'sukjai-ack' })).forEach((x) => x.close());
  };
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (d.token && d.fn) {
    try {
      const r = await fetch(d.fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: d.token, action: act }) });
      if (r.ok) { all.forEach((c) => c.postMessage({ type: 'refresh' })); return ack(act === 'taken' ? '✓ บันทึกแล้วว่ากินยาแล้ว' : '⏰ จะเตือนอีกครั้งใน 15 นาที'); }
    } catch { /* ไปทางสำรองด้านล่าง */ }
  }
  const msg = { type: 'notif-action', action: act, ...(d.med || {}) };
  if (all.length) { all[0].postMessage(msg); return all[0].focus(); }
  const q = new URLSearchParams({ nact: act, p: (d.med && d.med.p) || '', s: (d.med && d.med.s) || '', d: (d.med && d.med.d) || '' });
  return self.clients.openWindow('/?' + q.toString());
}

self.addEventListener('notificationclick', (event) => {
  const n = event.notification; const d = n.data || {}; const act = event.action; n.close();
  event.waitUntil((async () => {
    if ((act === 'taken' || act === 'snooze') && d.med) return handleAction(d, act);
    const url = d.url || '/';
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  })());
});