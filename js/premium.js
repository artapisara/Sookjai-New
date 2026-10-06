/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — สมาชิก Premium: Free Package vs Premium + ตัวล็อกฟีเจอร์ + ทดลอง 1 เดือน
 * สถานะอยู่ที่ตาราง subscriptions (premium_until) และสวิตช์ app_flags.paywall_enabled — รัน supabase/premium.sql
 * ค่าเริ่มต้น: สวิตช์ปิด = ทุกคนใช้ได้ครบ (ยังไม่เปิดขาย) · ผู้ใช้แก้สถานะเองไม่ได้ (เขียนได้เฉพาะฝั่งเซิร์ฟเวอร์)
 * กฎความปลอดภัย: หมดสมาชิกแล้ว ข้อมูลเดิมยังเห็นและติ๊กกินยาได้ · ติดตามอาการ: ดูประวัติและบันทึกต่อในแผนเดิมได้ แต่สร้างแผนใหม่ไม่ได้
 */
'use strict';

const FREE_LIMITS = { profiles: 1, circles: 1, editors: 1, slipAppts: 3, medReminders: 1, carePlans: 1, adherenceDays: 7, healthDays: 7 };
const entState = () => (typeof S !== 'undefined' && S && S.ent) || { paywall: false, premium_until: null, trial_used: false };
const paywallOn = () => !!entState().paywall;
const premiumActive = () => { const u = entState().premium_until; return !!u && new Date(u).getTime() > Date.now(); };
const isPremium = () => !paywallOn() || premiumActive();

/** เตือนกินยาและนัดพบแพทย์: Premium = ทุกคนที่เปิดสวิตช์ · Free = เฉพาะ 1 โปรไฟล์ของเรา (คนที่เปิดสวิตช์และสร้างก่อน) — ต้องตรงกับกติกาใน send-reminders (Free = 1 โปรไฟล์ ทั้งเตือนกินยาและเตือนนัดหมอ · ติดตามอาการสร้างแผนใหม่ได้เฉพาะ Premium)
 * โปรไฟล์ที่แชร์มาจากคนอื่น ไม่นับ (คนนั้นเป็นเจ้าของการเตือน) */
const reminderFirstId = () => (S.profiles || []).filter((p) => p.reminder_enabled && ownsProfile(p.id))
  .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id)))[0]?.id;
/** เตือนนัดหมอของโปรไฟล์นี้ได้ไหม (กติกาเดียวกับเตือนกินยา) */
const apptReminderOn = (pid) => { const p = profileById(pid); return !p || (p.appt_reminder !== false && (isPremium() || !ownsProfile(pid) || pid === reminderFirstId())); }; // เปิด/ปิดรายคนที่ ตั้งค่า > การแจ้งเตือน (appt_reminder) + กติกา Free
const reminderOn = (p) => !!p.reminder_enabled && (isPremium() || !ownsProfile(p.id) || p.id === reminderFirstId());
const myCircleIds = () => new Set((S.circles || []).filter((c) => c.user_id === DB.user?.id).map((c) => c.id));
/** ผู้ดูแลแบบ "แก้ไขได้" ในกลุ่มของเรา (คำเชิญที่รอ + สมาชิก) — แบบ "ดูอย่างเดียว" ไม่จำกัด เพราะเป็นทางที่แอพแพร่ไปถึงคนในครอบครัว */
const editorCount = (exceptMemberId) => { const ids = myCircleIds(); return (S.circle_invites || []).filter((i) => ids.has(i.circle_id) && i.role !== 'viewer').length + (S.circle_members || []).filter((m) => ids.has(m.circle_id) && m.user_id !== DB.user?.id && m.role !== 'viewer' && m.id !== exceptMemberId).length; };
const carePlanCount = () => (S.care_plans || []).filter((c) => !c.user_id || c.user_id === DB.user?.id).length;
const slipApptCount = (exceptId) => (S.appointments || []).filter((a) => a.id !== exceptId && a.user_id === DB.user?.id && (a.attachments || []).length > 0).length;

