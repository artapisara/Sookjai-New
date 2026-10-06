-- © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์
-- สุขใจ: ระบบสมาชิก Premium (วันหมดอายุ + ทดลอง 1 เดือน + จำกัดแพ็กเกจฟรีที่ฐานข้อมูล) และลบบัญชีผู้ใช้
-- รันใน Supabase → SQL Editor (รันซ้ำได้) · ต้องรัน schema.sql มาก่อนแล้ว
-- ค่าเริ่มต้น: ปิดการจำกัดแพ็กเกจฟรี (paywall_enabled = false) ทุกคนใช้ได้ครบจนกว่าจะสั่งเปิดตอนเปิดขายจริง

-- ---------- 1) สวิตช์เปิด/ปิดการจำกัด ----------
create table if not exists public.app_flags (
  key   text primary key,
  value boolean not null default false
);
alter table public.app_flags enable row level security;
drop policy if exists "flags read" on public.app_flags;
create policy "flags read" on public.app_flags for select to anon, authenticated using (true);   -- อ่านได้ทุกคน · แก้ได้เฉพาะ SQL Editor (service role)
insert into public.app_flags (key, value) values ('paywall_enabled', false) on conflict (key) do nothing;
-- เปิดตอนเปิดขายจริง:  update public.app_flags set value = true where key = 'paywall_enabled';

-- ---------- 2) สถานะสมาชิกต่อบัญชี (ผู้ใช้อ่านของตัวเองได้ แก้เองไม่ได้) ----------
create table if not exists public.subscriptions (
  user_id       uuid primary key references auth.users on delete cascade,
  premium_until timestamptz,                 -- สมาชิกถึงเมื่อไหร่ (ว่าง = ไม่มี)
  trial_used    boolean not null default false,   -- ใช้สิทธิ์ทดลอง 1 เดือนแล้วหรือยัง (ต่อบัญชี ครั้งเดียว)
  source        text,                        -- trial | grant | google_play | app_store | web
  note          text,
  updated_at    timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions read own" on public.subscriptions;
create policy "subscriptions read own" on public.subscriptions for select to authenticated using (user_id = auth.uid());
-- ไม่มี policy insert/update/delete สำหรับผู้ใช้ → เขียนได้เฉพาะฟังก์ชันด้านล่าง และ SQL Editor/Edge Function (service role)

-- เป็น Premium ไหม: ปิดสวิตช์การจำกัด = ทุกคนเป็น Premium · เปิดสวิตช์ = ดูวันหมดอายุ
create or replace function public.is_premium(uid uuid default auth.uid()) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_flags where key = 'paywall_enabled'), false) = false
      or exists (select 1 from public.subscriptions s where s.user_id = uid and s.premium_until > now())
$$;

-- เริ่มทดลอง Premium 1 เดือน (ครั้งเดียวต่อบัญชี)
create or replace function public.start_trial() returns timestamptz
  language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); until timestamptz;
begin
  if uid is null then raise exception 'ยังไม่ได้เข้าสู่ระบบ'; end if;
  insert into public.subscriptions (user_id) values (uid) on conflict (user_id) do nothing;
  if (select trial_used from public.subscriptions where user_id = uid) then raise exception 'TRIAL_USED'; end if;
  until := greatest(now(), coalesce((select premium_until from public.subscriptions where user_id = uid), now())) + interval '1 month';
  update public.subscriptions set premium_until = until, trial_used = true, source = coalesce(source, 'trial'), updated_at = now() where user_id = uid;
  return until;
end $$;
revoke all on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

-- ---------- 3) บังคับเพดานแพ็กเกจฟรีที่ฐานข้อมูล (ไม่พึ่งแค่ซ่อนปุ่ม) — ข้อมูลเดิมไม่ถูกลบ แค่เพิ่มของใหม่ไม่ได้ ----------
-- 3.1 คนในครอบครัวที่เป็นเจ้าของ: ฟรี 1 คน (ดูแลตัวเองหรือพ่อแม่หนึ่งคนฟรี · หลายคนใช้ Premium) — เปลี่ยนเลข 1 ถ้าอยากให้ฟรีได้มากกว่านี้
create or replace function public.limit_profiles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_premium(auth.uid()) then return new; end if;
  if (select count(*) from public.profiles where user_id = auth.uid()) >= 1 then raise exception 'PREMIUM_REQUIRED:profiles'; end if;
  return new;
end $$;
drop trigger if exists limit_profiles on public.profiles;
create trigger limit_profiles before insert on public.profiles for each row execute function public.limit_profiles();

-- 3.1b กลุ่มผู้ดูแลที่สร้าง: ฟรี 1 กลุ่ม
create or replace function public.limit_circles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_premium(auth.uid()) then return new; end if;
  if (select count(*) from public.circles where user_id = auth.uid()) >= 1 then raise exception 'PREMIUM_REQUIRED:circles'; end if;
  return new;
end $$;
drop trigger if exists limit_circles on public.circles;
create trigger limit_circles before insert on public.circles for each row execute function public.limit_circles();

