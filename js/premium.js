/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — สมาชิก Premium: Free Package vs Premium + ตัวล็อกฟีเจอร์ + ทดลอง 1 เดือน
 * สถานะอยู่ที่ตาราง subscriptions (premium_until) และสวิตช์ app_flags.paywall_enabled — รัน supabase/premium.sql
 * ค่าเริ่มต้น: สวิตช์ปิด = ทุกคนใช้ได้ครบ (ยังไม่เปิดขาย) · ผู้ใช้แก้สถานะเองไม่ได้ (เขียนได้เฉพาะฝั่งเซิร์ฟเวอร์)
 * กฎความปลอดภัย: หมดสมาชิกแล้ว ข้อมูลเดิมยังเห็นและติ๊กกินยาได้ · ติดตามอาการ: ดูประวัติและบันทึกต่อในแผนเดิมได้ แต่สร้างแผนใหม่ไม่ได้
 */
'use strict';

const FREE_LIMITS = { profiles: 2, circles: 1, invites: 1, slipAppts: 3 };
const entState = () => (typeof S !== 'undefined' && S && S.ent) || { paywall: false, premium_until: null, trial_used: false };
const paywallOn = () => !!entState().paywall;
const premiumActive = () => { const u = entState().premium_until; return !!u && new Date(u).getTime() > Date.now(); };
const isPremium = () => !paywallOn() || premiumActive();

const myCircleIds = () => new Set((S.circles || []).filter((c) => c.user_id === DB.user?.id).map((c) => c.id));
const inviteCount = () => { const ids = myCircleIds(); return (S.circle_invites || []).filter((i) => ids.has(i.circle_id)).length + (S.circle_members || []).filter((m) => ids.has(m.circle_id) && m.user_id !== DB.user?.id).length; };
const slipApptCount = (exceptId) => (S.appointments || []).filter((a) => a.id !== exceptId && a.user_id === DB.user?.id && (a.attachments || []).length > 0).length;

/** ใช้ฟีเจอร์นี้ได้ไหม (ฝั่งแอพ — ฐานข้อมูลบังคับซ้ำอีกชั้น) kind: profiles | invites | slips | care | pdf | summary */
function canUse(kind, ctx) {
  if (isPremium()) return true;
  switch (kind) {
    case 'profiles': return S.profiles.filter((p) => ownsProfile(p.id)).length < FREE_LIMITS.profiles;
    case 'circles': return (S.circles || []).filter((c) => c.user_id === DB.user?.id).length < FREE_LIMITS.circles;
    case 'invites': return inviteCount() < FREE_LIMITS.invites;
    case 'slips': return !!ctx?.has || slipApptCount(ctx?.id) < FREE_LIMITS.slipAppts;
    default: return false;
  }
}

