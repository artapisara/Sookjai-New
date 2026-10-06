-- © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์
-- สุขใจ: บันทึกความดันโลหิตและน้ำตาลในเลือด (health_logs)
-- รันใน Supabase → SQL Editor (รันซ้ำได้) · ต้องรัน schema.sql มาก่อนแล้ว
-- สิทธิ์เหมือนตารางอื่นของคนในครอบครัว: เจ้าของอ่าน/เขียนได้ · สมาชิกกลุ่ม "แก้ไขได้" เพิ่ม/แก้ได้ · "ดูอย่างเดียว" อ่านได้ · ลบได้เฉพาะแถวที่ตัวเองสร้างหรือเจ้าของโปรไฟล์

create table if not exists public.health_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  profile_id uuid not null references public.profiles on delete cascade,
  kind       text not null check (kind in ('bp','glucose')),          -- bp = ความดัน · glucose = น้ำตาลในเลือด
  log_date   date not null,
  log_time   time,
  sys        int check (sys between 50 and 300),                       -- ความดันตัวบน (mmHg)
  dia        int check (dia between 30 and 200),                       -- ความดันตัวล่าง (mmHg)
  pulse      int check (pulse between 20 and 250),                     -- ชีพจร (ครั้ง/นาที)
  glucose    int check (glucose between 10 and 800),                   -- น้ำตาลในเลือด (mg/dL)
  ctx        text check (ctx in ('fasting','before_meal','after_meal','bedtime','other')),  -- วัดตอนไหน (เฉพาะน้ำตาล)
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists health_logs_profile on public.health_logs (profile_id, kind, log_date);
alter table public.health_logs enable row level security;
drop policy if exists "health_logs read"   on public.health_logs;
drop policy if exists "health_logs add"    on public.health_logs;
drop policy if exists "health_logs edit"   on public.health_logs;
drop policy if exists "health_logs delete" on public.health_logs;
create policy "health_logs read"   on public.health_logs for select to authenticated using (public.can_read_profile(profile_id));
create policy "health_logs add"    on public.health_logs for insert to authenticated with check (user_id = auth.uid() and public.can_write_profile(profile_id));
create policy "health_logs edit"   on public.health_logs for update to authenticated using (public.can_write_profile(profile_id)) with check (public.can_write_profile(profile_id));
create policy "health_logs delete" on public.health_logs for delete to authenticated using (user_id = auth.uid() or public.owns_profile(profile_id));
