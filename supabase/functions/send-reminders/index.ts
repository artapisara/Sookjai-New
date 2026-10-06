// © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์
// สุขใจ — Edge Function: ส่ง Web Push เตือนกินยา นัดหมอ ติดตามอาการ (+ ฟีเจอร์ Premium: เตือนซ้ำ · แจ้งผู้ดูแลเมื่อลืมกินยา · เตือนยาใกล้หมด)
// ถูกเรียกทุก 5 นาทีโดย pg_cron (ดู supabase/cron.sql)
// Secrets ที่ต้องตั้ง: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET (และ ACTION_SECRET ถ้าอยากแยกความลับของปุ่มในการแจ้งเตือน)
// (SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ) · ต้องรัน supabase/reminders-v2.sql ก่อน (ตาราง reminder_snoozes)
//
// กติกาแพ็กเกจ (ใช้เมื่อเปิดสวิตช์ app_flags.paywall_enabled — ปิดสวิตช์ = ทุกคนเป็น Premium):
//  Free    : เตือนกินยา + เตือนนัดหมอ ได้ 1 คน (คนที่เปิดสวิตช์และสร้างก่อน) · ปุ่ม "กินแล้ว/เตือนอีก 15 นาที"
//  Premium : เตือนทุกคน · เตือนซ้ำเมื่อยังไม่กิน · แจ้งผู้ดูแลในกลุ่มเมื่อลืมกินยา (ตาม Premium ของ "เจ้าของข้อมูล") · เตือนยาใกล้หมด
//  ติดตามอาการเป็นฟีเจอร์ Premium (Free มี 1 แผน) — แผนที่มีอยู่แล้วยังเตือนต่อ
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { signToken } from '../_shared/token.ts';

