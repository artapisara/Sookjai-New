/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — สมาชิก Premium: Free Package vs Premium + ตัวล็อกฟีเจอร์ + ทดลอง 1 เดือน
 * สถานะอยู่ที่ตาราง subscriptions (premium_until) และสวิตช์ app_flags.paywall_enabled — รัน supabase/premium.sql
 * ค่าเริ่มต้น: สวิตช์ปิด = ทุกคนใช้ได้ครบ (ยังไม่เปิดขาย) · ผู้ใช้แก้สถานะเองไม่ได้ (เขียนได้เฉพาะฝั่งเซิร์ฟเวอร์)
 * กฎความปลอดภัย: หมดสมาชิกแล้ว ข้อมูลเดิมยังเห็นและติ๊กกินยาได้ · ติดตามอาการ: ดูประวัติและบันทึกต่อในแผนเดิมได้ แต่สร้างแผนใหม่ไม่ได้
 */
'use strict';

/** โควตา Free (ค่าจริงอยู่ที่ js/limits.js + ตาราง app_limits) — คีย์สั้นที่ใช้ในหน้าจอ */
const FREE_LIMITS = {
  get profiles() { return LIMITS.FREE_MAX_CARED_PEOPLE; }, get circles() { return LIMITS.FREE_MAX_GROUPS; },
  get meds() { return LIMITS.FREE_MAX_MEDS_PER_PROFILE; }, get appts() { return LIMITS.FREE_MAX_APPOINTMENTS_PER_PROFILE; }, get members() { return LIMITS.FREE_MAX_GROUP_MEMBERS; },
  carePlans: 1, adherenceDays: 7, healthDays: 7,
};
const entState = () => (typeof S !== 'undefined' && S && S.ent) || { paywall: false, premium_until: null, trial_used: false };
/** ENFORCE_LIMITS: เปิดสวิตช์การจำกัดหรือยัง (ปิด = ช่วงทดลอง ไม่บล็อกอะไร แต่ยังแสดงตัวนับ) */
const paywallOn = () => !!entState().paywall;
const premiumActive = () => { const u = entState().premium_until; return !!u && new Date(u).getTime() > Date.now(); };
/** เป็น Premium ในแง่ "ถูกบล็อกไหม": ช่วงทดลอง (สวิตช์ปิด) = ผ่านทุกอย่าง */
const isPremium = () => !paywallOn() || premiumActive();

/** เตือนกินยาและนัดพบแพทย์: ทุกโปรไฟล์ที่เราเป็นเจ้าของและเปิดสวิตช์ ทุกแพ็กเกจ (Free มีได้ ตัวคุณ + คนที่ดูแล 1 คน) — ต้องตรงกับ send-reminders
 * โปรไฟล์ที่แชร์มาจากคนอื่น ไม่นับ (เจ้าของเป็นผู้ได้รับการเตือน) */
const apptReminderOn = (pid) => { const p = profileById(pid); return !p || p.appt_reminder !== false; }; // เปิด/ปิดรายคนที่ ตั้งค่า > การแจ้งเตือน (appt_reminder)
const reminderOn = (p) => !!p.reminder_enabled;
const myCircleIds = () => new Set((S.circles || []).filter((c) => c.user_id === DB.user?.id).map((c) => c.id));
const carePlanCount = () => (S.care_plans || []).filter((c) => !c.user_id || c.user_id === DB.user?.id).length;

// ---------- ตัวนับโควตา (นับจากข้อมูลที่แอพโหลดมา) ----------
/** คนที่ฉันดูแล = โปรไฟล์ที่เป็นของเรา ไม่ใช่ "ของฉัน" (โปรไฟล์ที่แชร์มาให้ไม่นับ) */
const caredProfiles = () => (S.profiles || []).filter((p) => ownsProfile(p.id) && !isSelfProfile(p));
const activeMedCount = (pid, exceptId) => (S.medications || []).filter((m) => m.profile_id === pid && m.status === 'active' && m.id !== exceptId).length;
const apptCount = (pid) => (S.appointments || []).filter((a) => a.profile_id === pid).length;
const myGroupCount = () => (S.circles || []).filter((c) => c.user_id === DB.user?.id).length;
/** สมาชิกในกลุ่ม (ไม่รวมเจ้าของ) + คำเชิญที่รอ */
const groupMemberCount = (cid) => (S.circle_members || []).filter((m) => m.circle_id === cid && m.user_id !== DB.user?.id).length + (S.circle_invites || []).filter((i) => i.circle_id === cid).length;

