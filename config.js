/* สุขใจ — ตั้งค่าการเชื่อมต่อ
 * เว้นว่างไว้ = "โหมดทดลอง" (ไม่ต้อง login, ข้อมูลเก็บในเครื่อง)
 * กรอกครบ   = ใช้ Supabase (ต้อง login, ข้อมูลซิงก์ทุกเครื่อง, Web Push)
 * ดูวิธีหาค่าเหล่านี้ใน README.md
 * หมายเหตุ: anon key และ VAPID public key เปิดเผยได้ (ความปลอดภัยมาจาก RLS ในฐานข้อมูล)
 *           ห้ามใส่ service_role key หรือ VAPID private key ในไฟล์นี้เด็ดขาด
 */
window.SUKJAI_CONFIG = {
  SUPABASE_URL: 'https://yiczrjlyndicfiazruvt.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_yvltM9obpVYMJvzJj0tAVA_cG6ViLyi',  // publishable key (เปิดเผยได้)
  VAPID_PUBLIC_KEY: '',   // จากคำสั่ง npx web-push generate-vapid-keys
};
