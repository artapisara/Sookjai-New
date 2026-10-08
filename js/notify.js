/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — การแจ้งเตือน
 * - เมื่อเชื่อม Supabase + ตั้ง VAPID key: สมัคร Web Push แล้วให้ Edge Function "send-reminders" ส่งตามเวลา (เตือนได้แม้ปิดแอพ)
 * - โหมดทดลอง: ตรวจทุก 1 นาทีขณะเปิดแอพ แล้วแสดงแจ้งเตือนผ่าน Service Worker
 * กติกาเดียวกันทั้งสองฝั่ง: นัดแพทย์เตือน 5/2/1 วันก่อนเสมอ · ยาเตือนเฉพาะคน+ช่วงเวลาที่เปิด 🔔
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

  async function show(title, body, tag, med) {
    if (!('Notification' in window) || Notification.permission !== 'granted') { toast(`🔔 ${title}`); return; }
    const actions = med ? [{ action: 'taken', title: '✓ กินแล้ว' }, { action: 'snooze', title: '⏰ เตือนอีก 15 นาที' }] : undefined; // ปุ่มกดจากการแจ้งเตือน (โหมดไม่มีเซิร์ฟเวอร์: SW ส่งคำสั่งให้แอพทำ)
    try { const reg = await navigator.serviceWorker.ready; await reg.showNotification(title, { body, tag, icon: 'icon.svg', badge: 'icon.svg', actions, data: { url: '/', med } }); }
    catch { try { new Notification(title, { body, tag, icon: 'icon.svg' }); } catch { toast(`🔔 ${title}`); } }
  }

  /** รายการที่ "ถึงเวลาเตือน" ตอนนี้ — กติกาเดียวกับฝั่งเซิร์ฟเวอร์ */
  function dueNow() {
    const out = []; const today = todayKey(); const now = nowHM();
    for (const s of SLOTS) {
      const t = slotTime(s.key);
      if (now < t || minutesBetween(t, now) > 120) continue; // เตือนภายใน 2 ชม.หลังถึงเวลา
      for (const p of S.profiles) {
        if (!reminderOn(p)) continue;
        const meds = medsOf(p.id).filter((m) => dueToday(m) && m.slots.includes(s.key) && slotReminderOn(m, s.key) && !takenLog(m.id, s.key));
        if (meds.length) out.push({ med: { p: p.id, s: s.key, d: today }, key: `med:${today}:${p.id}:${s.key}`, title: `${s.icon} ${p.name} ถึงเวลาทานยา${s.label}`, body: meds.map((m, i) => `${i + 1}. ${m.name} (${num(m.dose)} ${unitOf(m)})`).join('\n') });
      }
    }
    if (now >= apptRemindTime()) {
      for (const a of S.appointments.filter((x) => apptReminderOn(x.profile_id))) {
        const n = daysUntil(a.appt_date);
        if (remindDays().includes(n)) { const msg = apptMessage(a, n); out.push({ key: `appt:${a.id}:${n}`, ...msg }); }
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
    for (const it of dueNow()) if (!done[it.key]) { markSent(it.key); await show(it.title, it.body, it.key, it.med); }
    // เตือนซ้ำที่ผู้ใช้กด "เตือนอีก 15 นาที" ไว้ (เมื่อถึงเวลาและยังไม่ได้กิน)
    const sn = snoozes(); let changed = false;
    for (const [k, v] of Object.entries(sn)) {
      if (v.d !== todayKey()) { delete sn[k]; changed = true; continue; }
      if (Date.now() < v.until) continue;
      delete sn[k]; changed = true;
      const left = medsOf(v.p).filter((m) => dueToday(m) && m.slots.includes(v.s) && !takenLog(m.id, v.s));
      if (left.length) await show(`🔁 ${profileById(v.p).name} ยังไม่มีบันทึกการกินยา${slotOf(v.s).label}`, left.map((m, i) => `${i + 1}. ${m.name} (${num(m.dose)} ${unitOf(m)})`).join('\n'), `snz:${k}:${Date.now()}`, { p: v.p, s: v.s, d: v.d });
    }
    if (changed) saveSnoozes(sn);
  }
  const SNOOZE_KEY = 'sukjai-snooze';
  const snoozes = () => { try { return JSON.parse(localStorage.getItem(SNOOZE_KEY)) || {}; } catch { return {}; } };
  const saveSnoozes = (o) => { try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(o)); } catch { /* ไม่รองรับ */ } };
  /** รับคำสั่งจากปุ่มในการแจ้งเตือน (มาจาก Service Worker หรือ ?nact= ตอนเปิดแอพ) */
  async function applyAction(m) {
    if (!S || !m || m.d !== todayKey() || !m.p || !m.s) return;
    if (m.action === 'taken') {
      const left = medsOf(m.p).filter((x) => dueToday(x) && x.slots.includes(m.s) && !x.as_needed && !takenLog(x.id, m.s));
      for (const x of left) await toggleTake(x.id, m.s);
      if (!left.length) toast('ช่วงนี้บันทึกว่ากินแล้วทั้งหมด');
    } else if (m.action === 'snooze') {
      const sn = snoozes(); sn[`${m.p}:${m.s}`] = { p: m.p, s: m.s, d: m.d, until: Date.now() + 15 * 60000 }; saveSnoozes(sn); toast('⏰ จะเตือนอีกครั้งใน 15 นาที (เปิดแอพค้างไว้)');
    }
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.type === 'notif-action') applyAction(m);
    else if (m.type === 'refresh' && typeof refreshLogs === 'function') refreshLogs();
  });
  function consumeUrlAction() { // เปิดแอพจากปุ่มในการแจ้งเตือนตอนแอพปิดอยู่
    try { const q = new URLSearchParams(location.search); const a = q.get('nact'); if (!a) return;
      history.replaceState(history.state, '', location.pathname); applyAction({ action: a, p: q.get('p'), s: q.get('s'), d: q.get('d') }); } catch { /* ไม่มีอะไรต้องทำ */ }
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

  function start() { stop(); timer = setInterval(check, 60000); setTimeout(check, 2000); setTimeout(consumeUrlAction, 1500); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S) { check(); render(); } });

  return { start, stop, enable, test, dueNow, applyAction };
})();