/** ใช้ฟีเจอร์นี้ได้ไหม (ฝั่งแอพ — ฐานข้อมูลบังคับซ้ำอีกชั้น) kind: profiles | invites | slips | care | pdf | summary */
function canUse(kind, ctx) {
  if (isPremium()) return true;
  switch (kind) {
    case 'profiles': return S.profiles.filter((p) => ownsProfile(p.id)).length < FREE_LIMITS.profiles;
    case 'circles': return (S.circles || []).filter((c) => c.user_id === DB.user?.id).length < FREE_LIMITS.circles;
    case 'invites': return ctx?.role === 'viewer' || editorCount(ctx?.memberId) < FREE_LIMITS.editors;
    case 'care': return carePlanCount() < FREE_LIMITS.carePlans;
    case 'reminders': return (S.profiles || []).filter((p) => p.id !== ctx?.id && ownsProfile(p.id) && reminderOn(p)).length < FREE_LIMITS.medReminders;
    case 'slips': return !!ctx?.has || slipApptCount(ctx?.id) < FREE_LIMITS.slipAppts;
    default: return false;
  }
}

const PREMIUM_WHY = {
  profiles: `Free Package เพิ่มคนในครอบครัวได้ ${FREE_LIMITS.profiles} คน`,
  circles: `Free Package สร้างกลุ่มผู้ดูแลได้ ${FREE_LIMITS.circles} กลุ่ม`,
  invites: `Free Package เชิญผู้ดูแลแบบ "แก้ไขได้" ได้ ${FREE_LIMITS.editors} คน (แบบ "ดูอย่างเดียว" เชิญได้ไม่จำกัด)`,
  reminders: `Free Package เปิดแจ้งเตือนการกินยาและนัดพบแพทย์ได้ ${FREE_LIMITS.medReminders} คน`,
  slips: `Free Package ใส่รูปในนัดพบแพทย์ได้ ${FREE_LIMITS.slipAppts} ครั้ง (ต่อบัญชี)`,
  care: `Free Package สร้างแผนติดตามอาการได้ ${FREE_LIMITS.carePlans} แผน (แผนที่มีอยู่ ดูประวัติและบันทึกต่อได้)`,
  pdf: 'ทำตารางยาเป็น PDF ได้เฉพาะสมาชิก Premium',
  summary: `Free Package ดูสรุปการกินยาได้ ${FREE_LIMITS.adherenceDays} วันล่าสุด · ย้อนหลังและกราฟรายเดือนสำหรับ Premium`,
  health: `Free Package ดูบันทึกความดัน/น้ำตาลได้ ${FREE_LIMITS.healthDays} วันล่าสุด · กราฟและย้อนหลังทั้งหมดสำหรับ Premium`,
  report: 'รายงานก่อนพบแพทย์ (รวมแพ้ยา ยาที่เกี่ยวกับแผนกนั้น และผลการพบแพทย์ครั้งก่อนเป็น PDF ฉบับเดียว) สำหรับสมาชิก Premium',
  mood: 'บันทึกอารมณ์รายวันและสรุปอารมณ์ 1 เดือน เป็นฟีเจอร์สำหรับ Premium Package',
  history: 'ประวัติการรักษา (ดึงข้อมูลจากติดตามอาการและใบนัด) ดูได้เฉพาะสมาชิก Premium',
};
const PREMIUM_PERKS = ['ดูแลได้ทั้งครอบครัว: เพิ่มคน สร้างกลุ่ม และเชิญผู้ดูแลได้ไม่จำกัด', 'เตือนกินยาและนัดพบแพทย์ได้ทุกคน', 'แจ้งผู้ดูแลเมื่อลืมกินยา', 'รายงานก่อนพบแพทย์ (PDF) · บันทึกความดัน/น้ำตาลพร้อมกราฟแนวโน้ม', 'ติดตามอาการได้ไม่จำกัด · ประวัติการรักษา', 'สรุปการกินยาย้อนหลัง · ตารางยาและสติกเกอร์ PDF', 'ใส่รูปใบนัดไม่จำกัด', 'บันทึกและสรุปอารมณ์', 'ไม่มีโฆษณา'];

