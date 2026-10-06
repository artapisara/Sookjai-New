-- © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์
-- สุขใจ: ตัวช่วยฝั่งฐานข้อมูลสำหรับปุ่ม "เตือนอีก 15 นาที" ในการแจ้งเตือน (ตาราง reminder_snoozes — ใช้โดย Edge Function เท่านั้น)
-- รันใน Supabase → SQL Editor (รันซ้ำได้) · ต้องรัน schema.sql มาก่อนแล้ว

create table if not exists public.reminder_snoozes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  slot       text not null,
  log_date   date not null,
  n          int  not null default 1,                 -- เลื่อนมาแล้วกี่ครั้ง (สูงสุด 3)
  due_at     timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists reminder_snoozes_due on public.reminder_snoozes (due_at);
alter table public.reminder_snoozes enable row level security;   -- ไม่มี policy = ผู้ใช้เข้าถึงตรงๆ ไม่ได้ · Edge Function ใช้ service role
