-- © 2026 สุขใจ — สวิตช์เตือนนัดหมอรายคน (ตั้งค่า > การแจ้งเตือน > เตือนนัดพบแพทย์)
-- รันซ้ำได้ · ไม่รันก็ใช้แอพได้ แต่เปิด/ปิดเตือนนัดหมอรายคนจะบันทึกไม่ได้
alter table public.profiles add column if not exists appt_reminder boolean not null default true;
