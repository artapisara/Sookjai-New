/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — การแจ้งเตือน
 * - เมื่อเชื่อม Supabase + ตั้ง VAPID key: สมัคร Web Push แล้วให้ Edge Function "send-reminders" ส่งตามเวลา (เตือนได้แม้ปิดแอพ)
 * - โหมดทดลอง: ตรวจทุก 1 นาทีขณะเปิดแอพ แล้วแสดงแจ้งเตือนผ่าน Service Worker
 * กติกาเดียวกันทั้งสองฝั่ง: นัดหมอเตือน 5/2/1 วันก่อนเสมอ · ยาเตือนเฉพาะคน+ช่วงเวลาที่เปิด 🔔
 *                          · ติดตามอาการเตือน 09:00 วันที่ถึงกำหนด (ถ้าเปิด 🔔 ไว้)
 */
'use strict';

const Notifier = (() => {
  let timer = null;
  const SENT_KEY = 'sukjai-notified';
  const pushConfigured = () => DB?.mode === 'supabase' && !!CFG.VAPID_PUBLIC_KEY;

  const b64ToU8 = (b64) => { const p = '='.repeat((4 - (b64.length % 4)) % 4); const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };
  const sent = () => { try { return JSON.parse(localStorage.getItem(SENT_KEY)) || {}; } catch { return {}; } };
  const markSent = (k) => { const s = sent(); s[k] = todayKey(); Object.keys(s).forEach((x) => { if (s[x] < dk(addDays(new Date(), -7))) delete s[x]; }); try { localStorage.setItem(SENT_KEY, JSON.stringify(s)); } catch {} };

  async function show(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') { toast(`🔔 ${title}`); return; }
    try { const reg = await navigator.serviceWorker.ready; await reg.showNotification(title, { body, tag, icon: 'icon.svg', badge: 'icon.svg', data: { url: '/' } }); }
    catch { try { new Notification(title, { body, tag, icon: 'icon.svg' }); } catch { toast(`🔔 ${title}`); } }
  }

  /** รายการที่ "ถึงเวลาเตือน" ตอนนี้ — กติกาเดียวกับฝั่งเซิร์ฟเวอร์ */
  function dueNow() {
    const out = []; const today = todayKey(); const now = nowHM();
    for (const s of SLOTS) {
      const t = slotTime(s.key);
      if (now < t || minutesBetween(t, now) > 120) continue; // เตือนภายใน 2 ชม.หลังถึงเวลา
      for (const p of S.profiles) {
        if (!p.reminder_enabled) continue;
        const meds = medsOf(p.id).filter((m) => dueToday(m) && m.slots.includes(s.key) && slotReminderOn(m, s.key) && !takenLog(m.id, s.key));
        if (meds.length) out.push({ key: `med:${today}:${p.id}:${s.key}`, title: `${s.icon} ${p.name} ถึงเวลาทานยา${s.label}`, body: meds.map((m, i) => `${i + 1}. ${m.name} (${num(m.dose)} ${unitOf(m)})`).join('\n') });
      }
    }
    if (now >= '08:00') {
      for (const a of S.appointments) {
        const n = daysUntil(a.appt_date);
        if (REMIND_DAYS.includes(n)) { const msg = apptMessage(a, n); out.push({ key: `appt:${a.id}:${n}`, ...msg }); }
      }
    }
    if (now >= CARE_REMIND_AT) {
      for (const c of careDue(S.profiles.map((p) => p.id))) if (c.remind !== false) out.push({ key: `care:${today}:${c.id}`, ...careMessage(c) });
    }
    return out;
  }
  const minutesBetween = (a, b) => { const [ah, am] = a.split(':').map(Number); const [bh, bm] = b.split(':').map(Number); return bh * 60 + bm - (ah * 60 + am); };

  async function hasServerPush() {
    if (!pushConfigured() || !('serviceWorker' in navigator)) return false;
    try { const reg = await navigator.serviceWorker.ready; return !!(await reg.pushManager.getSubscription()); } catch { return false; }
  }

  async function check() {
    if (!S || !('Notification' in window) || Notification.permission !== 'granted' || await hasServerPush()) return; // มี Web Push จากเซิร์ฟเวอร์แล้ว ไม่ต้องเตือนซ้ำ
    const done = sent();
    for (const it of dueNow()) if (!done[it.key]) { markSent(it.key); await show(it.title, it.body, it.key); }
  }

  async function enable() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return toast('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return toast('ยังไม่ได้อนุญาตการแจ้งเตือน — เปิดได้ในการตั้งค่าเบราว์เซอร์');
    if (!pushConfigured()) { toast('เปิดการแจ้งเตือนแล้ว 🔔 (ขณะเปิดแอพ)'); return check(); }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(CFG.VAPID_PUBLIC_KEY) });
      await DB.savePushSubscription(sub);
      toast('เปิด Web Push แล้ว 🔔 เตือนได้แม้ปิดแอพ');
    } catch (e) { console.error(e); toast('สมัครรับการแจ้งเตือนไม่สำเร็จ: ' + e.message); }
  }

  async function test() {
    if (!('Notification' in window)) return toast('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน');
    if (Notification.permission !== 'granted') await Notification.requestPermission();
    const next = S.appointments.filter((a) => daysUntil(a.appt_date) >= 0).sort((a, b) => a.appt_date.localeCompare(b.appt_date))[0];
    if (next) { const m = apptMessage(next, Math.max(1, daysUntil(next.appt_date))); show('(ทดลอง) ' + m.title, m.body, 'test'); }
    else show('(ทดลอง) สุขใจ', 'การแจ้งเตือนทำงานปกติ 🎉', 'test');
  }

  function start() { stop(); timer = setInterval(check, 60000); setTimeout(check, 2000); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S) { check(); render(); } });

  return { start, stop, enable, test, dueNow };
})();
