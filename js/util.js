/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — ค่าคงที่และตัวช่วยที่ใช้ร่วมกัน */
'use strict';

// ช่วงเวลาทานยา 7 ช่วง (เรียงตามเวลาจริงของวัน)
// เวลา: 24 ชั่วโมง (00:00 - 23:59) ให้ผู้ใช้ไม่สับสน AM/PM
const SLOTS = [
  { key: 'before_breakfast', label: 'ก่อนอาหารเช้า', display: 'ก่อนเช้า (6:30)', short: 'ก่อนเช้า', icon: '🌅', time: '06:30' },
  { key: 'after_breakfast', label: 'หลังอาหารเช้า', display: 'หลังเช้า (7:30)', short: 'หลังเช้า', icon: '🌅', time: '07:30' },
  { key: 'before_lunch', label: 'ก่อนอาหารกลางวัน', display: 'ก่อนเที่ยง (11:30)', short: 'ก่อนเที่ยง', icon: '☀️', time: '11:30' },
  { key: 'after_lunch', label: 'หลังอาหารกลางวัน', display: 'หลังเที่ยง (12:30)', short: 'หลังเที่ยง', icon: '☀️', time: '12:30' },
  { key: 'before_dinner', label: 'ก่อนอาหารเย็น', display: 'ก่อนเย็น (17:30)', short: 'ก่อนเย็น', icon: '🌇', time: '17:30' },
  { key: 'after_dinner', label: 'หลังอาหารเย็น', display: 'หลังเย็น (18:30)', short: 'หลังเย็น', icon: '🌇', time: '18:30' },
  { key: 'bedtime', label: 'ก่อนนอน', display: 'ก่อนนอน (21:00)', short: 'ก่อนนอน', icon: '🌙', time: '21:00' },
];
const DEFAULT_SLOT_TIMES = Object.fromEntries(SLOTS.map((s) => [s.key, s.time]));
const slotOf = (k) => SLOTS.find((s) => s.key === k) || { key: k, label: k, short: k, icon: '💊' };
// ยาที่ทานเฉพาะบางวันของสัปดาห์ (m.weekdays = [0..6], 0 = อาทิตย์ · ว่าง = ทุกวัน)
const WD_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const WD_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const dueOn = (m, key) => !m.weekdays?.length || m.weekdays.includes(new Date(`${key}T12:00:00`).getDay());
const dueToday = (m) => dueOn(m, todayKey());
const weekdaysText = (m) => (m.weekdays?.length && m.weekdays.length < 7 ? 'เฉพาะวัน' + [...m.weekdays].sort((a, b) => a - b).map((i) => WD_FULL[i]).join(' · ') : '');