const PREMIUM_WHY = {
  profiles: `Free Package สร้างโปรไฟล์สมาชิกได้ ${FREE_LIMITS.profiles} คน`,
  circles: `Free Package สร้างกลุ่มผู้ดูแลได้ ${FREE_LIMITS.circles} กลุ่ม`,
  invites: `Free Package เชิญสมาชิกเข้ากลุ่มผู้ดูแลได้ ${FREE_LIMITS.invites} คน`,
  slips: `Free Package ใส่รูปในนัดพบแพทย์ได้ ${FREE_LIMITS.slipAppts} ครั้ง (ต่อบัญชี)`,
  care: 'สร้างแผนติดตามอาการใหม่ได้เฉพาะสมาชิก Premium (แผนที่มีอยู่ ดูประวัติและบันทึกต่อได้)',
  pdf: 'ดาวน์โหลดตารางยาเป็น PDF ได้เฉพาะสมาชิก Premium',
  summary: 'สรุปการกินยารายเดือนดูได้เฉพาะสมาชิก Premium',
  mood: 'สรุปอารมณ์ 1 เดือนดูได้เฉพาะ Premium Package (บันทึกอารมณ์รายวันใช้ได้ฟรี)',
  history: 'ประวัติการรักษา (ดึงข้อมูลจากติดตามอาการและใบนัด) ดูได้เฉพาะสมาชิก Premium',
};
const PREMIUM_PERKS = ['สร้างโปรไฟล์สมาชิก กลุ่มผู้ดูแล และเชิญผู้ดูแลได้ไม่จำกัด', 'ใส่รูปในนัดพบแพทย์ได้ไม่จำกัด', 'ติดตามอาการ (ถ่ายรูปแผล เทียบอาการ)', 'ประวัติการรักษา', 'ดาวน์โหลดตารางยาเป็น PDF', 'สรุปการกินยารายเดือน', 'สรุปอารมณ์ 1 เดือน', 'ไม่มีโฆษณา'];

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
  ['สร้างโปรไฟล์สมาชิก', `${FREE_LIMITS.profiles} คน`, 'ไม่จำกัด'], ['สร้างกลุ่มผู้ดูแล', `${FREE_LIMITS.circles} กลุ่ม`, 'ไม่จำกัด'], ['เชิญผู้ดูแล', `${FREE_LIMITS.invites} คน`, 'ไม่จำกัด'],
  { group: 'ยาที่ต้องทาน' }, ['เพิ่มได้ไม่จำกัด', true, true, 1], ['แสดงผลเป็นตารางอัตโนมัติ', true, true, 1], ['แจ้งเตือนการกินยา', true, true, 1],
  ['นัดพบแพทย์ · ใส่รูปได้', `${FREE_LIMITS.slipAppts} ครั้ง`, 'ไม่จำกัด'], ['ติดตามอาการ', false, true], ['ประวัติการรักษา', false, true],
  ['ติดตามอารมณ์รายวัน', true, true], ['สรุปอารมณ์ 1 เดือน', false, true], ['สรุปการกินยา 1 เดือน', false, true], ['ดาวน์โหลดตารางยา PDF', false, true], ['ไม่มีโฆษณา', false, true],
];
const planCell = (v) => (v === true ? '<span class="yes" aria-label="มี">✔</span>' : v === false ? '<span class="no" aria-label="ไม่มี">–</span>' : esc(v));
/** ส่วน "แพ็กเกจของฉัน" ในหน้าตั้งค่า */
function membershipSection() {
  if (DB.mode !== 'supabase') return '';
  const e = entState(); const until = e.premium_until ? thDate(String(e.premium_until).slice(0, 10), 'long') : '';
  let status; let action = '';
  if (!paywallOn()) status = 'ตอนนี้ทุกฟีเจอร์ใช้ได้ฟรี (ยังไม่เปิดระบบสมาชิก)';
  else if (premiumActive()) status = `⭐ Premium ถึงวันที่ ${until}`;
  else { status = e.premium_until ? `Premium หมดอายุเมื่อ ${until} · ใช้ Free Package` : 'Free Package'; action = `<button class="btn block" data-act="premium-info" data-id="care" style="margin-top:8px">${e.trial_used ? 'สมัคร Premium' : 'ทดลอง Premium 1 เดือน'}</button>`; }
  return `<h3 class="set-h">แพ็กเกจของฉัน</h3><div class="card set-group"><div class="set-row"><span class="sr-ic">⭐</span><span class="sr-l">${status}</span></div>${action}
    <table class="plan-tbl"><thead><tr><th>ฟีเจอร์</th><th>Free Package</th><th class="prem">⭐ Premium Package</th></tr></thead><tbody>${PLAN_ROWS.map((r) => (r.group ? `<tr class="grp"><td colspan="3">${r.group}</td></tr>` : `<tr><td class="${r[3] ? 'psub' : ''}">${r[0]}</td><td>${planCell(r[1])}</td><td class="prem">${planCell(r[2])}</td></tr>`)).join('')}</tbody></table></div>`;
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || typeof S === 'undefined' || !S) return;
  if (el.dataset.act === 'premium-info') premiumSheet(el.dataset.id);
});
