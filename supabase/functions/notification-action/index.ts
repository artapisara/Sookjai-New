// © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์
// สุขใจ — Edge Function: รับปุ่มจากการแจ้งเตือน "✓ กินแล้ว" และ "⏰ เตือนอีก 15 นาที"
// เรียกจาก Service Worker (ไม่มีผู้ใช้ล็อกอิน) จึงต้อง deploy แบบไม่ตรวจ JWT:  supabase functions deploy notification-action --no-verify-jwt
// ความปลอดภัย: ทำงานได้ต่อเมื่อโทเคนที่ send-reminders ลงลายมือชื่อไว้ถูกต้องและยังไม่หมดอายุ (6 ชม.) · แต่ละโทเคนผูกกับคน/ช่วงเวลา/วันนั้นๆ เท่านั้น
// Secrets: ACTION_SECRET (หรือ CRON_SECRET) · SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ · ต้องรัน supabase/reminders-v2.sql (ตาราง reminder_snoozes)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyToken } from '../_shared/token.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SNOOZE_MIN = 15; const MAX_SNOOZES = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const { token, action } = await req.json().catch(() => ({}));
    const c = await verifyToken(token);
    if (!c) return json({ error: 'invalid or expired' }, 401);

    if (action === 'taken') {
      // ติ๊กกินแล้วให้ยาทุกตัวของคนนั้นที่ถึงเวลาช่วงนี้ (เหมือนกดติ๊กในแอพ) — ข้ามตัวที่ติ๊กไปแล้ว
      const dow = new Date(c.d + 'T12:00:00Z').getUTCDay();
      const { data: meds, error } = await sb.from('medications').select('id, slots, weekdays, as_needed').eq('profile_id', c.p).eq('status', 'active');
      if (error) return json({ error: error.message }, 500);
      const rows = (meds ?? []).filter((m) => !m.as_needed && (m.slots ?? []).includes(c.s) && (!m.weekdays?.length || m.weekdays.includes(dow)))
        .map((m) => ({ user_id: c.u, medication_id: m.id, log_date: c.d, slot: c.s, taken_at: new Date().toISOString() }));
      if (rows.length) {
        const { error: e2 } = await sb.from('med_logs').upsert(rows, { onConflict: 'medication_id,log_date,slot', ignoreDuplicates: true });
        if (e2) return json({ error: e2.message }, 500);
      }
      return json({ ok: true, marked: rows.length });
    }

    if (action === 'snooze') {
      if (c.n >= MAX_SNOOZES) return json({ ok: true, skipped: 'max snoozes' });
      const { error } = await sb.from('reminder_snoozes').insert({ user_id: c.u, profile_id: c.p, slot: c.s, log_date: c.d, n: c.n + 1, due_at: new Date(Date.now() + SNOOZE_MIN * 60000).toISOString() });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'server error' }, 500);
  }
});