function premiumSheet(kind) {
  const e = entState(); const offline = !!DB.offline;
  const sheet = openSheet(`<h3>⭐ ฟีเจอร์สำหรับสมาชิก Premium</h3>
    <p>${esc(PREMIUM_WHY[kind] || 'ฟีเจอร์นี้สำหรับสมาชิก Premium')}</p>
    <div class="card soft"><b>Premium ได้อะไรบ้าง</b><ul class="perks">${PREMIUM_PERKS.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <p class="small muted">ข้อมูลที่คุณกรอกไว้ทั้งหมดยังอยู่และดูได้ตามปกติ และติ๊กกินยาได้เสมอ ไม่ว่าจะเป็นสมาชิกหรือไม่</p>
    <div class="row sticky-actions"><button class="btn ghost" data-act="close">ไว้ก่อน</button>
      ${!e.trial_used ? `<button class="btn" id="trialGo" ${offline ? 'disabled' : ''}>ทดลอง Premium 1 เดือน</button>` : '<button class="btn" id="buyGo">สมัคร Premium</button>'}</div>`);
  const t = $('#trialGo', sheet); if (t) t.onclick = () => startTrial(t);
  const b = $('#buyGo', sheet); if (b) b.onclick = () => toast('ระบบสมัครสมาชิกกำลังพัฒนา เร็วๆ นี้');
}
function premiumPage(title, kind = 'summary', back = ['ยาและการดูแล', 'meds-go', 'hub']) {
  return `${backBar(...back)}<h1>${esc(title)}</h1>
    <div class="card empty"><div class="e">⭐</div><b>ฟีเจอร์สำหรับสมาชิก Premium</b><p class="small">${esc(PREMIUM_WHY[kind] || PREMIUM_WHY.summary)}</p>
      <button class="btn" data-act="premium-info" data-id="${kind}">ดูรายละเอียด Premium</button></div>`;
}

async function startTrial(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังเริ่ม…'; }
  try {
    const { error } = await DB.sb.rpc('start_trial');
    if (error) throw error;
    closeSheet(); toast('🎉 เริ่มทดลอง Premium 1 เดือนแล้ว'); await reload();
  } catch (e) {
    console.error(e);
    toast(/TRIAL_USED/.test(e.message || '') ? 'บัญชีนี้ใช้สิทธิ์ทดลองไปแล้ว' : 'เริ่มทดลองไม่สำเร็จ: ' + (e.message || 'ลองใหม่'));
    if (btn) { btn.disabled = false; btn.textContent = 'ทดลอง Premium 1 เดือน'; }
  }
}

