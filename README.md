# สุขใจ v0.2 — เตือนกินยา & นัดหมอ

เว็บแอพ (PWA) ไฟล์ล้วน HTML/CSS/JS ไม่ต้อง build อัปขึ้น Vercel ได้ทันที

แอพมี 2 โหมด:

| | โหมดทดลอง | โหมดใช้งานจริง (Supabase) |
|---|---|---|
| เปิดใช้เมื่อ | `config.js` ว่างไว้ | กรอก `config.js` ครบ |
| Login | ไม่ต้อง | อีเมล + รหัสผ่าน |
| ข้อมูล | อยู่ในเครื่อง/เบราว์เซอร์นั้น | อยู่บน Supabase ซิงก์ทุกเครื่อง |
| รูปใบนัด | เก็บในเครื่อง (ย่อขนาดแล้ว) | Supabase Storage |
| แจ้งเตือน | เฉพาะตอนเปิดแอพค้างไว้ | Web Push เตือนได้แม้ปิดแอพ |

---

## โครงสร้างไฟล์

```
index.html            หน้าหลัก + ปุ่มฉุกเฉิน 1669
config.js             ← กรอกค่า Supabase / VAPID ที่นี่
styles.css            หน้าตา (5 สีหลัก)
sw.js                 Service Worker รับ Web Push
manifest.json, icon.svg
js/util.js            ค่าคงที่ (ช่วงเวลา 7 ช่วง, แผนก, สาเหตุ ฯลฯ)
js/avatars.js         ไอคอนคน 24 แบบ (ชาย/หญิง × เด็ก/วัยทำงาน/ผู้สูงอายุ × 4 ท่า)
js/db.js              ชั้นข้อมูล Supabase / โหมดทดลอง
js/app.js             หน้าจอ: วันนี้ (ตารางทานยา), ยา, ปฏิทิน, ครอบครัว, Login
js/forms.js           ฟอร์มยา / นัดหมอ (ฟอร์มเดียว) / โปรไฟล์
js/notify.js          การแจ้งเตือนฝั่งแอพ
supabase/schema.sql   ตาราง + RLS + Storage bucket
supabase/functions/send-reminders/index.ts   Edge Function ส่ง Web Push
supabase/cron.sql     ตั้งให้ส่งเตือนทุก 5 นาที
```

---

## ขั้นที่ 1 — ลองโหมดทดลองบน Vercel (ไม่ต้องตั้งค่าอะไร)

1. github.com → **New repository** ตั้งชื่อ `sukjai` → Create
2. กด **uploading an existing file** → ลาก *ทุกไฟล์และโฟลเดอร์* ในโปรเจกต์นี้ลงไป → Commit
3. vercel.com → **Add New… → Project** → เลือก `sukjai` → Framework Preset: **Other** → **Deploy**
4. เปิดลิงก์ `xxx.vercel.app` ในมือถือ → เพิ่มไปยังหน้าจอโฮม

> จะมีข้อมูลตัวอย่าง (ปู่เค็ม ย่าปลา พ่อ แม่) ให้ลองกด — ล้างได้ที่แท็บครอบครัว → "ล้างข้อมูล"

---

## ขั้นที่ 2 — เชื่อม Supabase (ฐานข้อมูล + Login + รูป)

1. supabase.com → **New project** (Region แนะนำ Singapore)
2. เมนู **SQL Editor** → New query → วางเนื้อหา `supabase/schema.sql` ทั้งไฟล์ → **Run**
3. เมนู **Project Settings → API** คัดลอก
   - Project URL → ใส่ `SUPABASE_URL` ใน `config.js`
   - `anon` `public` key → ใส่ `SUPABASE_ANON_KEY`
4. เมนู **Authentication → URL Configuration** → Site URL ใส่ลิงก์ Vercel ของคุณ (เพื่อให้ลิงก์ยืนยันอีเมลกลับมาที่แอพ)
5. แก้ `config.js` ใน GitHub → Commit → Vercel อัปเดตเองใน 1 นาที → เปิดแอพจะเจอหน้า Login