/** ใช้ฟีเจอร์/เพิ่มของนี้ได้ไหม (ฝั่งแอพ — ฐานข้อมูลบังคับซ้ำอีกชั้นด้วย trigger ตามแพ็กเกจของ "เจ้าของ")
 *  kind: profiles | circles | meds {pid, exceptId} | appts {pid} | members {cid} | care | sticker {pid} | report {pid} | pdf · ข้อมูลของคนอื่นที่แชร์มา: ให้ฐานข้อมูลตัดสินตามแพ็กเกจของเจ้าของ */
function canUse(kind, ctx) {
  switch (kind) {
    case 'pdf': return true; // ตารางกินยา PDF (1 วัน): ทุกคนที่เข้าถึงโปรไฟล์โหลดได้ — เป็นฟีเจอร์ Free
    case 'sticker': case 'report': return !!ctx?.pid && ownsProfile(ctx.pid) && isPremium(); // ไฟล์ Premium: โหลดได้เฉพาะ "เจ้าของโปรไฟล์" ที่เป็น Premium (แบบ Canva)
  }
  if (isPremium()) return true;
  switch (kind) {
    case 'profiles': return caredProfiles().length < FREE_LIMITS.profiles;
    case 'circles': return myGroupCount() < FREE_LIMITS.circles;
    case 'meds': return !ownsProfile(ctx?.pid) || activeMedCount(ctx.pid, ctx.exceptId) < FREE_LIMITS.meds;
    case 'appts': return !ownsProfile(ctx?.pid) || apptCount(ctx.pid) < FREE_LIMITS.appts;
    case 'members': return groupMemberCount(ctx?.cid) < FREE_LIMITS.members;
    case 'care': return carePlanCount() < FREE_LIMITS.carePlans;
    default: return false;
  }
}

const PREMIUM_WHY = {
  profiles: `ดูแลได้ ${FREE_LIMITS.profiles} คนในแพ็กเกจฟรี อัปเกรดเพื่อดูแลพ่อ แม่ ปู่ ย่า ได้ในบัญชีเดียว`,
  circles: `สร้างกลุ่มผู้ดูแลได้ ${FREE_LIMITS.circles} กลุ่มในแพ็กเกจฟรี อัปเกรดเพื่อสร้างกลุ่มเพิ่มได้ไม่จำกัด`,
  meds: `ใส่ยาครบ ${FREE_LIMITS.meds} ตัวแล้ว อัปเกรดเพื่อใส่ได้ไม่จำกัด`,
  appts: `เก็บใบนัดครบ ${FREE_LIMITS.appts} ใบแล้ว ลบใบเก่าเพื่อเพิ่มใหม่ ข้อมูลที่ลบจะหายถาวร หรืออัปเกรด Premium เพื่อเก็บไว้ทั้งหมด`,
  members: `เชิญสมาชิกได้ ${FREE_LIMITS.members} คนต่อกลุ่มในแพ็กเกจฟรี อัปเกรดเพื่อเชิญได้ไม่จำกัด`,
  care: `Free Package สร้างแผนติดตามอาการได้ ${FREE_LIMITS.carePlans} แผน (แผนที่มีอยู่ ดูประวัติและบันทึกต่อได้)`,
  pdf: 'ไฟล์นี้สำหรับสมาชิก Premium',
  sticker: 'สติกเกอร์ติดกล่องยา (PDF) ดาวน์โหลดได้เฉพาะเจ้าของโปรไฟล์ที่เป็น Premium',
  summary: `Free Package ดูสรุปการกินยาได้ ${FREE_LIMITS.adherenceDays} วันล่าสุด · ย้อนหลังและกราฟรายเดือนสำหรับ Premium`,
  health: `Free Package ดูบันทึกความดัน/น้ำตาลได้ ${FREE_LIMITS.healthDays} วันล่าสุด · กราฟและย้อนหลังทั้งหมดสำหรับ Premium`,
  report: 'รายงานก่อนพบแพทย์ (รวมแพ้ยา ยาที่เกี่ยวกับแผนกนั้น และผลการพบแพทย์ครั้งก่อนเป็น PDF ฉบับเดียว) ดาวน์โหลดได้เฉพาะเจ้าของโปรไฟล์ที่เป็น Premium',
  mood: 'บันทึกอารมณ์รายวันและสรุปอารมณ์ 1 เดือน เป็นฟีเจอร์สำหรับ Premium Package',
  history: 'ประวัติการรักษา (ดึงข้อมูลจากติดตามอาการและใบนัด) ดูได้เฉพาะสมาชิก Premium',
};
const PREMIUM_PERKS = ['ดูแลได้ไม่จำกัดคน · สร้างกลุ่มและเชิญผู้ช่วยดูแลได้ไม่จำกัด', 'ใส่ยาได้ไม่จำกัด · เก็บใบนัดได้ไม่จำกัด', 'แจ้งผู้ช่วยดูแลเมื่อยังไม่มีบันทึกการกินยา · เตือนยาใกล้หมด', 'สติกเกอร์ติดกล่องยา · รายงานก่อนพบแพทย์ (PDF) สำหรับเจ้าของโปรไฟล์', 'บันทึกความดัน/น้ำตาลพร้อมกราฟแนวโน้ม · ประวัติการรักษา', 'ติดตามอาการได้ไม่จำกัด · สรุปการกินยาย้อนหลัง', 'บันทึกและสรุปอารมณ์', 'ไม่มีโฆษณา'];

