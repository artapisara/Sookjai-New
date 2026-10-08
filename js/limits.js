/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — ค่าโควตา Free / Premium (ที่เดียว)
 * ค่าจริงอยู่ที่ตาราง app_limits ในฐานข้อมูล (supabase/limits-v2.sql) — แอปอ่านมาทับค่าด้านล่างตอนเปิดแอป จึงแก้เลขที่ตารางเดียวได้ทั้งฝั่งแอปและฝั่งฐานข้อมูล
 * ค่าด้านล่างเป็นค่าเริ่มต้นสำรอง (โหมดทดลอง / ยังไม่ได้รัน SQL / ออฟไลน์) — ต้องเท่ากับค่าเริ่มต้นใน limits-v2.sql
 * สวิตช์ ENFORCE_LIMITS = app_flags.paywall_enabled (ปิดอยู่ = แสดงตัวนับและข้อความแพ็กเกจ แต่ไม่บล็อก) — ดู paywallOn() ใน premium.js
 */
'use strict';

const LIMITS = {
  FREE_MAX_MEDS_PER_PROFILE: 10,         // ยาที่ "กำลังทาน" ต่อโปรไฟล์ (นับรวมยาทานเมื่อมีอาการ · ยาหยุดแล้ว/งดชั่วคราวไม่นับ)
  FREE_MAX_CARED_PEOPLE: 1,              // คนที่ฉันดูแล (ไม่รวมโปรไฟล์ของฉัน · ไม่รวมที่แชร์มาให้)
  FREE_MAX_GROUPS: 1,                    // กลุ่มผู้ดูแลที่สร้าง
  FREE_MAX_APPOINTMENTS_PER_PROFILE: 3,  // ใบนัดที่เก็บอยู่ต่อโปรไฟล์
  FREE_MAX_GROUP_MEMBERS: 5,             // คนที่ถูกเชิญเข้ากลุ่ม (ต่อกลุ่ม)
};
const UPLOAD_MAX_BYTES = 1024 * 1024; // บีบอัดรูปก่อนอัปโหลดให้ไม่เกินประมาณ 1 MB ต่อรูป (ดู compressImage ใน util.js)
/** ผสมค่าจากตาราง app_limits (ถ้ามี) — เรียกจาก SupaDB.loadEntitlement */
function applyLimits(rows) {
  for (const r of rows || []) if (r && r.key in LIMITS && Number.isFinite(Number(r.value))) LIMITS[r.key] = Number(r.value);
}
