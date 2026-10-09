/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
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
  VAPID_PUBLIC_KEY: 'BMjoz30lAtbAyXbtFoaaQjykfTCGFw3E0Vlt5AljvymgD167fYbdy5-2x14gWCUqsUSUOPUs8xgmTd_tThYzkao',   // จากคำสั่ง npx web-push generate-vapid-keys
  PRIVACY_CONTACT: 'support@logicbrew.dev',    // อีเมลติดต่อเรื่องข้อมูลส่วนบุคคล (PDPA) — แสดงในหน้าขออนุญาต/ความเป็นส่วนตัว และหน้าที่เกี่ยวกับ PDPA
  DEVELOPER_NAME: 'อภิสรา บำรุงจิตต์',     // ชื่อจริงผู้พัฒนา/ผู้ควบคุมข้อมูล (ใช้ในเอกสารกฎหมาย: privacy.html, delete-account.html)
  DEVELOPER_DISPLAY: 'Apisara B. (Logicbrew.dev)', // ชื่อที่แสดงในหน้าตั้งค่าของแอป
  CONTACT_EMAIL: 'support@logicbrew.dev',      // อีเมลติดต่อ (แสดงในหน้าตั้งค่า · หน้านโยบายความเป็นส่วนตัวและหน้าลบบัญชีใช้เป็นอีเมลติดต่อด้วยถ้า PRIVACY_CONTACT ว่าง)
  SUPPORT_URL: '',        // ลิงก์ช่องทางสนับสนุน เช่น หน้าเพจ/ไลน์ OA/Buy me a coffee
};