const SLOTS: Record<string, { label: string; icon: string; time: string }> = {
  before_breakfast: { label: 'ก่อนอาหารเช้า', icon: '🌅', time: '06:30' },
  after_breakfast: { label: 'หลังอาหารเช้า', icon: '🌅', time: '07:30' },
  before_lunch: { label: 'ก่อนอาหารกลางวัน', icon: '☀️', time: '11:30' },
  after_lunch: { label: 'หลังอาหารกลางวัน', icon: '☀️', time: '12:30' },
  before_dinner: { label: 'ก่อนอาหารเย็น', icon: '🌇', time: '17:30' },
  after_dinner: { label: 'หลังอาหารเย็น', icon: '🌇', time: '18:30' },
  bedtime: { label: 'ก่อนนอน', icon: '🌙', time: '21:00' },
};
const REMIND_DAYS = [5, 2, 1];
const MED_WINDOW_MIN = 120; // เตือนยาภายใน 2 ชม.หลังถึงเวลา
const REPEAT_EVERY_MIN = 15; const REPEATS = 2; // Premium: เตือนซ้ำที่ +15 และ +30 นาทีถ้ายังไม่กิน
const MISSED_AFTER_MIN = 60; const MISSED_MAX_MIN = 240; // Premium: แจ้งผู้ดูแลเมื่อเลยเวลา 1 ชม. แล้วยังไม่กิน (ภายใน 4 ชม.)
const APPT_REMIND_FROM = '08:00'; // เตือนนัดหมอตั้งแต่ 8 โมงเช้า
const CARE_REMIND_FROM = '09:00'; // เตือนติดตามอาการตั้งแต่ 9 โมงเช้า (ต้องตรงกับ CARE_REMIND_AT ใน js/care.js)
const REFILL_FROM = '09:00'; const LOW_STOCK_DAYS = 7; const REFILL_STEPS = [7, 3, 1, 0]; // Premium: เตือนยาใกล้หมดเมื่อเหลือ 7/3/1/0 วัน
const STOCK_UNITS = ['เม็ด', 'แคปซูล', 'ซอง', 'แผ่น'];
const ACTION_TTL_SEC = 6 * 3600;
const MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const sb = createClient(SB_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function bangkokNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hm: `${hour}:${parts.minute}` };
}
const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const dayDiff = (from: string, to: string) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const thDate = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${dd} ${MONTHS_S[m - 1]} ${String(y + 543).slice(2)}`; };
const when = (n: number) => (n === 1 ? 'พรุ่งนี้' : `อีก ${n} วัน`);
const uniq = <T,>(a: T[]) => [...new Set(a)];
const dowOf = (d: string) => new Date(d + 'T12:00:00Z').getUTCDay();

type Med = { id: string; profile_id: string; name: string; slots: string[]; weekdays?: number[]; slot_reminders?: Record<string, boolean>; as_needed?: boolean; dose: number; unit?: string; stock?: number; stock_at?: string; updated_at?: string };
type Prof = { id: string; user_id: string; name: string; reminder_enabled: boolean; created_at?: string };
type Msg = { userId: string; key: string; title: string; body: string; med?: { p: string; s: string; d: string; n: number } };
type Snooze = { id: string; user_id: string; profile_id: string; slot: string; log_date: string; n: number };

const dueOn = (m: Med, d: string) => !m.weekdays?.length || m.weekdays.includes(dowOf(d));
// อ่านแบบแบ่งชุด กัน URL ยาวเกินเมื่อมี id จำนวนมาก
async function inChunks<T>(ids: string[], fn: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 80) { const { data, error } = await fn(ids.slice(i, i + 80)); if (error) throw new Error(error.message); out.push(...(data ?? [])); }
  return out;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const { date: today, hm: now } = bangkokNow();

  const { data: subs, error: subErr } = await sb.from('push_subscriptions').select('*');
  if (subErr) return new Response(subErr.message, { status: 500 });
  const userIds = uniq((subs ?? []).map((s) => s.user_id as string));
  if (!userIds.length) return Response.json({ sent: 0 });

  try {
    // ---- โหลดข้อมูล: คนที่เป็นเจ้าของ + คนที่แชร์ให้ผู้รับ (เพื่อแจ้งผู้ดูแล) ----
    const members = await inChunks<{ circle_id: string; user_id: string; role: string }>(userIds, (c) => sb.from('circle_members').select('circle_id, user_id, role').in('user_id', c));
    const circleIds = uniq(members.map((m) => m.circle_id));
    const careFor = circleIds.length ? await inChunks<{ circle_id: string; profile_id: string }>(circleIds, (c) => sb.from('circle_care_for').select('circle_id, profile_id').in('circle_id', c)) : [];
    const owned = await inChunks<Prof>(userIds, (c) => sb.from('profiles').select('*').in('user_id', c));
    const ownedIds = new Set(owned.map((p) => p.id));
    const sharedIds = uniq(careFor.map((x) => x.profile_id)).filter((id) => !ownedIds.has(id));
    const shared = sharedIds.length ? await inChunks<Prof>(sharedIds, (c) => sb.from('profiles').select('*').in('id', c)) : [];
    const profiles = [...owned, ...shared];
    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const ownerIds = uniq(profiles.map((p) => p.user_id));
    const profileIds = profiles.map((p) => p.id);

    const [settings, meds, appts, hospitals, doctors, plans, careLogs, flags, subsRows, snoozeRes] = await Promise.all([
      inChunks<{ user_id: string; slot_times: Record<string, string> }>(ownerIds, (c) => sb.from('user_settings').select('*').in('user_id', c)),
      inChunks<Med>(profileIds, (c) => sb.from('medications').select('*').in('profile_id', c).eq('status', 'active').order('sort_order')),
      inChunks<{ id: string; user_id: string; profile_id: string; appt_date: string; appt_time: string; department?: string; doctor_id?: string; hospital_id?: string; building?: string; note?: string }>(userIds, (c) => sb.from('appointments').select('*').in('user_id', c).gte('appt_date', addDays(today, 1)).lte('appt_date', addDays(today, Math.max(...REMIND_DAYS)))),
      inChunks<{ id: string; name: string }>(userIds, (c) => sb.from('hospitals').select('id, name').in('user_id', c)),
      inChunks<{ id: string; name: string }>(userIds, (c) => sb.from('doctors').select('id, name').in('user_id', c)),
      inChunks<{ id: string; user_id: string; profile_id: string; title: string; interval_days: number; started_on: string; care_steps?: string[] }>(userIds, (c) => sb.from('care_plans').select('*').in('user_id', c).eq('status', 'active').eq('remind', true)),
      inChunks<{ plan_id: string; log_date: string }>(userIds, (c) => sb.from('care_logs').select('plan_id, log_date').in('user_id', c).order('log_date', { ascending: false })),
      sb.from('app_flags').select('value').eq('key', 'paywall_enabled').maybeSingle().then((r) => r.data),
      inChunks<{ user_id: string; premium_until: string | null }>(uniq([...ownerIds, ...userIds]), (c) => sb.from('subscriptions').select('user_id, premium_until').in('user_id', c)),
      sb.from('reminder_snoozes').select('*').lte('due_at', new Date().toISOString()),
    ]);
    const snoozes = ((snoozeRes.error ? [] : snoozeRes.data ?? []) as Snooze[]).filter((z) => userIds.includes(z.user_id));
    // บันทึกกินยาวันนี้ — ของทุกคน (รวมที่ผู้ดูแลติ๊กให้) นับตามยา+ช่วงเวลา
    const logs = await inChunks<{ medication_id: string; slot: string }>(meds.map((m) => m.id), (c) => sb.from('med_logs').select('medication_id, slot').eq('log_date', today).in('medication_id', c));
    const taken = new Set(logs.map((l) => `${l.medication_id}|${l.slot}`));

    const lastCareLog = new Map<string, string>();
    for (const l of careLogs) if (!lastCareLog.has(l.plan_id)) lastCareLog.set(l.plan_id, l.log_date);
    const hosp = new Map(hospitals.map((h) => [h.id, h.name]));
    const doc = new Map(doctors.map((d) => [d.id, d.name]));
    const slotTimes = (uid: string) => settings.find((s) => s.user_id === uid)?.slot_times ?? {};
    const medsOf = (pid: string) => meds.filter((m) => m.profile_id === pid);
    const dueMeds = (p: Prof, slot: string) => medsOf(p.id).filter((m) => !m.as_needed && m.slots.includes(slot) && dueOn(m, today) && m.slot_reminders?.[slot] !== false && !taken.has(`${m.id}|${slot}`));

    const paywallOn = flags?.value === true;
    const premiumUsers = new Set(subsRows.filter((s) => s.premium_until && Date.parse(s.premium_until) > Date.now()).map((s) => s.user_id));
    const isPrem = (uid: string) => !paywallOn || premiumUsers.has(uid);
    // Free: เตือนยา/นัดหมอได้ 1 คน (เปิดสวิตช์ + สร้างก่อน) — ต้องตรงกับ reminderOn() ใน js/premium.js
    const medProfiles = (uid: string) => {
      const mine = owned.filter((x) => x.user_id === uid && x.reminder_enabled);
      if (isPrem(uid)) return mine;
      mine.sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || String(a.id).localeCompare(String(b.id)));
      return mine.slice(0, 1);
    };

    const msgs: Msg[] = [];
    const medMsg = (uid: string, p: Prof, slot: string, due: Med[], key: string, repeatNo = 0, n = 0): Msg => ({
      userId: uid, key, med: { p: p.id, s: slot, d: today, n },
      title: `${repeatNo ? '🔁' : SLOTS[slot].icon} ${p.name} ${repeatNo ? 'ยังไม่ได้ทานยา' : 'ถึงเวลาทานยา'}${SLOTS[slot].label}`,
      body: due.map((m, i) => `${i + 1}. ${m.name} (${Number(m.dose)} ${m.unit ?? 'เม็ด'})`).join('\n'),
    });

    for (const uid of userIds) {
      const st = slotTimes(uid);
      for (const [slot, def] of Object.entries(SLOTS)) {
        const diff = toMin(now) - toMin(st[slot] || def.time);
        if (diff < 0 || diff > MED_WINDOW_MIN) continue;
        for (const p of medProfiles(uid)) {
          const due = dueMeds(p, slot); if (!due.length) continue;
          msgs.push(medMsg(uid, p, slot, due, `med:${today}:${p.id}:${slot}`));
          if (isPrem(uid)) for (let r = 1; r <= REPEATS; r++) if (diff >= r * REPEAT_EVERY_MIN && diff < (r + 1) * REPEAT_EVERY_MIN) msgs.push(medMsg(uid, p, slot, due, `med:${today}:${p.id}:${slot}:r${r}`, r));
        }
      }
      // เตือนอีกครั้งตามที่กด "เตือนอีก 15 นาที"
      for (const z of snoozes.filter((x) => x.user_id === uid)) {
        const p = profileMap.get(z.profile_id); if (!p || z.log_date !== today || !SLOTS[z.slot]) continue;
        const due = dueMeds(p, z.slot); if (due.length) msgs.push(medMsg(uid, p, z.slot, due, `med:${today}:${p.id}:${z.slot}:z${z.n}`, 1, z.n));
      }
      // ---- นัดหมอ: 5 / 2 / 1 วันก่อน (Free: เฉพาะคนที่เตือนได้) ----
      if (now >= APPT_REMIND_FROM) {
        const apptOk = new Set(medProfiles(uid).map((x) => x.id)); const limited = !isPrem(uid);
        for (const a of appts.filter((x) => x.user_id === uid && (!limited || apptOk.has(x.profile_id)))) {
          const n = dayDiff(today, a.appt_date);
          if (!REMIND_DAYS.includes(n)) continue;
          // บอกแค่ "พบแพทย์ครั้งถัดไป" + วัน · แผนก · เวลา (ตรงกับ apptMessage() ใน js/forms.js)
          msgs.push({ userId: uid, key: `appt:${a.id}:${n}`, title: '🩺 พบแพทย์ครั้งถัดไป', body: [thDate(a.appt_date), a.department, `${String(a.appt_time).slice(0, 5)} น.`].filter(Boolean).join(' · ') });
        }
      }
      // ---- ติดตามอาการ: วันที่ครบรอบหรือเลยกำหนด ----
      if (now >= CARE_REMIND_FROM) {
        for (const c of plans.filter((x) => x.user_id === uid)) {
          const last = lastCareLog.get(c.id);
          const next = last ? addDays(last, Number(c.interval_days) || 1) : c.started_on;
          if (dayDiff(today, next) > 0) continue;
          const p = profileMap.get(c.profile_id); const steps: string[] = c.care_steps ?? [];
          msgs.push({ userId: uid, key: `care:${today}:${c.id}`, title: `🩹 ${p?.name ?? ''} ถึงวันติดตามอาการ`, body: `${c.title} — ถ่ายรูป/บันทึกอาการวันนี้` + (steps.length ? '\n' + steps.map((s) => '• ' + s).join('\n') : '') });
        }
      }
      // ---- Premium: ยาใกล้หมด ----
      if (now >= REFILL_FROM && isPrem(uid)) {
        for (const p of owned.filter((x) => x.user_id === uid && x.reminder_enabled)) for (const m of medsOf(p.id)) {
          if (m.as_needed || !STOCK_UNITS.includes(m.unit ?? 'เม็ด') || !m.slots?.length) continue;
          const per = m.slots.length * Number(m.dose || 1); const dailyUse = per * ((m.weekdays?.length || 7) / 7); if (!dailyUse) continue;
          const base = m.stock_at || (m.updated_at ? String(m.updated_at).slice(0, 10) : today); let used = 0;
          for (let i = 0, d = base; d < today && i < 400; i++, d = addDays(d, 1)) if (dueOn(m, d)) used += per;
          const left = Math.max(0, Number(m.stock ?? 0) - used); const days = Math.floor(left / dailyUse);
          if (days <= LOW_STOCK_DAYS && REFILL_STEPS.includes(days)) msgs.push({ userId: uid, key: `refill:${m.id}:${days}:${base}`, title: `📦 ${p.name} ยา${days === 0 ? 'ใกล้หมดแล้ว' : `เหลือประมาณ ${days} วัน`}`, body: `${m.name} เหลือประมาณ ${Math.round(left * 10) / 10} ${m.unit ?? 'เม็ด'} — ถึงเวลาเตรียมไปรับยา` });
        }
      }
    }

    // ---- Premium: แจ้งผู้ดูแล (สมาชิกกลุ่มที่ได้รับแชร์คนนั้น) เมื่อเลยเวลากินยาแล้วยังไม่กิน — ใช้สิทธิ์ Premium ของ "เจ้าของข้อมูล" ----
    for (const cu of userIds) {
      const cares = uniq(members.filter((m) => m.user_id === cu).flatMap((m) => careFor.filter((x) => x.circle_id === m.circle_id).map((x) => x.profile_id)));
      for (const pid of cares) {
        const p = profileMap.get(pid); if (!p || p.user_id === cu || !p.reminder_enabled || !isPrem(p.user_id)) continue;
        const st = slotTimes(p.user_id);
        for (const [slot, def] of Object.entries(SLOTS)) {
          const diff = toMin(now) - toMin(st[slot] || def.time);
          if (diff < MISSED_AFTER_MIN || diff > MISSED_MAX_MIN) continue;
          const due = dueMeds(p, slot); if (!due.length) continue;
          msgs.push({ userId: cu, key: `missed:${today}:${p.id}:${slot}`, title: `⚠️ ${p.name} ยังไม่ได้กิน${SLOTS[slot].label}`, body: `เลยเวลามาแล้ว ${diff >= 120 ? Math.floor(diff / 60) + ' ชม.' : diff + ' นาที'} · ยาที่ยังไม่ได้ติ๊ก: ${due.map((m) => m.name).join(', ')}\nลองโทรถามหรือเปิดแอพช่วยติ๊กให้` });
        }
      }
    }

    // ---- ส่ง ----
    let sent = 0; const exp = Math.floor(Date.now() / 1000) + ACTION_TTL_SEC;
    for (const m of msgs) {
      // จองคีย์ก่อนส่ง — ถ้ามีอยู่แล้วแปลว่าเคยส่งไปแล้ว
      const { data: claimed } = await sb.from('notification_log').upsert({ user_id: m.userId, key: m.key }, { onConflict: 'user_id,key', ignoreDuplicates: true }).select();
      if (!claimed?.length) continue;
      const payload: Record<string, unknown> = { title: m.title, body: m.body, tag: m.key, url: '/' };
      if (m.med) { // ปุ่ม "กินแล้ว / เตือนอีก 15 นาที" — โทเคนลงลายมือชื่อ ใช้ได้ 6 ชม. กับคน/ช่วงเวลา/วันนี้เท่านั้น
        payload.token = await signToken({ u: m.userId, p: m.med.p, s: m.med.s, d: m.med.d, k: m.key, n: m.med.n, exp });
        payload.fn = `${SB_URL}/functions/v1/notification-action`;
        payload.med = { p: m.med.p, s: m.med.s, d: m.med.d };
        payload.actions = [{ action: 'taken', title: '✓ กินแล้ว' }, { action: 'snooze', title: '⏰ เตือนอีก 15 นาที' }];
      }
      for (const s of (subs ?? []).filter((x) => x.user_id === m.userId)) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await sb.from('push_subscriptions').delete().eq('id', s.id); // เครื่องยกเลิกแล้ว
          else console.error('push failed', code, (e as Error).message);
        }
      }
    }
    // ลบรายการ "เตือนอีกครั้ง" ที่ถึงเวลาแล้ว (ส่งไปแล้ว หรือไม่ต้องส่งแล้ว) และล้างประวัติเก่า
    const done = snoozes.map((z) => z.id); if (done.length) await sb.from('reminder_snoozes').delete().in('id', done);
    await sb.from('reminder_snoozes').delete().lt('due_at', new Date(Date.now() - 864e5).toISOString());
    await sb.from('notification_log').delete().lt('sent_at', new Date(Date.now() - 30 * 864e5).toISOString());
    return Response.json({ sent, candidates: msgs.length, today, now });
  } catch (e) {
    console.error(e);
    return new Response((e as Error).message, { status: 500 });
  }
});