const RELATIONS = ['ปู่', 'ย่า', 'ตา', 'ยาย', 'พ่อ', 'แม่', 'ตัวเอง', 'พี่สาว', 'พี่ชาย', 'น้องสาว', 'น้องชาย'];
const BLOOD_TYPES = ['A', 'B', 'AB', 'O'];
const DEPARTMENTS = ['อายุรกรรม', 'จักษุแพทย์', 'สูตินรีเวช', 'ศัลยกรรม', 'กระดูกและข้อ', 'หัวใจ', 'ผิวหนัง', 'หู คอ จมูก', 'ทันตกรรม'];
const VISIT_REASONS = ['ติดตามอาการ', 'รับยาต่อเนื่อง', 'ตรวจสุขภาพประจำปี', 'มีอาการผิดปกติ', 'ผ่าตัด/หัตถการ'];
const MED_STATUS = { active: 'กำลังกิน', paused: 'งดชั่วคราว', stopped: 'หยุดแล้ว' };
const PRESET_COLORS = ['#4D55F5', '#CA7FFE', '#DAFF7C', '#5CC8FF', '#FF7AD9', '#FFB347', '#3DDC97', '#FFE45C']; // สีประจำตัว: สดใส สว่าง เข้าชุดกับสีหลัก (น้ำเงิน ลิลลี เขียวมะนาว + สีคู่)
const LEGACY_COLORS = { '#3FA796': '#3DDC97', '#EF5B4C': '#FF7AD9', '#7C6CF2': '#CA7FFE', '#F2A93B': '#FFB347', '#3B82F6': '#5CC8FF', '#D9548F': '#FF7AD9', '#5BAA3C': '#DAFF7C', '#8C6E5D': '#FFE45C', '#A855F7': '#CA7FFE', '#5E9E0F': '#DAFF7C', '#1E88E5': '#5CC8FF', '#E0399B': '#FF7AD9', '#E8590C': '#FFB347', '#0F9D8A': '#3DDC97', '#8A6A4F': '#FFE45C', '#20C58D': '#3DDC97', '#FE8046': '#FFB347', '#FFCF34': '#FFE45C', '#E5675F': '#FF7AD9' }; // สีชุดเก่า → ชุดใหม่ (ย้ายให้อัตโนมัติ)
/** สีตัวหนังสือที่อ่านออกบนพื้นสีนั้น (พื้นสว่างใช้น้ำเงินเข้ม พื้นเข้มใช้ขาว) */
const inkOn = (hex) => { const n = parseInt(String(hex).slice(1), 16); const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; const L = .2126 * f(n >> 16) + .7152 * f((n >> 8) & 255) + .0722 * f(n & 255); return L > .4 ? '#161A4D' : '#fff'; };
const REMIND_DAYS = [5, 2, 1];
const LOW_STOCK_DAYS = 7;

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const DOW_L = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const pad = (n) => String(n).padStart(2, '0');
// หน่วยยา: เลือกจากรายการ หรือพิมพ์เอง · นับจำนวนคงเหลือ/วันยาหมดเฉพาะหน่วยที่นับเป็นชิ้น
const UNITS = ['เม็ด', 'แคปซูล', 'หยด', 'ครั้ง', 'ช้อนชา', 'มล.', 'ซอง', 'แผ่น'];
const STOCK_UNITS = ['เม็ด', 'แคปซูล', 'ซอง', 'แผ่น'];
const MAX_APPT_PHOTOS = 2; // รูปแนบสูงสุดต่อ 1 นัดหมอ
const unitOf = (m) => m.unit || 'เม็ด';
const tracksStock = (m) => STOCK_UNITS.includes(unitOf(m));
// ยาที่ "ทาน" (กินเข้าปาก): ไม่นับยาหยอดตา/ป้ายตา/ครีม/แผ่นแปะ ฯลฯ — ดูจากหน่วยของยา
const isOralMed = (m) => { const u = String(m.unit || ''); return !(['หยด', 'ครั้ง', 'แผ่น'].includes(u) || /หยอด|ป้าย|ทา|ครีม|พ่น|สูด|ตา/.test(u)); };
// รหัสเลขลำดับยาเริ่มต้น = พยัญชนะตัวแรกของชื่อ (ข้ามสระหน้า เ แ โ ใ ไ) เช่น ปู่หวาน → ป, แม่ → ม
const numOrNull = (v) => { const s = String(v ?? '').trim(); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const defaultPrefix =(name) => String(name || '').trim().replace(/^[เแโใไ]+/, '').charAt(0);
const PDPA_VERSION = '2026-10b';
const MOODS = [
  { k: 'happy', icon: '😊', label: 'มีความสุข', color: '#F7B731' },
  { k: 'calm', icon: '😌', label: 'สบายใจ', color: '#3FA796' },
  { k: 'meh', icon: '😐', label: 'เฉยๆ', color: '#9AA5AB' },
  { k: 'tired', icon: '😴', label: 'เหนื่อย', color: '#7C6CF2' },
  { k: 'sad', icon: '😢', label: 'เศร้า', color: '#3B82F6' },
  { k: 'worried', icon: '😟', label: 'กังวล', color: '#EF5B4C' },
];
const moodOf = (k) => MOODS.find((x) => x.k === k);
const doseLabel =(d) => { d = Number(d); if (Number.isInteger(d)) return String(d); const fr = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[+(d % 1).toFixed(2)]; return fr ? `${Math.floor(d) || ''}${fr}` : String(d); };
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDk = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = () => dk(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysUntil = (key) => Math.round((parseDk(key) - parseDk(todayKey())) / 86400000);
const hhmm = (t) => String(t || '').slice(0, 5);
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const thDate = (key, style) => {
  const d = parseDk(key);
  if (style === 'long') return `${DOW_L[d.getDay()]}ที่ ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  return `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${String(d.getFullYear() + 543).slice(2)}`;
};
/** วันที่ + เวลา จากเวลาที่บันทึก (ISO) เช่น 6 ต.ค. 69 เวลา 14:32 น. */
const thDateTime = (iso) => { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ''; return `${thDate(dk(d))} เวลา ${pad(d.getHours())}:${pad(d.getMinutes())} น.`; };
/** เวลาอัปเดตล่าสุดของรายการยา (ISO ของยาที่แก้ไขล่าสุด) */
const latestUpdate = (meds) => { let best = null; for (const m of meds) { const t = new Date(m.updated_at).getTime(); if (Number.isFinite(t) && (best === null || t > best)) best = t; } return best === null ? null : new Date(best).toISOString(); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, def = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : def; };
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const telHref = (p) => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
const ageOf = (y) => (y ? new Date().getFullYear() - Number(y) : null);
const hexA = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2600);
}

/** ย่อรูปก่อนอัปโหลด (กว้างสุด 1400px, JPEG) */
function compressImage(file, max = 1400, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('ย่อรูปไม่สำเร็จ'))), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('เปิดรูปไม่ได้'));
    img.src = URL.createObjectURL(file);
  });
}
const blobToDataUrl = (b) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });

/** ผสมสีกับสีขาว (a = 0..1 ยิ่งมากยิ่งเข้ม) — ใช้ทำสีตารางตามสีโปรไฟล์ */
const tint = (hex, a) => { const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16); const m = (v) => Math.round(255 - (255 - v) * a).toString(16).padStart(2, '0'); return '#' + m(n >> 16) + m((n >> 8) & 255) + m(n & 255); };