> ⚠️ ห้ามใส่ `service_role` key ใน `config.js` เด็ดขาด (ไฟล์นี้ทุกคนเปิดดูได้) — anon key เปิดเผยได้เพราะมี RLS คุมอยู่

---

## ขั้นที่ 3 — Web Push (เตือนแม้ปิดแอพ)

ต้องใช้ Node.js ในคอมพิวเตอร์ และ Supabase CLI

```bash
# 1) สร้างกุญแจ VAPID (ได้ Public + Private key)
npx web-push generate-vapid-keys

# 2) เชื่อมโปรเจกต์ (ดู PROJECT_REF จาก URL เช่น https://<PROJECT_REF>.supabase.co)
npx supabase login
npx supabase link --project-ref <PROJECT_REF>

# 3) ตั้ง secrets ของ Edge Function
npx supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> \
  VAPID_SUBJECT=mailto:<อีเมลคุณ> CRON_SECRET=<ตั้งรหัสยาวๆ เอง>

# 4) อัปโหลด Edge Function
npx supabase functions deploy send-reminders --no-verify-jwt
```

5. Supabase → **Database → Extensions** เปิด `pg_cron` และ `pg_net`
6. SQL Editor → วาง `supabase/cron.sql` → แก้ `<PROJECT_REF>` และ `<CRON_SECRET>` → Run
7. ใส่ VAPID **Public** key ใน `config.js` (`VAPID_PUBLIC_KEY`) → Commit
8. ในแอพ: แท็บครอบครัว → **🔔 เปิดการแจ้งเตือนบนเครื่องนี้** (ทำในทุกเครื่องที่อยากให้เด้ง)

**iPhone:** ต้อง iOS 16.4 ขึ้นไป และต้อง "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดจากไอคอนก่อน จึงจะกดเปิดแจ้งเตือนได้

### กติกาการแจ้งเตือน
- **นัดหมอ:** 5, 2 และ 1 วันก่อนนัด เวลา 08:00 เป็นต้นไป — ส่งเสมอ พร้อมหมายเหตุ
- **กินยา:** เมื่อถึงเวลาของช่วงนั้น (ตั้งได้ในแท็บครอบครัว) ส่งเฉพาะ
  คนที่เปิด "แจ้งเตือนกินยา" **และ** ยาที่เปิด 🔔 ในช่วงนั้น **และ** ยังไม่มีบันทึกการกินยา
- ส่งครั้งเดียวต่อรายการ (กันซ้ำด้วยตาราง `notification_log`)

---

## หลัก "กรอกครั้งเดียว ใช้ได้ทุกที่"
ฟอร์มนัดหมอมีที่เดียว (`apptForm` ใน `js/forms.js`) ข้อมูลถูกเก็บในตาราง `appointments` แถวเดียว
โดยชื่อหมอ/โรงพยาบาล/เบอร์โทรเก็บแยกในตาราง `doctors` และ `hospitals` แล้วอ้างอิงด้วย id
→ ปฏิทิน, หน้ารายละเอียด, แถบเตือนหน้าแรก และ Web Push อ่านจากแหล่งเดียวกันทั้งหมด
(แก้เบอร์โรงพยาบาลครั้งเดียว ทุกนัดที่ใช้โรงพยาบาลนั้นเปลี่ยนตาม)

---

## ข้อควรทราบ
- เป็นแอพช่วยจำ ใช้ประกอบการดูแล ไม่แทนคำแนะนำของแพทย์หรือเภสัชกร
- ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว — ตั้งรหัสผ่านที่เดายาก และอย่าแชร์บัญชี
- ข้อมูลโหมดทดลองไม่ย้ายไป Supabase อัตโนมัติ (ต้องกรอกใหม่)