// ตารางเทียบแพ็กเกจ (true = ✔ มี · false = ✘ ไม่มี · ข้อความ = ระบุจำนวน)
const PLAN_ROWS = [
  { group: '👨‍👩‍👧 ครอบครัวและกลุ่มผู้ดูแล' },
  ['เพิ่มคนในครอบครัว', `${FREE_LIMITS.profiles} คน`, 'ไม่จำกัด'], ['สร้างกลุ่มผู้ดูแล', `${FREE_LIMITS.circles} กลุ่ม`, 'ไม่จำกัด'],
  ['เชิญผู้ดูแล "แก้ไขได้"', `${FREE_LIMITS.editors} คน`, 'ไม่จำกัด'], ['เชิญผู้ดูแล "ดูอย่างเดียว"', 'ไม่จำกัด', 'ไม่จำกัด'],
  { group: '💊 ยา' },
  ['เพิ่มยา', 'ไม่จำกัด', 'ไม่จำกัด'], ['ตารางกินยาอัตโนมัติ', true, true], ['สรุปการกินยา', `${FREE_LIMITS.adherenceDays} วันล่าสุด`, 'ย้อนหลัง + กราฟรายเดือน'], ['ตารางยา / สติกเกอร์ (PDF)', false, true],
  { group: '🔔 การแจ้งเตือน' },
  ['เตือนกินยา', `${FREE_LIMITS.medReminders} คน`, 'ไม่จำกัด'], ['เตือนนัดพบแพทย์', `${FREE_LIMITS.medReminders} คน`, 'ไม่จำกัด'], ['ปุ่ม "กินแล้ว / เตือนอีก 15 นาที"', true, true],
  ['เตือนยาใกล้หมด', false, true], ['แจ้งผู้ดูแลเมื่อลืมกินยา', false, true],
  { group: '📅 นัดพบแพทย์' },
  ['ใส่รูปใบนัด', `${FREE_LIMITS.slipAppts} ครั้ง`, 'ไม่จำกัด'], ['ประวัติการรักษา', false, true], ['รายงานก่อนพบแพทย์ (PDF)', false, true],
  { group: '🩹 ติดตามอาการ' },
  ['แผนติดตามอาการ (ถ่ายรูปแผล เทียบอาการ)', `${FREE_LIMITS.carePlans} แผน`, 'ไม่จำกัด'],
  { group: '❤️ ความดัน / น้ำตาลในเลือด' },
  ['บันทึกค่าที่วัดได้', true, true], ['ดูย้อนหลัง', `${FREE_LIMITS.healthDays} วันล่าสุด`, 'ทั้งหมด'], ['กราฟแนวโน้ม', false, true],
  { group: '😊 อารมณ์' },
  ['บันทึกอารมณ์รายวัน', false, true], ['สรุปอารมณ์ 1 เดือน', false, true],
  { group: '✨ อื่นๆ' },
  ['โหมดตัวอักษรใหญ่', true, true], ['ไม่มีโฆษณา', false, true],
];const planCell = (v) => (v === true ? '<span class="yes" aria-label="มี">✔</span>' : v === false ? '<span class="no" aria-label="ไม่มี">–</span>' : esc(v));
/** ตารางเทียบแพ็กเกจ แยกเป็นกรอบตามหมวดหมู่ (หัวคอลัมน์ Free/Premium อยู่บนสุด) */
function planTableHtml() {
  const boxes = []; let cur = null;
  for (const r of PLAN_ROWS) {
    if (r.group) { cur = { title: r.group, rows: [] }; boxes.push(cur); } else if (cur) cur.rows.push(r);
  }
  return `<div class="plan-grid"><div class="plan-colhead"><span>ฟีเจอร์</span><span>Free Package</span><span class="prem">⭐ Premium Package</span></div>${boxes.map((b) => `<section class="plan-box"><h4>${b.title}</h4>${b.rows.map((r) => `<div class="plan-r"><span>${r[0]}</span><span>${planCell(r[1])}</span><span class="prem">${planCell(r[2])}</span></div>`).join('')}</section>`).join('')}</div>`;
}/** ส่วน "แพ็กเกจของฉัน" ในหน้าตั้งค่า */
function membershipSection() {
  if (DB.mode !== 'supabase') return '';
  const e = entState(); const until = e.premium_until ? thDate(String(e.premium_until).slice(0, 10), 'long') : '';
  let status; let action = '';
  if (!paywallOn()) status = 'ใช้ Free ทุกฟีเจอร์ สำหรับช่วงพัฒนาแอพ';
  else if (premiumActive()) status = `⭐ Premium ถึงวันที่ ${until}`;
  else { status = e.premium_until ? `Premium หมดอายุเมื่อ ${until} · ใช้ Free Package` : 'Free Package'; action = `<button class="btn block" data-act="premium-info" data-id="care" style="margin-top:8px">${e.trial_used ? 'สมัคร Premium' : 'ทดลอง Premium 1 เดือน'}</button>`; }
  return `<h3 class="set-h">แพ็กเกจของฉัน</h3><div class="card set-group plan-card"><div class="set-row"><span class="sr-ic">⭐</span><span class="sr-l">${status}</span></div>${action}
    <details class="plan-det"><summary>ดูรายละเอียดแพ็กเกจ</summary>${planTableHtml()}</details></div>`;
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || typeof S === 'undefined' || !S) return;
  if (el.dataset.act === 'premium-info') premiumSheet(el.dataset.id);
});