/** หน้าต่างสั้นเมื่อเต็มโควตา — ซ้อนทับหน้าที่เปิดอยู่ (ไม่ปิดฟอร์ม จึงไม่เสียข้อมูลที่กำลังกรอก) · "ดู Premium" เปิดหน้ารายละเอียดแพ็กเกจ */
function limitDialog(kind, { extra = '', primary = null } = {}) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'ask-ov';
    ov.innerHTML = `<div class="ask-box" role="alertdialog" aria-modal="true"><div class="ask-ic">⭐</div><p class="ask-msg">${esc(PREMIUM_WHY[kind] || 'ฟีเจอร์นี้สำหรับสมาชิก Premium')}${extra}</p>
      <div class="ask-btns lim-btns">${primary ? `<button type="button" class="btn ghost" data-v="primary">${esc(primary)}</button>` : ''}<button type="button" class="btn" data-v="prem">ดู Premium</button><button type="button" class="btn ghost" data-v="no">${primary ? 'ยกเลิก' : 'ไว้ก่อน'}</button></div></div>`;
    const done = (v) => { ov.remove(); resolve(v); };
    ov.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v); else if (e.target === ov) done('no'); });
    document.body.appendChild(ov); ov.querySelector('[data-v="no"]').focus();
  }).then((v) => { if (v === 'prem') premiumSheet(kind); return v; });
}

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
/** ปุ่มไฟล์ Premium ที่ล็อกสำหรับคนที่ไม่ใช่เจ้าของโปรไฟล์ — ห้ามขึ้นข้อความชวนสมัคร Premium ให้คนที่ไม่ใช่เจ้าของ */
const lockedOwnerBtn = (label) => `<button type="button" class="btn ghost owner-lock" disabled aria-disabled="true"><span class="ol-t">🔒 ${label}</span><small>ให้เจ้าของโปรไฟล์เป็นคนดาวน์โหลด</small></button>`;
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

