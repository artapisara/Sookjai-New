-- © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์
-- สุขใจ: ตัวช่วยสำหรับแจ้งเตือนคำเชิญเข้ากลุ่มผู้ดูแล (Edge Function notify-invite)
-- รันใน Supabase → SQL Editor (รันซ้ำได้) หลังรัน schema.sql แล้ว

-- หา user id จากอีเมล — เรียกได้เฉพาะ service role (Edge Function) ผู้ใช้ทั่วไปเรียกไม่ได้ (กันค้นหาว่าอีเมลไหนมีบัญชี)
create or replace function public.user_id_by_email(p_email text) returns uuid
  language sql stable security definer set search_path = public, auth as
  $$ select id from auth.users where lower(email) = lower(p_email) limit 1 $$;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