-- 3.2 เชิญผู้ดูแลเข้ากลุ่ม: แบบ "ดูอย่างเดียว" (viewer) ไม่จำกัด · แบบ "แก้ไขได้" (member) ฟรี 1 คน (นับคำเชิญที่ส่งไว้ + สมาชิกในกลุ่มของเรา)
create or replace function public.limit_invites() returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or public.is_premium(auth.uid()) or new.role = 'viewer' then return new; end if;
  select (select count(*) from public.circle_invites where invited_by = auth.uid() and role <> 'viewer')
       + (select count(*) from public.circle_members m join public.circles c on c.id = m.circle_id where c.user_id = auth.uid() and m.user_id <> auth.uid() and m.role <> 'viewer') into n;
  if n >= 1 then raise exception 'PREMIUM_REQUIRED:invites'; end if;
  return new;
end $$;
drop trigger if exists limit_invites on public.circle_invites;
create trigger limit_invites before insert on public.circle_invites for each row execute function public.limit_invites();

-- เปลี่ยนสิทธิ์สมาชิกจาก "ดูอย่างเดียว" เป็น "แก้ไขได้": นับรวมโควตาผู้ดูแลแบบแก้ไขได้ของฟรีด้วย
create or replace function public.limit_member_role() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; n int;
begin
  if new.role = 'viewer' or new.role = old.role then return new; end if;
  select c.user_id into owner from public.circles c where c.id = new.circle_id;
  if owner is null or public.is_premium(owner) then return new; end if;
  select (select count(*) from public.circle_invites i join public.circles c on c.id = i.circle_id where c.user_id = owner and i.role <> 'viewer')
       + (select count(*) from public.circle_members m join public.circles c on c.id = m.circle_id where c.user_id = owner and m.user_id <> owner and m.role <> 'viewer' and m.id <> new.id) into n;
  if n >= 1 then raise exception 'PREMIUM_REQUIRED:invites'; end if;
  return new;
end $$;
drop trigger if exists limit_member_role on public.circle_members;
create trigger limit_member_role before update of role on public.circle_members for each row execute function public.limit_member_role();
-- 3.3 รูปใบนัด: ฟรี 3 ใบนัดต่อบัญชี (ใบนัดที่มีรูปอยู่แล้วแก้ต่อได้)
create or replace function public.limit_slips() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_premium(auth.uid()) then return new; end if;
  if coalesce(array_length(new.attachments, 1), 0) = 0 then return new; end if;
  if tg_op = 'UPDATE' and coalesce(array_length(old.attachments, 1), 0) > 0 then return new; end if;
  if (select count(*) from public.appointments a where a.user_id = auth.uid() and a.id <> new.id and coalesce(array_length(a.attachments, 1), 0) > 0) >= 3
    then raise exception 'PREMIUM_REQUIRED:slips'; end if;
  return new;
end $$;
drop trigger if exists limit_slips on public.appointments;
create trigger limit_slips before insert or update on public.appointments for each row execute function public.limit_slips();

-- 3.4 ติดตามอาการ: ฟรี 1 แผน (ให้ลองก่อนซื้อ) · แผนที่ 2 ขึ้นไปเป็น Premium · แผนเดิมดูประวัติและบันทึกต่อได้เสมอ
create or replace function public.limit_care_plans() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_premium(auth.uid()) then return new; end if;
  if (select count(*) from public.care_plans where user_id = auth.uid()) >= 1 then raise exception 'PREMIUM_REQUIRED:care'; end if;
  return new;
end $$;
drop trigger if exists limit_care_plans on public.care_plans;
create trigger limit_care_plans before insert on public.care_plans for each row execute function public.limit_care_plans();
-- 3.5 บันทึกอารมณ์รายวัน: เพิ่ม/แก้ได้เฉพาะ Premium (ข้อมูลเดิมยังอยู่ ดูได้) — ต้องมีตาราง mood_logs จาก schema.sql ก่อน
create or replace function public.limit_mood() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_premium(auth.uid()) then return new; end if;
  raise exception 'PREMIUM_REQUIRED:mood';
end $$;
do $$ begin
  if to_regclass('public.mood_logs') is not null then
    drop trigger if exists limit_mood on public.mood_logs;
    create trigger limit_mood before insert or update on public.mood_logs for each row execute function public.limit_mood();
  end if;
end $$;
-- ---------- 4) ลบบัญชีผู้ใช้ (สโตร์บังคับ: ต้องลบบัญชี ไม่ใช่แค่ข้อมูล) ----------
-- ลบแถวใน auth.users → ข้อมูลทุกตารางที่อ้าง user_id ถูกลบต่อเนื่อง (on delete cascade) · ไฟล์รูปใน Storage แอพลบก่อนเรียกฟังก์ชันนี้
create or replace function public.delete_my_account() returns void
  language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'ยังไม่ได้เข้าสู่ระบบ'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- 5) ตัวอย่างคำสั่งของเจ้าของระบบ (รันใน SQL Editor เมื่อต้องการ) ----------
-- ให้สิทธิ์ Premium ฟรี (เช่น ผู้ทดลอง) ถึงวันที่กำหนด:
--   insert into public.subscriptions (user_id, premium_until, source, note)
--   select id, now() + interval '6 months', 'grant', 'ผู้ทดลองกลุ่มแรก' from auth.users where email = 'อีเมลผู้ทดลอง@example.com'
--   on conflict (user_id) do update set premium_until = excluded.premium_until, source = 'grant', note = excluded.note, updated_at = now();
-- ดูสมาชิกทั้งหมด:  select u.email, s.* from public.subscriptions s join auth.users u on u.id = s.user_id order by s.premium_until desc;
