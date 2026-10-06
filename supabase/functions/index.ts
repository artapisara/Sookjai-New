// © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์
// สุขใจ — Edge Function: ส่ง Web Push บอกคนที่ถูกเชิญเข้ากลุ่มผู้ดูแล
// เรียกจากแอพของผู้เชิญหลังบันทึกคำเชิญสำเร็จ: functions.invoke('notify-invite', { body: { invite_id } })
// ส่งเฉพาะเมื่อ: ผู้เรียกเป็นผู้เชิญจริง · คำเชิญสร้างไม่เกิน 10 นาที · ผู้ถูกเชิญมีบัญชีตรงอีเมลและเปิดแจ้งเตือนไว้
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ชุดเดียวกับ send-reminders) · SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ
// ต้องรัน supabase/invite-push.sql ก่อน (ฟังก์ชัน user_id_by_email)
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // 1) ผู้เรียกต้องล็อกอิน
    const authHeader = req.headers.get('Authorization') ?? '';
    const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: u } = await caller.auth.getUser();
    if (!u?.user) return json({ error: 'unauthorized' }, 401);

    const { invite_id } = await req.json().catch(() => ({}));
    if (!invite_id || typeof invite_id !== 'string') return json({ error: 'invite_id required' }, 400);

    // 2) ตรวจคำเชิญ: ต้องเป็นของผู้เรียก และใหม่ (กันใช้ซ้ำสแปม)
    const { data: inv } = await admin.from('circle_invites').select('id, circle_id, email, invited_by, created_at').eq('id', invite_id).maybeSingle();
    if (!inv || inv.invited_by !== u.user.id) return json({ error: 'not found' }, 404);
    if (Date.now() - Date.parse(inv.created_at) > 10 * 60 * 1000) return json({ sent: 0, reason: 'invite too old' });

    // 3) กันส่งซ้ำ
    const { data: claimed } = await admin.from('notification_log').upsert({ user_id: u.user.id, key: `invite:${inv.id}` }, { onConflict: 'user_id,key', ignoreDuplicates: true }).select();
    if (!claimed?.length) return json({ sent: 0, reason: 'already sent' });

    // 4) หาผู้ถูกเชิญจากอีเมล แล้วส่งไปทุกเครื่องที่เปิดแจ้งเตือน
    const { data: targetId } = await admin.rpc('user_id_by_email', { p_email: inv.email });
    if (!targetId) return json({ sent: 0, reason: 'no account' });
    const { data: circle } = await admin.from('circles').select('name').eq('id', inv.circle_id).maybeSingle();
    const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', targetId);
    if (!subs?.length) return json({ sent: 0, reason: 'no push subscription' });

    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: '👨‍👩‍👧 มีคนเชิญคุณเข้ากลุ่มผู้ดูแล', body: `กลุ่ม "${circle?.name ?? ''}" — เปิดแอพสุขใจ แล้วดูที่แท็บ สมาชิก เพื่อรับหรือปฏิเสธ`, tag: `invite:${inv.id}`, url: '/' }), { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id);
        else console.error('push failed', code, (e as Error).message);
      }
    }
    return json({ sent });
  } catch (e) {
    console.error(e);
    return json({ error: 'server error' }, 500);
  }
});