// ตารางเทียบแพ็กเกจ 2 คอลัมน์ (true = ✔ มี · false = ✘ ไม่มี · ข้อความ = ระบุจำนวน) — ตัวเลขอ่านจากโควตากลาง (js/limits.js) ไม่ฝังตัวเลข
const planRows = () => [
  { group: '👨‍👩‍👧 โปรไฟล์และกลุ่มผู้ดูแล' },
  ['โปรไฟล์ของฉัน', '1', '1'], ['คนที่ฉันดูแล', `${FREE_LIMITS.profiles} คน`, 'ไม่จำกัด'],
  ['กลุ่มผู้ดูแล', `${FREE_LIMITS.circles} กลุ่ม`, 'ไม่จำกัด'], ['คนที่ถูกเชิญเข้ากลุ่ม', `สูงสุด ${FREE_LIMITS.members} คน`, 'ไม่จำกัด'],
  { group: '💊 ยา' },
  ['ยาต่อโปรไฟล์ (ที่กำลังทาน)', `${FREE_LIMITS.meds} ตัว`, 'ไม่จำกัด'], ['จัดตารางกินยาอัตโนมัติ', true, true], ['สรุปการกินยา', `${FREE_LIMITS.adherenceDays} วันล่าสุด`, 'ย้อนหลัง + กราฟรายเดือน'],
  ['ตารางกินยา PDF (1 วัน)', true, true], ['สติกเกอร์ติดกล่องยา (PDF)', false, true],
  { group: '🔔 การแจ้งเตือน' },
  ['เตือนกินยา / เตือนนัดหมอ', true, true], ['ปุ่ม "กินแล้ว / เตือนอีก 15 นาที"', true, true],
  ['เตือนยาใกล้หมด', false, true], ['แจ้งผู้ช่วยดูแลเมื่อยังไม่มีบันทึกการกินยา', false, true],
  { group: '📅 นัดพบแพทย์' },
  ['ใบนัดหมอที่เก็บอยู่ต่อโปรไฟล์', `${FREE_LIMITS.appts} ใบ`, 'ไม่จำกัด'], ['หน้า "สรุปก่อนพบแพทย์" บนหน้าจอ', true, true], ['รายงานก่อนพบแพทย์ (ดาวน์โหลด PDF)', false, true], ['ประวัติการรักษา', false, true],
  { group: '🩹 ติดตามอาการ' },
  ['แผนติดตามอาการ (ถ่ายรูปแผล เทียบอาการ)', `${FREE_LIMITS.carePlans} แผน`, 'ไม่จำกัด'],
  { group: '❤️ ความดัน / น้ำตาลในเลือด' },
  ['บันทึกค่าที่วัดได้', true, true], ['ดูย้อนหลัง', `${FREE_LIMITS.healthDays} วันล่าสุด`, 'ทั้งหมด'], ['กราฟแนวโน้ม', false, true],
  { group: '😊 อารมณ์' },
  ['บันทึกอารมณ์รายวัน', false, true], ['สรุปอารมณ์ 1 เดือน', false, true],
  { group: '✨ อื่นๆ' },
  ['โหมดตัวอักษรใหญ่', true, true], ['ไม่มีโฆษณา', false, true],
];
const planCell = (v) => (v === true ? '<span class="yes" aria-label="มี">✔</span>' : v === false ? '<span class="no" aria-label="ไม่มี">–</span>' : esc(v));
/** ตารางเทียบแพ็กเกจ แยกเป็นกรอบตามหมวดหมู่ (หัวคอลัมน์ Free/Premium อยู่บนสุด) + การ์ด "ถูกเชิญเข้ากลุ่ม?" */
function planTableHtml() {
  const boxes = []; let cur = null;
  for (const r of planRows()) {
    if (r.group) { cur = { title: r.group, rows: [] }; boxes.push(cur); } else if (cur) cur.rows.push(r);
  }
  const head = `<div class="plan-sum"><b>Free: ตัวคุณ + คนที่ดูแล ${FREE_LIMITS.profiles} คน · ใส่ยาคนละ ${FREE_LIMITS.meds} ตัว · เก็บใบนัดคนละ ${FREE_LIMITS.appts} ใบ · Premium: ไม่จำกัด</b><small>โปรไฟล์ของฉัน และโปรไฟล์ที่มีคนแชร์มาให้ ไม่นับเป็นคนที่ดูแล</small></div>`;
  const invited = `<section class="plan-box plan-invited"><h4>ถูกเชิญเข้ากลุ่ม?</h4><ol class="plan-inv"><li>ดู แก้ไข และแนบรูปได้ ตามแพ็กเกจของเจ้าของกลุ่ม</li><li>โหลดตารางกินยา PDF ได้</li><li>ไฟล์สติกเกอร์และรายงานก่อนพบแพทย์ เจ้าของโปรไฟล์เป็นคนดาวน์โหลด</li><li>โปรไฟล์ที่แชร์มาให้ ไม่นับเป็นโควตาของคุณ</li></ol></section>`;
  return `${head}<div class="plan-grid"><div class="plan-colhead"><span>ฟีเจอร์</span><span>Free Package</span><span class="prem">⭐ Premium Package</span></div>${boxes.map((b) => `<section class="plan-box"><h4>${b.title}</h4>${b.rows.map((r) => `<div class="plan-r"><span>${r[0]}</span><span>${planCell(r[1])}</span><span class="prem">${planCell(r[2])}</span></div>`).join('')}</section>`).join('')}</div>${invited}`;
}
/** ส่วน "แพ็กเกจของฉัน" ในหน้าตั้งค่า */
function membershipSection() {
  if (DB.mode !== 'supabase') return '';
  const e = entState(); const until = e.premium_until ? thDate(String(e.premium_until).slice(0, 10), 'long') : '';
  let status; let action = '';
  if (!paywallOn()) status = 'ช่วงทดลอง: ใช้ได้ทุกฟีเจอร์ฟรี<small class="muted" style="display:block">แพ็กเกจจริง (Free / Premium) จะเริ่มหลังช่วงทดลอง โดยแจ้งในแอพล่วงหน้าก่อนเริ่มใช้</small>';
  else if (premiumActive()) status = `⭐ Premium ถึงวันที่ ${until}`;
  else { status = e.premium_until ? `Premium หมดอายุเมื่อ ${until} · ใช้ Free Package` : 'Free Package'; action = `<button class="btn block" data-act="premium-info" data-id="care" style="margin-top:8px">${e.trial_used ? 'สมัคร Premium' : 'ทดลอง Premium 1 เดือน'}</button>`; }
  return `<h3 class="set-h">แพ็กเกจของฉัน</h3><div class="card set-group plan-card"><div class="set-row"><span class="sr-ic">⭐</span><span class="sr-l">${status}</span></div>${action}
    <details class="plan-det"><summary>ดูรายละเอียดแพ็กเกจ</summary>${planTableHtml()}</details></div>`;
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || typeof S === 'undefined' || !S) return;
  if (el.dataset.act === 'premium-info') premiumSheet(el.dataset.id);
});
