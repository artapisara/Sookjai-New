/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ v1.2 — หน้าจอตามดีไซน์ใหม่: ภาพรวมวันนี้ · เมนูยา · สรุปการกินยา/อารมณ์ (ดูย้อนหลังได้) · สมาชิก · ตั้งค่า */
'use strict';

const APP_VERSION = '1.3.46';
// โลโก้: ขวดยาสี 4 สีหลัก (เขียว มิ้นต์ ส้ม เหลือง) วาดเป็น SVG — ขยับด้วย CSS (ปิดอัตโนมัติถ้าผู้ใช้ตั้งลดการเคลื่อนไหว)
const LOGO_MARK = '<g class="lg-bottle"><path class="lg-star s1" d="M98 24l2.6 6.4 6.4 2.6-6.4 2.6L98 42l-2.6-6.4L89 33l6.4-2.6z" fill="#fff"/><path class="lg-star s2" d="M20 38l1.9 4.6 4.6 1.9-4.6 1.9L20 51l-1.9-4.6-4.6-1.9 4.6-1.9z" fill="#fff"/><rect x="39" y="12" width="42" height="20" rx="6" fill="#DAFF3A"/><rect x="39" y="20" width="42" height="5" fill="#4D55F5"/><rect x="45" y="31" width="30" height="9" rx="2" fill="#fff"/><rect class="lg-body" x="26" y="38" width="68" height="72" rx="18" fill="#fff"/><path d="M26 76q17-9 34 0t34 0v16q0 18-18 18H44q-18 0-18-18z" fill="#CA7FFE"/><rect x="32" y="46" width="5" height="30" rx="2.5" fill="#DDE0FF"/><g class="lg-cross"><rect x="53" y="46" width="14" height="34" rx="4" fill="#4D55F5"/><rect x="43" y="56" width="34" height="14" rx="4" fill="#4D55F5"/></g></g>';
const logoSvg = () => `<svg viewBox="0 0 120 120" aria-hidden="true">${LOGO_MARK}</svg>`;
/** ชื่อหน้าตามสถานะ (ใช้เขียนบนปุ่มย้อนกลับ) */
function pageTitle(s) {
  if (!s) return '';
  if (s.tab === 'today') return s.todayPage === 'mood' ? 'สรุปอารมณ์' : 'ภาพรวมวันนี้';
  if (s.tab === 'meds') return { hub: 'ยาและการดูแล', list: 'ยาที่ต้องทาน', care: 'บันทึกติดตามการรักษา', summary: 'สรุปการกินยา', health: 'ความดัน / น้ำตาล', history: 'บันทึกการไปหาหมอ', stock: 'จำนวนยาที่เหลือ' }[s.medsPage] || 'ยา';
  if (s.tab === 'calendar') return 'นัดพบหมอ';
  if (s.tab === 'family') return s.memberPage && S.profiles.some((p) => p.id === s.memberPage) ? `ข้อมูลของ${profileById(s.memberPage).name}` : 'สมาชิก';
  return s.tab === 'settings' ? 'ตั้งค่า' : '';
}
/** ปุ่มย้อนกลับ: กลับไปหน้าที่เพิ่งมาจากจริงๆ (ถ้าไม่มี ใช้หน้าแม่ตามที่กำหนด) */
const backBar = (label, act, id = '') => {
  const prev = navPrevSnap(); const to = prev ? pageTitle(prev) : label;
  return `<button type="button" class="back-bar" data-act="nav-back" data-to="${act}" data-id="${id}" aria-label="ย้อนกลับไปหน้า ${esc(to)}"><span class="bb-arrow">←</span><span class="bb-txt"><b>ย้อนกลับ</b><small>ไปหน้า ${esc(to)}</small></span></button>`;
};

// ---------- ล็อกการลบ (กันมือลั่น): ล็อกไว้เสมอตอนเปิดแอป ปลดล็อกได้ครั้งละ 2 นาที แล้วล็อกกลับเอง ----------
const delLocked = () => !(ui.delUnlockUntil && Date.now() < ui.delUnlockUntil);
let delTimer = null;
function lockToggle() {
  const lk = delLocked();
  return `<button type="button" class="lock-toggle ${lk ? 'on' : 'off'}" data-act="toggle-dellock" aria-pressed="${lk}">
    <span class="lt-ic">${lk ? SHIELD_ON : SHIELD_OFF}</span><span class="lt-tx"><b>ป้องกันแก้ไขข้อมูล</b><small class="lt-st"><i>${lk ? 'เปิดอยู่' : 'ปิดอยู่'}</i><span>${lk ? 'แตะเพื่อปิดชั่วคราว' : 'เปิดกลับเองใน 2 นาที'}</span></small></span></button>`;
}
// ไอคอนโล่แบบเส้นเรียบ (วาดเอง): มีเครื่องหมายถูก = เปิดอยู่ · โล่เปล่า = ปิดอยู่
const SHIELD_ON = '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7.5 2.8v5.6c0 4.6-3.1 8.1-7.5 9.6-4.4-1.5-7.5-5-7.5-9.6V5.8L12 3z"/><path d="M8.7 12.2l2.3 2.3 4.4-4.6"/></svg>';
const SHIELD_OFF = '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7.5 2.8v5.6c0 4.6-3.1 8.1-7.5 9.6-4.4-1.5-7.5-5-7.5-9.6V5.8L12 3z" stroke-dasharray="3 3"/></svg>';
// เข้าหน้าใหม่ทุกครั้ง = ล็อกกลับเป็นค่าเริ่มต้นเสมอ (เปลี่ยนคน/เลื่อนเดือนในหน้าเดิมไม่นับ)
let lockPageKey = null;
function relockOnPageChange() {
  const key = [ui.tab, ui.medsPage, ui.todayPage, ui.memberPage].join('|');
  if (lockPageKey !== null && key !== lockPageKey && !delLocked()) { clearTimeout(delTimer); ui.delUnlockUntil = 0; }
  lockPageKey = key;
}
function setDelLock(unlock) {
  clearTimeout(delTimer);
  if (unlock) { ui.delUnlockUntil = Date.now() + 120000; delTimer = setTimeout(() => { ui.delUnlockUntil = 0; refreshLockUi(); toast('เปิดการป้องกันลบกลับแล้ว'); }, 120000); toast('ปิดการป้องกันลบ 2 นาที'); }
  else { ui.delUnlockUntil = 0; toast('เปิดการป้องกันลบแล้ว'); }
  refreshLockUi();
}
function refreshLockUi() {
  const modal = document.getElementById('modal');
  if (modal && !modal.classList.contains('hidden') && ui.slipsPid && modal.querySelector('.lock-toggle')) { const y = modal.querySelector('.sheet')?.scrollTop || 0; slipsSheet(ui.slipsPid); const sh = document.querySelector('#modal .sheet'); if (sh) sh.scrollTop = y; }
  render();
}
// ---------- โหลดบันทึกย้อนหลังทีละเดือน (เดือนนี้โหลดมาแล้วตอนเปิดแอป) ----------
const loadedMonths = new Set(); const loadingMonths = new Set();
function resetMonths() { loadedMonths.clear(); }
/** คืน true ถ้ากำลังโหลดเดือนนี้อยู่ (หน้าจอควรแสดง "กำลังโหลด") */
function ensureMonth(ym) {
  if (DB.mode !== 'supabase' || ym >= ymOf(new Date()) || loadedMonths.has(ym)) return false;
  if (!loadingMonths.has(ym)) {
    loadingMonths.add(ym);
    DB.loadMonthLogs(ym).then((r) => {
      const merge = (key) => { const have = new Set(S[key].map((x) => x.id)); r[key].forEach((x) => { if (!have.has(x.id)) S[key].push(x); }); };
      merge('med_logs'); merge('mood_logs');
    }).catch((e) => { console.error(e); toast('โหลดข้อมูลย้อนหลังไม่สำเร็จ'); })
      .finally(() => { loadedMonths.add(ym); loadingMonths.delete(ym); render(); });
  }
  return true;
}

const praise = (pct) => (pct >= 90 ? { icon: '🌟', head: 'ยอดเยี่ยมมาก!', msg: 'มีวินัยสุดๆ กินยาครบแทบทุกมื้อ ทำต่อไปแบบนี้นะ' }
  : pct >= 70 ? { icon: '👍', head: 'ดีมากเลย!', msg: 'ทำได้ดีแล้ว อีกนิดเดียวก็ครบทุกมื้อ' }
  : { icon: '💛', head: 'ช่วงนี้ยังไม่ได้บันทึกการกิน', msg: 'ผู้ใหญ่อาจไม่ได้กดบันทึก ไม่ได้แปลว่าไม่ได้กินยา ลองกดติ๊กหลังกินยาทุกครั้งนะ' });

const monthNav = (ym, act) => `<div class="cal-nav"><button class="iconbtn" data-act="${act}" data-id="-1" ${ym <= minYm() ? 'disabled' : ''} aria-label="เดือนก่อน">‹</button>
  <b>${monthLabel(ym)}</b><button class="iconbtn" data-act="${act}" data-id="1" ${ym >= ymOf(new Date()) ? 'disabled' : ''} aria-label="เดือนถัดไป">›</button></div>`;

// ---------- แท็บวันนี้: ภาพรวมวันนี้ ----------
function personDay(pid) {
  let total = 0, done = 0;
  const left = new Set();
  medsOf(pid).forEach((m) => { if (m.as_needed || !dueToday(m)) return; m.slots.forEach((s) => { total++; if (takenLog(m.id, s)) done++; else left.add(s); }); });
  const h1 = new Date(Date.now() - 3600e3); const grace = `${pad(h1.getHours())}:${pad(h1.getMinutes())}`;
  const order = slotsByTime().filter((s) => left.has(s.key));
  const next = order.find((s) => slotTime(s.key) >= grace) || order[0];
  return { total, done, next };
}

function moodCard() {
  const me = selfProfile();
  if (!me) return `<div class="card mood-card"><b class="h-mood">วันนี้คุณเป็นยังไง?</b><p class="small muted" style="margin:0">บันทึกอารมณ์ได้เฉพาะ "ตัวฉัน" ของบัญชีนี้</p>
    <button class="btn block" data-act="add-self">+ เพิ่มข้อมูลของฉัน</button></div>`;
  if (!canUse('mood')) return `<div class="card mood-card mood-locked"><b class="h-mood">วันนี้คุณเป็นยังไง? <span class="tag sun">⭐ Premium</span></b>
    <div class="mood-pick mood-dim" aria-hidden="true">${MOODS.map((mo) => `<span class="mood-opt" style="--mc:${mo.color}"><i>${moodIcon(mo)}</i><b>${mo.label}</b></span>`).join('')}</div>
    <p class="small" style="margin:6px 0 10px">บันทึกอารมณ์รายวันและสรุปอารมณ์ 1 เดือน เป็นฟีเจอร์ของ Premium</p>
    <button class="btn block" data-act="premium-info" data-id="mood">ดูรายละเอียด Premium</button></div>`;
  const cur = moodLog(me.id);
  return `<div class="card mood-card"><b class="h-mood">วันนี้คุณเป็นยังไง?</b>
    <div class="mood-pick">${MOODS.map((mo) => `<button type="button" class="mood-opt ${cur?.mood === mo.k ? 'on' : ''}" data-act="mood-set" data-id="${mo.k}" style="--mc:${mo.color}" aria-pressed="${cur?.mood === mo.k}"><i>${moodIcon(mo)}</i><b>${mo.label}</b></button>`).join('')}</div>
    <button class="btn ghost block mood-sum-btn" data-act="mood-sum"><img class="mood-ic" src="assets/icons/mood-summary.gif" alt="" width="76" height="76" loading="lazy">สรุปอารมณ์ใน 1 เดือน</button></div>`;
}

async function setMood(k, date = todayKey()) {
  const me = selfProfile(); if (!me) return;
  if (!canUse('mood')) return premiumSheet('mood');
  const cur = moodLog(me.id, date); const mo = moodOf(k);
  if (cur) { Object.assign(cur, { mood: k }); render(); await dbDo(DB.update('mood_logs', cur.id, { mood: k })); }
  else { const row = { id: uuid(), profile_id: me.id, log_date: date, mood: k, note: '', created_at: new Date().toISOString() }; S.mood_logs = S.mood_logs || []; S.mood_logs.push(row); render(); await dbDo(DB.insert('mood_logs', row)); }
  toast(`บันทึกแล้ว: ${mo.label}`);
}
/** อารมณ์ย้อนหลัง: แตะวันที่ในปฏิทินอารมณ์ → เลือกอารมณ์ของวันนั้น (แก้ของเดิมต้องยืนยันก่อน) */
async function moodDaySheet(date) {
  const me = selfProfile(); if (!me || date > todayKey()) return;
  if (!canUse('mood')) return premiumSheet('mood');
  const cur = moodLog(me.id, date);
  if (cur && !(await askConfirm(`วันที่ ${thDate(date)} บันทึกไว้แล้วเป็น <b>${moodIcon(moodOf(cur.mood), 'xs')} ${moodOf(cur.mood).label}</b><br>ต้องการ <b>แก้ไข</b> ใช่หรือไม่?`, 'ใช่ แก้ไข'))) return;
  ui.moodDay = date;
  openSheet(`<h3>อารมณ์ของวันที่ ${thDate(date)}</h3>
    <div class="mood-pick">${MOODS.map((mo) => `<button type="button" class="mood-opt ${cur?.mood === mo.k ? 'on' : ''}" data-act="mood-set-day" data-id="${mo.k}" style="--mc:${mo.color}"><i>${moodIcon(mo)}</i><b>${mo.label}</b></button>`).join('')}</div>
    <div class="row sticky-actions"><button class="btn ghost" data-act="close">ปิด</button></div>`);
}

function viewToday() {
  if (ui.todayPage === 'mood') return canUse('mood') ? viewMoodSummary() : premiumPage('สรุปอารมณ์ 1 เดือน', 'mood', ['ภาพรวมวันนี้', 'today-go', 'home']);
  const shown = todayProfiles(); const ids = shown.map((p) => p.id);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  const rings = shown.map((p) => {
    const d = personDay(p.id); const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
    return `<button type="button" class="card ring-card" data-act="meds-open" data-id="${p.id}" style="--pc:${p.color}">
      ${ring(d.done, d.total)}
      <div class="rc-info"><div class="rc-name">${esc(p.name)}${selfProfile()?.id === p.id ? ' <span class="tag">ตัวคุณ</span>' : ''}</div>
        <div class="rc-line">${d.total ? `ต้องกิน ${d.total} ครั้งวันนี้ · กินแล้ว ${d.done}` : 'ยังไม่มียาในตาราง'}</div>
        <div class="small muted">${!d.total ? '' : d.done === d.total ? 'ครบแล้ววันนี้ เก่งมาก 🎉' : d.next ? `ช่วงถัดไป: ${esc(d.next.label)} ${slotTime(d.next.key)}` : `เหลืออีก ${d.total - d.done} ครั้ง`}</div></div>
      <span class="muted chev">›</span></button>`;
  }).join('');
  return `
    <header class="header"><img src="icon.svg" alt="" class="logo"><div><h1 class="gem-text today-brand">สุขใจ</h1><p class="sub ask">บันทึกยาเสร็จ สุขใจจัดตารางให้เลย!</p></div></header>
    ${'Notification' in window && Notification.permission === 'default' ? '<button class="alert sun" data-act="enable-push"><div class="ic">🔔</div><div><b>เปิดการแจ้งเตือนบนเครื่องนี้</b><span class="small">เตือนกินยา นัดหมอ และคำเชิญเข้ากลุ่ม · แตะเพื่อเปิด</span></div></button>' : ''}
    <h2 class="today-h">ภาพรวมวันนี้</h2>
    ${inviteAlerts()}
    ${S.profiles.length ? `<div class="tool-row"><button class="pill-btn" data-act="today-visibility">เลือกคนที่จะแสดง${todayHidden().filter((id) => S.profiles.some((p) => p.id === id)).length ? ` (ซ่อน ${todayHidden().filter((id) => S.profiles.some((p) => p.id === id)).length})` : ''}</button>
      ${S.profiles.length > 1 ? '<button class="pill-btn" data-act="reorder-people">↕️ จัดลำดับ</button>' : ''}</div>` : ''}
    ${rings || (S.profiles.length ? '<div class="card empty"><div class="e">👁️</div>ซ่อนทุกคนอยู่ — กด "เลือกคนที่จะแสดง" ด้านบน</div>' : '<div class="card empty"><div class="e">👨‍👩‍👧</div>เริ่มจากเพิ่มคนในครอบครัวก่อนนะ<br><button class="btn sm" data-act="add-person" style="margin-top:12px">+ เพิ่มคน</button></div>')}
    ${moodCard()}
  `;
}

// ---------- แท็บยา: เมนู 3 ไอคอน → ยาที่ต้องทาน / ติดตามการรักษา / สรุปการกินยา ----------
function viewMeds() {
  if (ui.medsPage === 'list') return viewMedList();
  if (ui.medsPage === 'care') return `${backBar('ยาและการดูแล', 'meds-go', 'hub')}${viewCare()}`;
  if (ui.medsPage === 'summary') return canUse('summary') ? viewAdherence() : viewAdherenceFree();
  if (ui.medsPage === 'history') return viewHistory();
  if (ui.medsPage === 'health') return viewHealth();
  if (ui.medsPage === 'stock') return viewStock();
  const tile = (go, ic, bg, title, sub, badge = 0, star = false) => `<button type="button" class="card tile" data-act="meds-go" data-id="${go}"><span class="tile-ic" style="background:${bg}">${ic}</span>
    <span class="tile-tx"><b>${title}${star ? ' <span class="tile-star" title="มีส่วนที่เป็น Premium" aria-label="มีส่วนที่เป็น Premium">⭐</span>' : ''}</b><small>${sub}</small></span>${badge ? `<span class="low-badge" role="img" aria-label="ยาใกล้หมด ${badge} ตัว"><i>!</i>${badge}</span>` : ''}<span class="muted chev">›</span></button>`;
  const lowN = S.medications.filter((m) => m.status === 'active' && S.profiles.some((p) => p.id === m.profile_id) && isLowStock(m)).length;
  return `<h1>ยาและการดูแล</h1><p class="sub">เลือกสิ่งที่ต้องการดู</p>
    ${tile('list', '<span class="mi" style="--ic:url(assets/icons/medicine.png)"></span>', 'var(--sky-soft)', 'ยาที่ต้องทาน', 'ตารางยาประจำวัน · เพิ่ม/แก้ยา')}
    ${tile('stock', '<span class="mi" style="--ic:url(assets/icons/stock.png)"></span>', 'var(--meadow)', 'จำนวนยาที่เหลือ', lowN ? `ยาใกล้หมด ${lowN} ตัว` : 'ดูว่ายาแต่ละตัวเหลือเท่าไร หมดเมื่อไร', lowN)}
    ${tile('summary', '<span class="mi" style="--ic:url(assets/icons/summary.png)"></span>', 'var(--pink-soft)', 'สรุปการกินยา', 'ดูว่ากินครบแค่ไหนในแต่ละวัน', 0, true)}
    ${tile('care', '<span class="mi" style="--ic:url(assets/icons/bandaid.png)"></span>', 'var(--meadow)', 'บันทึกติดตามการรักษา', 'ถ่ายรูปแผล เทียบอาการ')}
    ${tile('health', '<span class="mi" style="--ic:url(assets/icons/blood-pressure.png)"></span>', '#FFE9EC', 'ความดัน / น้ำตาล', 'บันทึกค่าที่วัด และดูแนวโน้ม', 0, true)}`;
}

// ---------- สรุปการกินยา (หน้าเต็ม ดูย้อนหลังได้ทุกเดือน) ----------
function viewAdherence() {
  const people = S.profiles.filter((p) => medsOf(p.id).length);
  const back = backBar('ยาและการดูแล', 'meds-go', 'hub');
  if (!people.length) return `${back}<h1>สรุปการกินยา</h1><div class="card empty"><div class="e">💊</div>ยังไม่มีข้อมูลยา</div>`;
  if (!people.some((p) => p.id === ui.adPid)) ui.adPid = (people.find((p) => p.id === ui.medsPerson) || people[0]).id;
  const ym = ui.adYm || (ui.adYm = ymOf(new Date()));
  const p = profileById(ui.adPid);
  const chips = `<div class="chips">${people.map((x) => `<button class="chip ${x.id === p.id ? 'on' : ''}" data-act="ad-person" data-id="${x.id}" style="--pc:${x.color};--pt:${inkOn(x.color)}"><span class="av xs">${avatarSVG(x.avatar, x.color)}</span>${esc(x.name)}</button>`).join('')}</div>`;
  const head = `${back}<h1>สรุปการกินยา</h1>${chips}${monthNav(ym, 'ad-month')}<h2 class="ad-title">การกินยาของ${esc(p.name)}ใน 1 เดือน</h2>`;
  if (ensureMonth(ym)) return `${head}<div class="card empty">กำลังโหลดข้อมูลย้อนหลัง…</div>`;
  const D = adherenceData(p.id, ym);
  if (!D.exp) return `${head}<div class="card empty"><div class="e">🗓️</div>ยังไม่มีข้อมูลการกินยาของเดือนนี้<br><span class="small">ข้อมูลเก่าเก็บไว้ครบ เลื่อนไปดูเดือนอื่นได้</span></div>`;
  const pct = Math.round((D.got / D.exp) * 100); const pr = praise(pct);
  const weeks = [];
  for (let w = 0; w * 7 < D.days.length; w++) {
    const part = D.days.slice(w * 7, w * 7 + 7); const exp = part.reduce((a, x) => a + (x.exp || 0), 0); const got = part.reduce((a, x) => a + (x.got || 0), 0);
    weeks.push({ label: `${part[0].d}–${part[part.length - 1].d}`, exp, pct: exp ? Math.round((got / exp) * 100) : null });
  }
  const full = D.days.filter((x) => x.exp && x.got === x.exp).length;
  const missed = D.perMed.filter((r) => r.got < r.exp).sort((a, b) => (b.exp - b.got) - (a.exp - a.got)).slice(0, 3);
  return `${head}
    <div class="card praise"><div class="praise-ic">${pr.icon}</div><div class="praise-h">${pr.head}</div>
      <div class="praise-pct">${pct}%</div>
      <p class="small">${esc(p.name)} กินยาครบ ${full} วัน จากเดือนนี้ · รวม ${D.got} / ${D.exp} ครั้ง<br>${pr.msg}</p></div>
    <div class="card"><b>แต่ละสัปดาห์</b>
      <div class="wk-bars">${weeks.map((w) => `<div class="wk"><span class="wk-v">${w.pct == null ? '–' : w.pct + '%'}</span>
        <div class="wk-col"><i class="${w.pct != null && w.pct < 70 ? 'low' : ''}" style="height:${w.pct == null ? 0 : Math.max(6, w.pct)}%"></i></div><small>วันที่ ${w.label}</small></div>`).join('')}</div></div>
    <div class="card"><b>แต่ละช่วงเวลา</b>
      ${SLOTS.filter((s) => D.perSlot[s.key]).map((s) => { const r = D.perSlot[s.key]; const v = Math.round((r.got / r.exp) * 100);
        return `<div class="ad-bar"><span>${s.icon} ${s.short}</span><div><i style="width:${v}%"></i></div><b>${v}%</b></div>`; }).join('')}</div>
    ${missed.length ? `<div class="card soft"><b>💡 ยาที่ยังไม่มีบันทึกบ่อย</b>
      <div class="miss-list">${missed.map((r) => `<div class="miss-item"><b class="miss-no">${esc(medNo(r.m))}</b><span class="miss-nm">${esc(r.m.name)}</span><span class="miss-n">ยังไม่มีบันทึก ${r.exp - r.got} ครั้ง</span></div>`).join('')}</div>
      <p class="small" style="margin:8px 0 0">ลองวางยาไว้ใกล้ที่ที่เห็นทุกวัน หรือเปิดแจ้งเตือนช่วงนั้นดูนะ</p></div>` : ''}

    <p class="small muted center">ข้อมูลเก็บไว้ถาวร ย้อนดูได้สูงสุด ${HISTORY_MONTHS} เดือน · ยาที่กินเมื่อมีอาการไม่นับ</p>`;
}

// ---------- สรุปการกินยา แบบ Free: 7 วันล่าสุด (ย้อนหลังและกราฟรายเดือนเป็น Premium) ----------
function viewAdherenceFree() {
  const people = S.profiles.filter((p) => medsOf(p.id).length);
  const back = backBar('ยาและการดูแล', 'meds-go', 'hub');
  if (!people.length) return `${back}<h1>สรุปการกินยา</h1><div class="card empty"><div class="e">💊</div>ยังไม่มีข้อมูลยา</div>`;
  if (!people.some((p) => p.id === ui.adPid)) ui.adPid = (people.find((p) => p.id === ui.medsPerson) || people[0]).id;
  const p = profileById(ui.adPid);
  const chips = `<div class="chips">${people.map((x) => `<button class="chip ${x.id === p.id ? 'on' : ''}" data-act="ad-person" data-id="${x.id}" style="--pc:${x.color};--pt:${inkOn(x.color)}"><span class="av xs">${avatarSVG(x.avatar, x.color)}</span>${esc(x.name)}</button>`).join('')}</div>`;
  const head = `${back}<h1>สรุปการกินยา</h1>${chips}<h2 class="ad-title">การกินยาของ${esc(p.name)} · ${FREE_LIMITS.adherenceDays} วันล่าสุด</h2>`;
  const now = new Date(); const keys = []; // วันล่าสุด → เก่าสุด แล้วกลับลำดับ
  for (let i = FREE_LIMITS.adherenceDays - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i); keys.push({ key: `${ymOf(d)}-${pad(d.getDate())}`, ym: ymOf(d), d: d.getDate(), dow: WD_SHORT[d.getDay()] }); }
  const yms = [...new Set(keys.map((k) => k.ym))];
  if (yms.some((ym) => ensureMonth(ym))) return `${head}<div class="card empty">กำลังโหลดข้อมูล…</div>`;
  const byKey = {}; yms.forEach((ym) => adherenceData(p.id, ym).days.forEach((x) => { byKey[x.key] = x; }));
  const days = keys.map((k) => { const x = byKey[k.key] || {}; return { ...k, exp: x.exp || 0, got: x.got || 0 }; });
  const exp = days.reduce((a, x) => a + x.exp, 0), got = days.reduce((a, x) => a + x.got, 0);
  const upsell = `<div class="card soft"><b>⭐ อยากดูย้อนหลังและกราฟรายเดือน?</b><p class="small" style="margin:6px 0 10px">Premium ดูสรุปได้ทั้งเดือน แยกตามช่วงเวลา และดูยาที่ยังไม่มีบันทึกบ่อย</p><button class="btn block" data-act="premium-info" data-id="summary">ดูรายละเอียด Premium</button></div>`;
  if (!exp) return `${head}<div class="card empty"><div class="e">🗓️</div>ยังไม่มีข้อมูลการกินยาใน ${FREE_LIMITS.adherenceDays} วันนี้</div>${upsell}`;
  const pct = Math.round((got / exp) * 100); const pr = praise(pct);
  return `${head}
    <div class="card praise"><div class="praise-ic">${pr.icon}</div><div class="praise-h">${pr.head}</div><div class="praise-pct">${pct}%</div>
      <p class="small">รวม ${got} / ${exp} ครั้งใน ${FREE_LIMITS.adherenceDays} วันล่าสุด<br>${pr.msg}</p></div>
    <div class="card"><b>แต่ละวัน</b>
      <div class="wk-bars">${days.map((x) => { const v = x.exp ? Math.round((x.got / x.exp) * 100) : null;
        return `<div class="wk"><span class="wk-v">${v == null ? '–' : v + '%'}</span><div class="wk-col"><i class="${v != null && v < 70 ? 'low' : ''}" style="height:${v == null ? 0 : Math.max(6, v)}%"></i></div><small>${x.dow}<br>${x.d}</small></div>`; }).join('')}</div></div>
    ${upsell}
    <p class="small muted center">ยาที่กินเมื่อมีอาการไม่นับ</p>`;
}
// ---------- สรุปอารมณ์ (เฉพาะของตัวเอง ดูย้อนหลังได้) ----------
function viewMoodSummary() {
  const back = backBar('ภาพรวมวันนี้', 'today-go', 'home');
  const me = selfProfile();
  if (!me) return `${back}<h1>สรุปอารมณ์</h1><div class="card empty"><div class="e">😊</div>ยังไม่มี "ตัวฉัน"<br><button class="btn sm" data-act="add-self" style="margin-top:12px">+ เพิ่มข้อมูลของฉัน</button></div>`;
  const ym = ui.moodYm || (ui.moodYm = ymOf(new Date()));
  const head = `${back}<h1>สรุปอารมณ์</h1><p class="sub">ของ${esc(me.name)} · เห็นเฉพาะเจ้าของบัญชี</p>${monthNav(ym, 'mood-month')}`;
  if (ensureMonth(ym)) return `${head}<div class="card empty">กำลังโหลดข้อมูลย้อนหลัง…</div>`;
  const logs = (S.mood_logs || []).filter((l) => l.profile_id === me.id && l.log_date.startsWith(ym));
  const [y0, m0] = ym.split('-').map(Number); const nD = new Date(y0, m0, 0).getDate(); const fDow = new Date(y0, m0 - 1, 1).getDay(); const today0 = todayKey();
  const calCard = `<div class="card"><b>ปฏิทินอารมณ์</b><p class="small muted" style="margin:2px 0 0">แตะวันที่เพื่อบันทึกหรือแก้อารมณ์ย้อนหลัง</p>
      <div class="ad-cal mood-cal">${DOW.map((d) => `<div class="dow">${d}</div>`).join('')}${'<div></div>'.repeat(fDow)}${Array.from({ length: nD }, (_, i) => { const k = `${ym}-${pad(i + 1)}`; const l = logs.find((x) => x.log_date === k); const mo = l && moodOf(l.mood);
        return k > today0 ? `<div class="ad-d na future"><b>${i + 1}</b><small></small></div>` : `<button type="button" class="ad-d na day-btn ${k === today0 ? 'today' : ''}" data-act="mood-day" data-id="${k}" aria-label="อารมณ์วันที่ ${i + 1}"><b>${i + 1}</b><small>${mo ? moodIcon(mo, 'sm') : ''}</small></button>`; }).join('')}</div></div>`;
  if (!logs.length) return `${head}<div class="card empty"><div class="e">🗓️</div>ยังไม่มีบันทึกอารมณ์ในเดือนนี้<br><span class="small">แตะวันที่ในปฏิทินด้านล่างเพื่อบันทึกย้อนหลังได้</span></div>${calCard}`;
  const counts = MOODS.map((mo) => ({ ...mo, n: logs.filter((l) => l.mood === mo.k).length }));
  const top = [...counts].sort((a, b) => b.n - a.n)[0]; const max = Math.max(1, ...counts.map((c) => c.n));
  const [y, m] = ym.split('-').map(Number); const nDays = new Date(y, m, 0).getDate(); const firstDow = new Date(y, m - 1, 1).getDay();
  return `${head}
    <div class="card praise mood-praise"><div class="praise-ic">${moodIcon(top, 'lg')}</div><div class="praise-h">ส่วนใหญ่รู้สึก${top.label}</div>
      <p class="small">บันทึกแล้ว ${logs.length} วัน ในเดือนนี้ — ขอบคุณที่ดูแลใจตัวเองนะ 💛</p></div>
    ${calCard}
    <div class="card"><b>จำนวนวันของแต่ละอารมณ์</b>
      ${counts.map((c) => `<div class="ad-bar"><span>${moodIcon(c, 'xs')} ${c.label}</span><div><i style="width:${(c.n / max) * 100}%;background:${c.color}"></i></div><b>${c.n} วัน</b></div>`).join('')}</div>`;
}

// ---------- แท็บสมาชิก ----------
function circleData() {
  const myCircles = S.circles.filter((c) => c.user_id === DB.user.id);
  const myCircleIds = new Set(myCircles.map((c) => c.id));
  const myEmail = String(DB.user?.email || '').toLowerCase();
  const myInvites = DB.mode === 'supabase' ? (S.circle_invites || []).filter((i) => i.email.toLowerCase() === myEmail && !S.circle_members.some((m) => m.circle_id === i.circle_id && m.user_id === DB.user.id)) : [];
  const sharedCircles = S.circle_members.filter((m) => m.user_id === DB.user.id && !myCircleIds.has(m.circle_id)).map((m) => S.circles.find((c) => c.id === m.circle_id)).filter(Boolean);
  return { myCircles, myInvites, sharedCircles };
}
/** หน้า "สมาชิก" แบบเรซูเม่: ซ้าย = โปรไฟล์ของฉัน · ขวา = คนที่ฉันดูแล + แชร์มาให้ฉัน (สีบอกหัวข้อ ไม่ใช่สีของแต่ละคน) · กลุ่มผู้ดูแลเป็นแค่ป้ายบนการ์ด + ปุ่มจัดการกลุ่มท้ายหน้า */
function viewMembers() {
  if (ui.memberPage && S.profiles.some((p) => p.id === ui.memberPage)) return memberDetail(profileById(ui.memberPage));
  ui.memberPage = null;
  const { myInvites } = circleData();
  const selfP = S.profiles.find((p) => ownsProfile(p.id) && isSelfProfile(p));
  const cared = caredProfiles(); const shared = S.profiles.filter((p) => !ownsProfile(p.id));
  // การ์ดสมาชิกแบบเดิม (แถบสีตามสีประจำตัวของแต่ละคน) · โปรไฟล์ของฉันใหญ่และเด่นกว่า (big)
  const card = (p, big = false) => {
    const n = medsOf(p.id).filter(isOralMed).length; const other = medsOf(p.id).length - n; const isMe = selfP?.id === p.id; const age = ageOf(p.birth_year); const own = ownsProfile(p.id);
    const sub = [isMe ? '' : relOf(p), age ? `อายุ ${age} ปี` : ''].filter(Boolean).join(' · '); // ป้าย "ตัวคุณ" บอกอยู่แล้ว ไม่ซ้ำคำว่า "ตัวเอง"
    return `<button type="button" class="card member-row ${own ? '' : 'is-shared'} ${big ? 'mr-big' : ''}" data-act="member-open" data-id="${p.id}" style="--pc:${p.color}">
      ${avatarHtml(p, 'lg')}
      <div class="info"><div class="mr-name">${esc(p.name)}${isMe ? ' <span class="tag">ตัวคุณ</span>' : ''}</div>
        ${sub ? `<div class="small muted">${esc(sub)}</div>` : ''}
        <div class="small muted">💊 ยาทาน ${n} ตัว${other ? ` · ยาอื่นๆ ${other} ตัว` : ''}</div>
        ${p.drug_allergies?.length ? `<div class="small red-t">⚠️ แพ้ยา: ${p.drug_allergies.map(esc).join(', ')}</div>` : ''}${own ? '' : `<div class="mr-share">${shareTag(p.id)}</div>`}</div>
      <span class="muted chev">›</span></button>`;
  };
  const me = selfP ? card(selfP, true) : '<button type="button" class="rs-add o" data-act="add-self">+ เพิ่มโปรไฟล์ของฉัน<small>เพื่อบันทึกอารมณ์และดูแลตัวเองด้วย</small></button>';
  return `
    <header class="header"><div><h1>สมาชิก</h1><p class="sub">แตะที่ชื่อเพื่อดูข้อมูลส่วนตัว</p></div></header>
    ${myInvites.length ? `<button type="button" class="alert sun invite-alert" data-act="open-invites"><div class="ic">🔔</div><div><b>มี ${myInvites.length} คำเชิญเข้ากลุ่มผู้ดูแล</b><span class="small">แตะเพื่อตอบรับหรือปฏิเสธ</span></div></button>` : ''}
    <div class="rs">
      <h3 class="rs-h o"><i></i>โปรไฟล์ของฉัน</h3>
      ${me}
      <h3 class="rs-h g"><i></i>สมาชิกที่ฉันดูแล</h3>
      ${cared.map((p) => card(p)).join('')}
      <button type="button" class="rs-add g" data-act="add-person">+ เพิ่มคน</button>
      ${shared.length ? `<h3 class="rs-h v"><i></i>แชร์มาให้ฉัน</h3>${shared.map((p) => card(p)).join('')}` : ''}
      ${groupSection()}
    </div>

    <h2>📞 เบอร์ฉุกเฉิน</h2>
    <div class="card sos-card">
      <a class="sos-btn" href="tel:1669" data-call-name="เหตุฉุกเฉิน รถพยาบาล"><span>🚑</span><b>โทร 1669</b><small>เหตุฉุกเฉิน รถพยาบาล</small></a>
      ${(S.emergency_contacts || []).map((h) => `<div class="hos-row"><a class="hos-call" data-call-name="${esc(h.name)}" href="tel:${esc(h.phone.replace(/[^\d+]/g, ''))}"><span>🏥</span><b>${esc(h.name)}</b><small>${esc(h.phone)}</small></a><button type="button" class="hos-rm" data-act="del-contact" data-id="${h.id}" aria-label="ลบ ${esc(h.name)}">×</button></div>`).join('')}
      <button class="btn ghost block" data-act="add-contact">+ เพิ่มเบอร์โรงพยาบาล</button>
    </div>`;
}
/** ส่วน "กลุ่มผู้ดูแล" ท้ายหน้าสมาชิก: การ์ดกลุ่มของฉัน (เห็นว่ามีข้อมูลใครแชร์อยู่ในกลุ่ม) · คำเชิญที่รอ · กลุ่มที่แชร์มาให้ · ปุ่มสร้างกลุ่ม */
function groupSection() {
  const { myCircles, myInvites, sharedCircles } = circleData();
  const mine = myCircles.map((c) => { const shared = (S.circle_care_for || []).filter((cf) => cf.circle_id === c.id).map((cf) => S.profiles.find((p) => p.id === cf.profile_id)).filter(Boolean); const nm = S.circle_members.filter((m) => m.circle_id === c.id).length;
    return `<div class="card circle"><div class="grp-head"><b>${esc(circleLabel(c.name))}</b><button class="btn ghost sm" data-act="manage-circle" data-id="${c.id}">แก้ไข</button></div><p class="small muted grp-sub">${[c.description ? esc(c.description) : '', nm ? `สมาชิก ${nm} คน` : ''].filter(Boolean).join(' · ')}</p><div class="shared-row">${shared.length ? shared.map((p) => `<span class="shared-av" title="${esc(p.name)}">${avatarHtml(p, 'xs')}<small>${esc(p.name)}</small></span>`).join('') : '<span class="small muted">ยังไม่ได้เลือกข้อมูลที่แชร์</span>'}</div></div>`; }).join('');
  const inv = myInvites.map((i) => `<div class="card circle"><b>คำเชิญ: ${esc(i.circle_name || 'กลุ่มผู้ดูแล')}</b><p class="small muted grp-sub">สิทธิ์: ${i.role === 'viewer' ? 'ดูอย่างเดียว' : 'แก้ไขข้อมูลได้'}</p><div class="row"><button class="btn sm" data-act="accept-invite" data-id="${i.id}">✓ รับคำเชิญ</button><button class="btn ghost sm" data-act="decline-invite" data-id="${i.id}">ปฏิเสธ</button></div></div>`).join('');
  const sh = sharedCircles.map((c) => { const mm = S.circle_members.find((m) => m.circle_id === c.id && m.user_id === DB.user.id); return `<div class="card circle shared"><div class="grp-head"><b>${esc(circleLabel(c.name))}</b><button class="btn ghost sm danger" data-act="leave-circle" data-id="${c.id}">ออกจากกลุ่ม</button></div><p class="small muted grp-sub">แชร์มาให้ · สิทธิ์ของฉัน: ${mm?.role === 'viewer' ? 'ดูอย่างเดียว' : 'แก้ไขได้'}</p></div>`; }).join('');
  return `<h3 class="rs-h s" id="grpSec"><i></i>กลุ่มผู้ดูแล</h3>
    ${mine}${inv}${sh}${mine || inv || sh ? '' : '<p class="small muted" style="margin:0 0 8px">ยังไม่มีกลุ่มผู้ดูแล</p>'}
    <button type="button" class="rs-add v" data-act="new-circle">+ สร้างกลุ่มผู้ดูแล</button>`;
}

function memberDetail(p) {
  const n = medsOf(p.id).filter(isOralMed).length; const other = medsOf(p.id).length - n; const age = ageOf(p.birth_year); const isMe = selfProfile()?.id === p.id;
  const next = S.appointments.filter((a) => a.profile_id === p.id && daysUntil(a.appt_date) >= 0).sort((a, b) => a.appt_date.localeCompare(b.appt_date))[0];
  const visits = historyItems(p.id).length; // ตัวเลขเดียวกับหน้า "บันทึกการไปหาหมอ" (history.js)
  const cares = S.care_plans.filter((c) => c.profile_id === p.id && c.status === 'active').length;
  const kv = (k, v) => (v ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : '');
  const nA = '<span class="muted" style="font-weight:400">ยังไม่ได้ระบุ</span>'; // ข้อมูลร่างกายแสดงเสมอ แม้ยังไม่กรอก (แก้ได้ที่ "แก้ไขข้อมูล")
  return `${backBar('สมาชิก', 'member-back')}
    <div class="profile-top" style="--pc:${p.color}">${avatarHtml(p, 'lg')}<h1>${esc(p.name)}${isMe ? ' <span class="tag">ตัวคุณ</span>' : ''}</h1>
      <div class="small muted">${esc(isMe && p.relation === 'ตัวเอง' ? '' : relOf(p))}${(isMe && p.relation === 'ตัวเอง' ? '' : relOf(p)) && age ? ' · ' : ''}${age ? `อายุ ${age} ปี` : ''}</div>${ownsProfile(p.id) ? '' : `<div class="tags">${shareTag(p.id)}</div>`}</div>
    ${p.drug_allergies?.length ? `<div class="alert red allergy-box"><div class="ic">⚠️</div><div><b>แพ้ยา</b><div class="tags">${tagList(p.drug_allergies, 'allergy')}</div></div></div>` : ''}
    <div class="card kv-card">
      ${ownsProfile(p.id) ? '' : `<div class="kv"><span>ความสัมพันธ์ของฉัน</span><b>${esc(relOf(p)) || nA} <button type="button" class="linkbtn" data-act="rel-label" data-id="${p.id}">✏️ ${relOf(p) ? 'แก้' : 'ตั้ง'}</button></b></div>`}
      ${kv('โรคประจำตัว', p.chronic_diseases?.length ? p.chronic_diseases.map(esc).join(', ') : '')}
      ${kv('น้ำหนัก', p.weight_kg ? `${num(p.weight_kg)} กก.` : nA)}${kv('ส่วนสูง', p.height_cm ? `${num(p.height_cm)} ซม.` : nA)}${kv('รอบเอว', p.waist_cm ? `${num(p.waist_cm)} ซม.` : nA)}${kv('กรุ๊ปเลือด', p.blood_type ? esc(p.blood_type) : nA)}
      ${kv('ยา', `${n} ตัว (รหัส "${esc(medPrefix(p.id)) || '-'}")`)}
      ${kv('ยาอื่นๆ (ไม่ใช่ยาทาน)', `${other} ตัว`)}
      ${kv('นัดถัดไป', next ? thDate(next.appt_date) : '')}
      ${kv('มีนัดพบหมอรวม', `${visits} ครั้ง`)}
    </div>
    <div class="two-btn">
      <button type="button" class="card mb-btn" data-act="member-history" data-id="${p.id}"><span class="tile-ic" style="background:var(--pink-soft)"><span class="mi" style="--ic:url(assets/icons/notebook.svg)"></span></span><b>บันทึกการไปหาหมอ</b></button>
    </div>
    ${ownsProfile(p.id) ? `<button class="btn block" data-act="edit-person" data-id="${p.id}">✏️ แก้ไขข้อมูล</button>` : '<p class="small muted center">ข้อมูลส่วนตัวแก้ได้เฉพาะเจ้าของข้อมูล</p>'}`;
}

/** คำเชิญเข้ากลุ่มผู้ดูแลที่ส่งมาถึงอีเมลของบัญชีนี้ และยังไม่ได้ตอบรับ */
function pendingInvites() {
  if (DB.mode !== 'supabase' || !DB.user) return [];
  const me = String(DB.user.email || '').toLowerCase();
  return (S.circle_invites || []).filter((i) => String(i.email || '').toLowerCase() === me && !(S.circle_members || []).some((m) => m.circle_id === i.circle_id && m.user_id === DB.user.id));
}
/** แถบเตือนบนหน้าวันนี้: มีคำเชิญเข้ากลุ่มผู้ดูแล (แตะเพื่อไปหน้าสมาชิก) */
function inviteAlerts() {
  const list = pendingInvites(); if (!list.length) return '';
  const names = list.map((i) => esc(i.circle_name || 'กลุ่มผู้ดูแล')).join(', ');
  return `<button type="button" class="alert sun invite-alert" data-act="open-invites"><div class="ic">📨</div><div><b>มีคำเชิญเข้ากลุ่มผู้ดูแล ${list.length} กลุ่ม</b><span class="small">${names} · แตะเพื่อตอบรับหรือปฏิเสธ</span></div></button>`;
}

/** ล้างแคชของตัวแอป (ไฟล์หน้าจอที่เก็บไว้ให้เปิดออฟไลน์) แล้วโหลดเวอร์ชันล่าสุด — ไม่ลบข้อมูลบนเซิร์ฟเวอร์ และไม่ออกจากระบบ */
async function clearAppCache() {
  if (!(await askConfirm('ต้องการ <b>ล้างแคชและโหลดเวอร์ชันล่าสุด</b> ใช่หรือไม่?<br><small class="muted">ข้อมูลของคุณบนเซิร์ฟเวอร์ไม่หาย และไม่ออกจากระบบ แต่หน้าจะโหลดใหม่ และต้องมีอินเทอร์เน็ตตอนโหลด</small>', 'ใช่ ล้างแคช'))) return;
  if (!(await askConfirm('<b>ยืนยันอีกครั้ง</b> — ล้างแคชของแอปเดี๋ยวนี้?<br><small class="muted">ถ้าตอนนี้ไม่มีอินเทอร์เน็ต แอปอาจเปิดไม่ขึ้นจนกว่าจะมีสัญญาณ</small>', 'ยืนยัน ล้างเลย', 'ยกเลิก'))) return;
  toast('กำลังล้างแคช…');
  try {
    if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch (e) { console.warn('clearAppCache', e); }
  location.reload();
}

// เครดิตไอคอน (Flaticon · Free license with attribution — ชื่อผู้สร้างตามใบรับรองในโฟลเดอร์ License)
const ICON_CREDITS = [['ยา', 'Magnific'], ['นัดพบหมอ', 'Gajah Mada'], ['วันนี้', 'Aldo Cervantes'], ['สมาชิก', 'Magnific'], ['ตั้งค่า', 'Gregor Cresnar Premium'],
  ['บันทึกติดตามการรักษา', 'Magnific'], ['สรุปการกินยา', 'juicy_fish'], ['จำนวนยาที่เหลือ', 'M Karruly'], ['ความดัน / น้ำตาล', 'Smashicons'], ['ดูสรุปก่อนพบหมอ', 'Magnific'], ['สรุปอารมณ์ใน 1 เดือน (ภาพเคลื่อนไหว)', 'Magnific']];

// ---------- แท็บตั้งค่า ----------
/** ตั้งค่า > การแจ้งเตือน: รวมสวิตช์แจ้งเตือนทุกรายการไว้ที่เดียว แยกเป็นหมวด (พับเก็บไว้ กดเพื่อเปิด) */
function notifCategories() {
  const sw = (attr, on, dis) => `<span class="switch"><input type="checkbox" ${attr} ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}><i></i></span>`;
  const who = (p, note) => `<span class="nt-who">${avatarHtml(p, 'xs')}<span class="nt-nm"><b>${esc(p.name)}</b>${note && !ownsProfile(p.id) ? `<small class="muted">${note}</small>` : ''}</span></span>`; // โปรไฟล์ที่แชร์มา: ใส่ป้ายอธิบายว่าทำไมสวิตช์จาง (ตั้งค่าได้เฉพาะเจ้าของ)
  const cat = (ic, title, sub, body) => `<details class="set-det nt-cat"><summary class="set-row"><span class="sr-ic">${ic}</span><span class="sr-l">${title}<small class="muted" style="display:block">${sub}</small></span><span class="muted chev">›</span></summary><div class="nt-body">${body}</div></details>`;
  const none = '<p class="small muted">ยังไม่มีข้อมูล</p>';
  // เจ้าของโปรไฟล์เลือกได้ว่าสมาชิกคนไหนในกลุ่มที่เห็นโปรไฟล์นี้ จะได้รับเตือนกินยาด้วย (reminder_recipients) · สมาชิกที่รับเตือนไม่มีปุ่ม "กินแล้ว" ดูสถานะได้อย่างเดียว
  const myId = DB.user?.id; const rcpts = S.reminder_recipients || [];
  const shareesOf = (pid) => { const cids = new Set((S.circle_care_for || []).filter((cf) => cf.profile_id === pid).map((cf) => cf.circle_id)); const seen = new Set(); return S.circle_members.filter((m) => cids.has(m.circle_id) && m.user_id !== myId && !seen.has(m.user_id) && seen.add(m.user_id)); };
  const meds = S.profiles.map((p) => {
    const mine = ownsProfile(p.id); const note = rcpts.some((r) => r.profile_id === p.id && r.user_id === myId) ? 'แชร์มาให้ · เจ้าของเลือกให้คุณรับเตือน' : 'แชร์มาให้ · เจ้าของยังไม่ได้เลือกให้คุณรับเตือน';
    const subs = mine && DB.mode === 'supabase' && reminderOn(p) ? shareesOf(p.id) : [];
    return `<label class="nt-row">${who(p, note)}${sw(`data-toggle-reminder="${p.id}"`, reminderOn(p), !mine)}</label>`
      + (subs.length ? `<div class="nt-rcpt"><small class="muted">ส่งเตือนให้สมาชิกในกลุ่มด้วย</small>${subs.map((m) => `<label class="nt-row"><span class="nt-who"><span class="nt-nm"><b>${esc(m.email || 'สมาชิก')}</b><small class="muted">${esc(roleLabel(m.role))}</small></span></span>${sw(`data-toggle-rcpt="${p.id}|${m.user_id}"`, rcpts.some((r) => r.profile_id === p.id && r.user_id === m.user_id))}</label>`).join('')}</div>` : '');
  }).join('');
  const lowNow = lowStockQty();
  const lowBox = `<div class="nt-days"><b>แจ้งเตือนเมื่อยาเหลือจำนวน</b><div class="nt-low"><button type="button" class="stk-b" data-low-step="-1" aria-label="ลด">−</button><input type="number" id="lowQty" data-low-qty min="0" max="999" step="1" inputmode="numeric" value="${lowNow}" aria-label="จำนวนเม็ด"><span>เม็ด</span><button type="button" class="stk-b" data-low-step="1" aria-label="เพิ่ม">+</button></div>
    <small class="muted">จะขึ้นแจ้งเตือน "ยาใกล้หมด" ตามจำนวนที่คุณระบุ (ยาที่ทานเฉพาะเมื่อมีอาการและยาที่ไม่ใช่เม็ดไม่นับ)</small></div>`;
  const daysOn = remindDays();
  const daysBox = `<div class="nt-days"><b>เตือนล่วงหน้า</b><div class="nt-chips">${REMIND_DAY_OPTIONS.map((d) => `<label class="nt-chip"><input type="checkbox" data-appt-day="${d}" ${daysOn.includes(d) ? 'checked' : ''}><span>${d === 0 ? 'วันนัด' : `${d} วัน`}</span></label>`).join('')}</div><small class="muted">เลือกได้หลายวัน</small>
    <b class="nt-tl">เวลาแจ้งเตือน</b><div class="t24 nt-time"><select data-appt-hh aria-label="ชั่วโมง">${Array.from({ length: 24 }, (_, h) => pad(h)).map((h) => `<option ${h === apptRemindTime().slice(0, 2) ? 'selected' : ''}>${h}</option>`).join('')}</select><b>:</b><select data-appt-mm aria-label="นาที">${[...new Set(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', apptRemindTime().slice(3)])].sort().map((m) => `<option ${m === apptRemindTime().slice(3) ? 'selected' : ''}>${m}</option>`).join('')}</select><small>น.</small></div></div>`;
  const appts = S.profiles.map((p) => `<label class="nt-row">${who(p, 'แชร์มาให้ · เปิด/ปิดได้เฉพาะเจ้าของโปรไฟล์')}${sw(`data-toggle-appt="${p.id}"`, p.appt_reminder !== false, !ownsProfile(p.id))}</label>`).join('');
  const plans = S.care_plans.filter((c) => c.status === 'active').map((c) => { const p = profileById(c.profile_id); return `<label class="nt-row"><span class="nt-who"><b>${esc(c.title)}</b><small class="muted">${esc(p?.name || '')}</small></span>${sw(`data-toggle-care="${c.id}"`, c.remind !== false, !canEditProfile(c.profile_id))}</label>`; }).join('');
  const desc = (t) => `<p class="small muted nt-desc">${t}</p>`;
  return `<div class="nt-cats">
    ${cat('💊', 'เตือนกินยา', ntMedSub(), desc('เลือกโปรไฟล์ที่จะให้เตือน แอปจะเด้งตอนถึงเวลากินยาของทุกตัวที่โปรไฟล์นั้นมี (ปรับเวลาที่ ตั้งค่า › กำหนดช่วงเวลาทานยา) ในการแจ้งเตือนมีปุ่ม "กินแล้ว" และ "เตือนอีก 15 นาที" (เฉพาะเจ้าของโปรไฟล์) · เจ้าของโปรไฟล์ที่แชร์ในกลุ่มเลือกส่งเตือนให้สมาชิกบางคนด้วยได้') + (meds || none))}
    ${cat('📅', 'เตือนนัดพบหมอ', ntApptSub(), desc('เด้งเตือนก่อนวันนัดหมอตามจำนวนวันที่เลือก ในเวลาที่ตั้ง') + daysBox + (appts || none))}
    ${cat('🩹', 'เตือนบันทึกติดตามการรักษา', ntCareSub(), desc('เลือกแผนติดตามที่ต้องการให้เด้งเตือนในวันที่ถึงรอบติดตาม') + (plans || '<p class="small muted">ยังไม่มีบันทึกติดตามการรักษา</p>'))}
    ${cat('📦', 'ยาใกล้หมด', `แจ้งเตือนเมื่อยาเหลือจำนวน ${lowStockQty()} เม็ด`, lowBox)}</div>
    <p class="nt-note"><b>ใครจะได้รับการเตือน?</b> การเตือนกินยาจะเด้งที่เครื่องของเจ้าของโปรไฟล์ และสมาชิกในกลุ่มที่เจ้าของเลือกไว้ (สมาชิกต้องเปิดแจ้งเตือนในเครื่องของตัวเอง) ส่วนเตือนนัดหมอและติดตามการรักษาเด้งที่เจ้าของเท่านั้น</p>`;
}
/** บรรทัดสรุปใต้ชื่อแต่ละหมวด (อัปเดตสดตอนผู้ใช้เปลี่ยนค่า) */
const ntMedSub = () => { const on = S.profiles.filter((p) => reminderOn(p)); const nm = on.slice(0, 3).map((p) => p.name).join(', ') + (on.length > 3 ? ` และอีก ${on.length - 3}` : ''); return `เด้งตอนถึงเวลากินยา · เปิดให้ ${on.length} จาก ${S.profiles.length} โปรไฟล์${on.length ? ` · เปิด: ${nm}` : ''}`; };
const ntApptSub = () => { const d = remindDays(); return `ก่อนวันนัดหมอ ${d.length ? d.join(', ') + ' วัน' : 'ปิดอยู่'} · เวลา ${apptRemindTime()} น.`; };
const ntCareSub = () => `เด้งวันที่ถึงรอบติดตาม · เปิดให้ ${S.care_plans.filter((c) => c.status === 'active' && c.remind !== false).length} แผนติดตาม`;
function viewSettings() {
  const pushOk = 'serviceWorker' in navigator && 'PushManager' in window;
  const supa = DB.mode === 'supabase';
  const row = (ic, label, val, act) => `<${act ? `button type="button" data-act="${act}"` : 'div'} class="set-row"><span class="sr-ic">${ic}</span><span class="sr-l">${label}</span>${val ? `<span class="sr-v">${val}</span>` : ''}${act ? '<span class="muted chev">›</span>' : ''}</${act ? 'button' : 'div'}>`;
  const unset = '<i class="muted">ยังไม่ได้ตั้งค่า</i>';
  const mail = CFG.CONTACT_EMAIL ? `<a href="mailto:${esc(CFG.CONTACT_EMAIL)}">${esc(CFG.CONTACT_EMAIL)}</a>` : unset;
  const support = CFG.SUPPORT_URL ? `<a href="${esc(CFG.SUPPORT_URL)}" target="_blank" rel="noopener">เปิดลิงก์</a>` : unset;
  return `<h1>ตั้งค่า</h1>
    <h3 class="set-h">บัญชี</h3>
    <div class="card set-group">${row('✉️', 'อีเมล', esc(DB.user?.email || ''))}
      ${supa ? row('🔑', 'เปลี่ยนรหัสผ่าน', '', 'change-password') : ''}</div>
    ${typeof membershipSection === 'function' ? membershipSection() : ''}
    <h3 class="set-h">การใช้งาน</h3>
    <div class="card set-group">${row('🌐', 'ภาษา', 'ไทย', 'language')}
      <label class="set-row bigtext-row"><span class="sr-ic">🔠</span><span class="sr-l">ตัวอักษรใหญ่<small class="muted" style="display:block">ขยายตัวอักษรทั้งแอป (เฉพาะเครื่องนี้)</small></span><span class="switch"><input type="checkbox" data-bigtext ${bigTextOn() ? 'checked' : ''}><i></i></span></label>
      <details class="set-det"><summary class="set-row"><span class="sr-ic">⏰</span><span class="sr-l">กำหนดช่วงเวลาทานยา</span><span class="muted chev">›</span></summary>
        <div class="two">${SLOTS.map((s) => { const [hh, mm] = slotTime(s.key).split(':'); const mmOpts = [...new Set(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', mm])].sort();
          return `<div class="f"><span>${s.icon} ${s.key === 'bedtime' ? s.label : s.label.replace(/^(ก่อน|หลัง)/, '<b class="sl-b">$1</b>')}</span><div class="t24">
            <select data-slot-hh="${s.key}" aria-label="ชั่วโมง">${Array.from({ length: 24 }, (_, h) => pad(h)).map((h) => `<option ${h === hh ? 'selected' : ''}>${h}</option>`).join('')}</select><b>:</b>
            <select data-slot-mm="${s.key}" aria-label="นาที">${mmOpts.map((m) => `<option ${m === mm ? 'selected' : ''}>${m}</option>`).join('')}</select><small>น.</small></div></div>`; }).join('')}</div></details>
      <details class="set-det"><summary class="set-row"><span class="sr-ic">🔔</span><span class="sr-l">การแจ้งเตือน</span><span class="muted chev">›</span></summary>
        <div class="nt-step"><span class="nt-no">1</span><div><b>เปิดการแจ้งเตือนบนเครื่องนี้</b><small class="muted">${'Notification' in window ? ({ granted: '✅ เปิดอยู่แล้ว', denied: '❌ ถูกบล็อก — ต้องไปเปิดสิทธิ์ที่เครื่องก่อน (ดูวิธีด้านล่าง)', default: 'ยังไม่ได้เปิด — กดปุ่มด้านล่าง' }[Notification.permission] || '') : 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน'}</small></div></div>
        ${'Notification' in window && Notification.permission === 'denied' ? `<div class="nt-help"><b>เปิดสิทธิ์การแจ้งเตือนที่ไหน?</b><ul><li><b>iPhone:</b> ตั้งค่า › การแจ้งเตือน › สุขใจ แล้วเปิด "อนุญาตการแจ้งเตือน" (ต้องเพิ่มแอปไปยังหน้าจอโฮมและเปิดจากไอคอนก่อน)</li><li><b>Android:</b> ตั้งค่า › แอป › สุขใจ (หรือ Chrome) › การแจ้งเตือน › เปิด · หรือแตะไอคอนแม่กุญแจข้างชื่อเว็บ › สิทธิ์ › การแจ้งเตือน › อนุญาต</li><li><b>คอมพิวเตอร์:</b> แตะไอคอนแม่กุญแจข้างชื่อเว็บ › การแจ้งเตือน › อนุญาต แล้วโหลดหน้าใหม่</li></ul></div>` : ''}
        <button class="btn block" data-act="enable-push" ${pushOk ? '' : 'disabled'}>🔔 เปิดการแจ้งเตือนบนเครื่องนี้</button>
        <button class="btn ghost sm block nt-test" data-act="test-push">ทดลองส่งแจ้งเตือน</button>
        <p class="small muted">${pushOk ? (supa && CFG.VAPID_PUBLIC_KEY ? 'ใช้ Web Push — เตือนได้แม้ปิดแอป' : 'เตือนได้เฉพาะตอนเปิดแอปค้างไว้') : 'เบราว์เซอร์นี้ไม่รองรับ Web Push'}
          ${/iPhone|iPad/.test(navigator.userAgent) ? '<br>iPhone: ต้อง "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดจากไอคอนก่อน จึงจะเปิดแจ้งเตือนได้' : ''}</p>
        <div class="nt-step"><span class="nt-no">2</span><div><b>เลือกเรื่องที่จะให้เตือน</b><small class="muted">แตะแต่ละหมวดเพื่อตั้งค่า</small></div></div>
        ${notifCategories()}</details></div>
    <h3 class="set-h">ความเป็นส่วนตัว</h3>
    <div class="card set-group">${row('🛡️', 'ความเป็นส่วนตัวและข้อมูลสุขภาพ (PDPA)', '', 'privacy')}
      <a class="set-row" href="privacy.html" target="_blank" rel="noopener"><span class="sr-ic">📄</span><span class="sr-l">นโยบายความเป็นส่วนตัว (หน้าเว็บ)</span><span class="muted chev">›</span></a>
      <a class="set-row" href="delete-account.html" target="_blank" rel="noopener"><span class="sr-ic">🗑️</span><span class="sr-l">วิธีลบบัญชี</span><span class="muted chev">›</span></a></div>
    <h3 class="set-h">เกี่ยวกับแอป</h3>
    <div class="card set-group">${row('📱', 'เวอร์ชันปัจจุบัน', APP_VERSION)}
      ${row('🧹', 'ล้างแคชและโหลดเวอร์ชันล่าสุด', '', 'clear-cache')}
      ${row('👩‍💻', 'ผู้พัฒนา', CFG.DEVELOPER_NAME ? esc(CFG.DEVELOPER_NAME) : unset)}
      ${CFG.CONTACT_EMAIL ? row('📧', 'ติดต่อเรา', mail) : ''}
      ${CFG.SUPPORT_URL ? row('💬', 'ช่องทางการสนับสนุน', support) : ''}
      <details class="set-det"><summary class="set-row"><span class="sr-ic">🎨</span><span class="sr-l">เครดิตไอคอน</span><span class="muted chev">›</span></summary>
        <table class="credits"><thead><tr><th>ไอคอน</th><th>designed by … from <a href="https://www.flaticon.com" target="_blank" rel="noopener">Flaticon</a></th></tr></thead><tbody>${ICON_CREDITS.map(([use, who]) => `<tr><td>${esc(use)}</td><td>${esc(who)}</td></tr>`).join('')}</tbody></table>
        <p class="credits-note">ไอคอนจาก Flaticon ตามสัญญาอนุญาตแบบ Free (with attribution)</p><p class="credits-note">ไอคอนอารมณ์ (ชุด Emoticon reaction collection): <a href="http://www.freepik.com" target="_blank" rel="noopener">Designed by Freepik</a></p></details></div>
    ${supa ? '<button class="btn ghost block" data-act="logout">ออกจากระบบ</button>'
      : '<p class="small muted">ยังไม่ได้เชื่อม Supabase — ข้อมูลอยู่ในเครื่องนี้เท่านั้น</p><div class="row"><button class="btn ghost" data-act="demo">ข้อมูลตัวอย่าง</button><button class="btn danger" data-act="wipe">ล้างข้อมูล</button></div>'}
    <p class="small muted center set-copy"><span class="sc-line">${APP_DISCLAIMER}</span><br>© 2026 สุขใจ (Sookjai)<br>สงวนลิขสิทธิ์ ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต</p>`;
}

// ---------- ตัวจัดการคลิกของหน้าจอใหม่ ----------
function openSummary(pid) { ui.tab = 'meds'; ui.medsPage = 'summary'; ui.adPid = pid || null; ui.adYm = null; render(); window.scrollTo(0, 0); }
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || !S) return;
  const { act, id } = el.dataset; const top = () => window.scrollTo(0, 0);
  switch (act) {
    case 'nav-back': if (!navBack()) { const to = el.dataset.to; if (to === 'meds-go') ui.medsPage = id; else if (to === 'today-go') ui.todayPage = id; else if (to === 'member-back') ui.memberPage = null; render(); top(); } break;
    case 'toggle-dellock': setDelLock(delLocked()); break;
    case 'clear-cache': clearAppCache(); break;
    case 'open-invites': ui.memberPage = null; go('family'); setTimeout(() => document.getElementById('grpSec')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 150); break;
    case 'meds-go': ui.medsPage = id; ui.histOnly = false; if (id === 'summary') { ui.adYm = null; } render(); top(); break;
    case 'meds-open': ui.tab = 'meds'; ui.medsPage = 'list'; ui.medsPerson = id; render(); top(); break;
    case 'member-open': ui.memberPage = id; render(); top(); break;
    case 'member-back': ui.memberPage = null; render(); top(); break;
    case 'today-go': ui.todayPage = id; render(); top(); break;
    case 'mood-sum': ui.todayPage = 'mood'; ui.moodYm = null; render(); top(); break;
    case 'mood-set': setMood(id); break;
    case 'mood-day': moodDaySheet(id); break;
    case 'mood-set-day': { const d = ui.moodDay; if (d) setMood(id, d).then(() => { closeSheet(); render(); }); break; }
    case 'mood-month': ui.moodYm = shiftYm(ui.moodYm || ymOf(new Date()), +id); render(); break;
    case 'ad-person': ui.adPid = id; render(); break;
    case 'ad-month': ui.adYm = shiftYm(ui.adYm || ymOf(new Date()), +id); render(); break;
    case 'adherence': openSummary(id); break;
    case 'print-meds': downloadMedsPdf(id); break;
    case 'stickers': stickerSheet(id); break;
    case 'add-self': personForm(null, { relation: 'ตัวเอง', name: 'ฉัน', avatar: 'f-adult-smile', isSelf: true }); break;
    case 'language': openSheet(`<h3>ภาษา</h3>
      <div class="set-group card"><div class="set-row"><span class="sr-l">ไทย</span><span class="sr-v">✓ ใช้อยู่</span></div>
      <div class="set-row" style="opacity:.55"><span class="sr-l">English</span><span class="sr-v">เร็วๆ นี้</span></div></div>
      <div class="row"><button class="btn" data-act="close">ปิด</button></div>`); break;
  }
});

// ---------- หน้าเปิดแอป (Splash): ขวดยาขยับ + ชื่อแอป + สโลแกน ก่อนเข้าหน้าวันนี้ ----------
let splashShown = false;
function showSplash() {
  if (splashShown) return; splashShown = true;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.id = 'splash'; el.setAttribute('role', 'presentation');
  el.innerHTML = `<div class="sp-deco" aria-hidden="true"><i class="d d-ring"></i><i class="d d-blob"></i><i class="d d-cap c1"></i><i class="d d-cap c2"></i><i class="d d-cap c3"></i><b class="d d-star s1">✱</b><b class="d d-star s2">✱</b><b class="d d-star s3">✱</b></div>
    <div class="sp-inner">
      <span class="app-ic ic-xl sp-logo">${logoSvg()}</span>
      <h1 class="sp-name">สุขใจ</h1>
      <p class="sp-stars" aria-hidden="true">✱ ✱ ✱</p>
      <p class="sp-slogan"><span>ช่วยจัดตารางยาและใบนัด</span><span><b>แชร์ข้อมูลให้ทั้งครอบครัวดูแลไปพร้อมกัน<span class="kt">ในแอปเดียว</span></b></span></p>
      <p class="sp-ask">บันทึกยาเสร็จ สุขใจจัดตารางให้เลย!</p></div>
    <p class="sp-foot"><span class="sf-a">${APP_DISCLAIMER}<br>${CHECK_MEDS_NOTE}</span><span class="sf-b">© 2026 สุขใจ (Sookjai) สงวนลิขสิทธิ์</span></p>`;
  document.body.appendChild(el);
  document.body.classList.add('noscroll');
  let done = false;
  const close = () => { if (done) return; done = true; el.classList.add('hide'); document.body.classList.remove('noscroll'); setTimeout(() => el.remove(), 600); setTimeout(maybeOnboard, 750); };
  el.onclick = close;
  setTimeout(close, calm ? 2500 : 5500);
}

// ---------- ผู้ใช้ใหม่ (ยังไม่มีสมาชิกเลย): พาไปสร้างสมาชิกคนแรกอัตโนมัติ หลังหน้า intro/ยินยอมเสร็จ ----------
let onboardShown = false;
function maybeOnboard() {
  if (onboardShown || !S || DB?.offline || S.profiles.length > 0) return;
  const m = document.getElementById('modal'); if (m && !m.classList.contains('hidden')) return; // มีหน้าต่างอื่นเปิดอยู่ → ไม่แทรก
  if (document.getElementById('splash') || document.querySelector('.ask-ov')) return;
  onboardShown = true; // เด้งครั้งเดียวต่อการเปิดแอป — ถ้ากดยกเลิก ยังมีปุ่ม "เพิ่มคน" ในหน้าสมาชิกและแถบเตือนบนหน้าวันนี้
  personForm(null, { relation: 'ตัวเอง', name: 'ฉัน', avatar: 'f-adult-smile', isSelf: true, welcome: true }); // ผู้ใช้ใหม่: เริ่มจากสร้างโปรไฟล์ของฉัน
}
// iOS Safari ต้องมี touchstart ถึงจะแสดงสถานะ :active (สีขึ้นที่กรอบที่กด)
document.addEventListener('touchstart', () => {}, { passive: true });

// ---------- ดาวน์โหลด PDF (แบบฟอร์มเดียวกันทุกไฟล์ · ถ้าสร้างไฟล์ไม่ได้จะใช้ "พิมพ์ → บันทึกเป็น PDF" แทน) ----------
function printNow(cls, orient = 'portrait', opts = {}) {
  let st = document.getElementById('printPage');
  if (!st) { st = document.createElement('style'); st.id = 'printPage'; document.head.appendChild(st); }
  // opts.pageNo = ใส่เลขหน้า "หน้า X/Y" มุมขวาล่างทุกหน้า (กล่องขอบกระดาษ @page) · opts.title = ชื่อไฟล์ที่เบราว์เซอร์เสนอตอนบันทึก PDF
  const pageNo = opts.pageNo ? `@bottom-right { content: "หน้า " counter(page) "/" counter(pages); font: 700 9pt Sarabun, sans-serif; color: #000; vertical-align: middle; }` : '';
  st.textContent = `@page { size: A4 ${orient}; margin: ${orient === 'landscape' ? (opts.pageNo ? '10mm 10mm 12mm' : '10mm') : '14mm'}; ${pageNo} }`;
  document.body.classList.add(cls);
  const oldTitle = document.title; if (opts.title) document.title = opts.title;
  const done = () => { document.body.classList.remove(cls); document.title = oldTitle; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1500); }, 150);
}
const updDate = (meds) => { const u = latestUpdate(meds); return u ? thDateTime(u) : thDateTime(new Date().toISOString()); };
const madeAt = () => thDateTime(new Date().toISOString());

/** หมายเหตุของยา = ข้อควรระวัง + คำกำกับใต้เลข + หมายเหตุ — รวมแล้วตัดข้อความที่ซ้ำกัน/เป็นส่วนหนึ่งของกันออก (ไม่ให้ขึ้นซ้ำใน PDF) */
const normTxt = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const KIND_RANK = { warn: 3, hint: 2, note: 1 };
function remarkParts(m) {
  const raw = [];
  if (weekdaysText(m)) raw.push({ t: weekdaysText(m), kind: 'hint' });
  if (m.warning) raw.push({ t: m.warning, kind: 'warn' });
  else if (/ทึบแสง/.test(m.note || '')) raw.push({ t: 'เก็บในที่ทึบแสง', kind: 'warn' });
  if (m.table_hint) raw.push({ t: m.table_hint, kind: 'hint' });
  String(m.note || '').split(/\s*(?:·|\n)\s*/).forEach((s) => raw.push({ t: s, kind: 'note' }));
  const out = [];
  for (const r of raw) {
    const t = normTxt(r.t); if (!t) continue;
    const dup = out.find((o) => o.t.includes(t));
    if (dup) { if (KIND_RANK[r.kind] > KIND_RANK[dup.kind]) dup.kind = r.kind; continue; }
    let kind = r.kind;
    for (let i = out.length - 1; i >= 0; i--) if (t.includes(out[i].t)) { if (KIND_RANK[out[i].kind] > KIND_RANK[kind]) kind = out[i].kind; out.splice(i, 1); }
    out.push({ t, kind });
  }
  return out;
}
const medWhen = (m) => (m.as_needed ? 'เมื่อมีอาการ' : SLOTS.filter((s) => m.slots.includes(s.key)).map((s) => s.label).join(' · ') || '—');

/** โครงหน้าเดียวกันทุก PDF: หัวกระดาษ (ชื่อเรื่อง + กล่องข้อมูล 2 ช่อง) · เนื้อหา · หมายเหตุ · ท้ายกระดาษ (ข้อความเตือน + เวลาสร้างไฟล์ + เลขหน้า) */
const PDF_APP_NOTE = `${APP_DISCLAIMER} · ${CHECK_MEDS_NOTE}`;
function prSection(p, kind, title, box1, bodyHtml, note = '') {
  return `<section class="pr-page" data-kind="${kind}" style="--pcl:${tint(p.color, .5)};--pcs:${tint(p.color, .18)};--pcd:${p.color}">
    <div class="pr-top"><h1>${title}</h1><div class="pr-boxes"><span>${box1}</span><span>UPD: ${updDate(medsOf(p.id))}</span></div></div>
    ${bodyHtml}
    ${note ? `<p class="pr-note">${note}</p>` : ''}
    <p class="pr-foot"><span>${PDF_APP_NOTE} · สร้างไฟล์เมื่อ ${madeAt()} · © 2026 สุขใจ (Sookjai)</span><span class="pr-pg"></span></p></section>`;
}

/** ===== PDF ตารางกินยา + รายการยา: ตัวหนังสือจริง (vector) สร้างจากหน้าพิมพ์ของเบราว์เซอร์ + ฟอนต์ Sarabun ที่ฝังในแอป — ไม่ถ่ายภาพหน้าจอ ===== */
/** ชื่อยาสำหรับพิมพ์: ช่องว่างทุกชนิด (รวม nbsp / ตัวกว้างศูนย์) เหลือช่องเดียว ไม่มีช่องว่างแปลกในชื่อ */
const printName = (s) => String(s ?? '').replace(/[​-‍﻿]/g, '').replace(/[\s ]+/g, ' ').trim();
/** รหัสยาใน PDF: ตัวหนังสือหนาสีดำ ไม่มีสีพื้นหลัง (อ่านง่ายตอนพิมพ์) — ฟอนต์ Sarabun ตัวหนาเดียวกับในแอป */
const mpBox = (p, m) => `<span class="mp-cb">${esc(medNo(m))}</span>`;

/** โครงตารางของทั้ง 2 แบบ: หัวเรื่อง + กล่องข้อมูล 2 ช่อง (อยู่ใน thead จึงซ้ำทุกหน้าที่ตารางยาวต่อ) */
function mpSection(p, meds, kind, title, box1, ncols, headRow, bodyHtml, after = '') {
  return `<section class="mp-sec" data-kind="${kind}"><table class="mp-t mp-${kind}"><thead>
    <tr class="mp-ttl"><td colspan="${ncols}"><div class="mp-top"><h1>${title}</h1><div class="mp-boxes"><span>${box1}</span><span>UPD: ${updDate(meds)}</span></div></div></td></tr>
    <tr class="mp-hd">${headRow}</tr></thead><tbody>${bodyHtml}</tbody><tfoot><tr class="mp-sp"><td colspan="${ncols}"></td></tr></tfoot></table>${after}</section>`;
}

/** แบบที่ 1: ตารางรหัสยา — แสดงเฉพาะช่วงเวลาที่มียา · ความสูงแถวตามเนื้อหา */
function mpGridHtml(p, meds) {
  const cols = SLOTS.map((s) => ({ s, list: meds.filter((m) => m.slots.includes(s.key)) })).filter((c) => c.list.length);
  const loose = meds.filter((m) => !m.slots.length);
  const odd = meds.filter((m) => num(m.dose, 1) !== 1).map(medNo);
  const nRows = Math.max(1, ...cols.map((c) => c.list.length));
  const head = cols.length ? cols.map(({ s }) => { const pr = s.short.startsWith('ก่อน') ? 'ก่อน' : s.short.startsWith('หลัง') ? 'หลัง' : '';
    return `<th class="${pr === 'หลัง' ? 'aft' : 'bef'}">${pr ? `<u>${pr}</u>${esc(s.short.slice(pr.length))}` : esc(s.short)}<small>${slotTime(s.key)}</small></th>`; }).join('') : '<th>ช่วงเวลา</th>';
  const cell = (m) => {
    const parts = remarkParts(m); const warn = parts.filter((x) => x.kind === 'warn'); const hint = parts.filter((x) => x.kind === 'hint');
    return `<td class="${warn.length ? 'wr' : ''} ${m.as_needed ? 'pn' : ''}"><div class="mp-main">${m.as_needed ? '<b class="mp-st">*</b>' : ''}${mpBox(p, m)}${num(m.dose, 1) !== 1 ? `<span class="mp-dz">${doseLabel(m.dose)} ${esc(unitOf(m))}</span>` : ''}</div>
      <div class="mp-nm">${esc(printName(medShort(m)))}</div>${showAsn(m) ? '<div class="mp-as">เมื่อมีอาการ</div>' : ''}${warn.map((x) => `<div class="mp-w"><i></i>${esc(x.t)}</div>`).join('')}${hint.map((x) => `<div class="mp-h">${esc(x.t)}</div>`).join('')}</td>`;
  };
  const body = cols.length ? Array.from({ length: nRows }, (_, r) => `<tr>${cols.map(({ list }) => (list[r] ? cell(list[r]) : '<td class="mp-e"></td>')).join('')}</tr>`).join('') : '<tr><td class="mp-e">ไม่มียาที่กำหนดช่วงเวลา</td></tr>';
  const after = loose.length ? `<p class="mp-loose">ยาที่ไม่ได้กำหนดช่วงเวลา (ไม่อยู่ในตาราง): ${loose.map((m) => `${mpBox(p, m)} ${esc(printName(medShort(m)))}`).join(' &nbsp; ')}</p>` : '';
  return mpSection(p, meds, 'grid', `ตารางการกินยาใน 1 วัน (${esc(p.name)})`,
    `ทานครั้งละ 1 เม็ด${odd.length ? ` <b class="mp-red">(ยกเว้นรหัส ${odd.map(esc).join(' และ ')})</b>` : ''}<small class="mp-leg">สัญลักษณ์:<i class="y"></i>เหลือง = ข้อควรระวัง<i class="p"></i>ชมพู * = กินเฉพาะเมื่อมีอาการ</small>`,
    Math.max(1, cols.length), head, body, after);
}

/** แบบที่ 2: รายการยา — รหัสยา ชื่อยา ใช้รักษา จำนวน เวลา หมายเหตุ (แดง = ข้อควรระวังเท่านั้น · หมายเหตุทั่วไปเป็นสีเทา) */
function mpListHtml(p, meds) {
  const oral = meds.filter(isOralMed).length;
  const rows = meds.map((m) => { const parts = remarkParts(m);
    return `<tr><td class="mp-no">${mpBox(p, m)}</td><td class="mp-name">${esc(printName(m.name))}</td><td>${esc(printName(m.purpose || ''))}</td>
      <td>${doseLabel(m.dose)} ${esc(unitOf(m))}</td><td>${esc(medWhen(m))}</td>
      <td>${parts.map((x) => `<span class="mp-r ${x.kind === 'warn' ? 'is-warn' : 'is-grey'}">${x.kind === 'warn' ? '<i></i>' : ''}${esc(x.t)}</span>`).join('')}</td></tr>`; }).join('');
  return mpSection(p, meds, 'list', `รายการยา (${esc(p.name)})`,
    `${esc(p.relation || '')}${ageOf(p.birth_year) ? ` · อายุ ${ageOf(p.birth_year)} ปี` : ''} · ยาทาน ${oral} ตัว · ยาอื่นๆ ${meds.length - oral} ตัว`,
    6, '<th>รหัสยา</th><th>ชื่อยา</th><th>ใช้รักษา</th><th>จำนวน</th><th>เวลา</th><th>หมายเหตุ</th>', rows).replace('<table class="mp-t mp-list">', '<table class="mp-t mp-list"><colgroup><col style="width:9%"><col style="width:23%"><col style="width:17%"><col style="width:10%"><col style="width:16%"><col style="width:25%"></colgroup>');
}
const mpDoc = (p, meds) => `<div class="mp-root" style="--pcl:${tint(p.color, .5)};--pcs:${tint(p.color, .18)};--pcd:${p.color}">${mpGridHtml(p, meds)}${mpListHtml(p, meds)}<div class="mp-foot">สร้างไฟล์เมื่อ ${madeAt()} · ${PDF_APP_NOTE} · © 2026 สุขใจ (Sookjai)</div></div>`;

/** แบบที่ 3: สรุปการกินยารายเดือน (ใช้โครงหน้าเดียวกัน) */
const pctText = (g, e) => (e ? `${Math.round((g / e) * 100)}%` : '–');
function summaryNumbers(pid, ym) { // คำนวณซ้ำจากบันทึกจริงโดยตรง (ใช้ทั้งสร้างหน้าและตรวจสอบ)
  const [y, mo] = ym.split('-').map(Number); const n = new Date(y, mo, 0).getDate(); const today = todayKey();
  const meds = S.medications.filter((m) => m.profile_id === pid && m.status === 'active' && !m.as_needed && m.slots.length);
  const weeks = []; const slots = {}; const missed = {}; let exp = 0, got = 0;
  for (let d = 1; d <= n; d++) {
    const key = `${ym}-${pad(d)}`; const w = Math.floor((d - 1) / 7);
    weeks[w] = weeks[w] || { from: d, to: d, exp: 0, got: 0 }; weeks[w].to = d;
    if (key > today) continue;
    for (const m of meds) {
      const st = medStart(m); if ((st && st > key) || !dueOn(m, key)) continue;
      for (const s of m.slots) {
        const ok = S.med_logs.some((l) => l.medication_id === m.id && l.slot === s && l.log_date === key);
        exp++; weeks[w].exp++; slots[s] = slots[s] || { exp: 0, got: 0 }; slots[s].exp++;
        if (ok) { got++; weeks[w].got++; slots[s].got++; } else { missed[m.id] = (missed[m.id] || 0) + 1; }
      }
    }
  }
  return { exp, got, weeks, slots, missed, meds };
}
function printSummaryHtml(p, ym) {
  const N = summaryNumbers(p.id, ym); const pct = N.exp ? Math.round((N.got / N.exp) * 100) : 0; const pr = praise(pct);
  const weekRows = N.weeks.map((w) => `<tr><td>วันที่ ${w.from}–${w.to}</td><td class="c">${w.got} / ${w.exp}</td><td class="c"><b>${pctText(w.got, w.exp)}</b></td></tr>`).join('');
  const slotRows = SLOTS.filter((s) => N.slots[s.key]).map((s) => `<tr><td>${esc(s.label)}</td><td class="c">${N.slots[s.key].got} / ${N.slots[s.key].exp}</td><td class="c"><b>${pctText(N.slots[s.key].got, N.slots[s.key].exp)}</b></td></tr>`).join('');
  const missRows = Object.entries(N.missed).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, c]) => { const m = S.medications.find((x) => x.id === id); return `<tr><td class="no">${esc(medNo(m))}</td><td>${esc(m.name)}</td><td class="c">${c} ครั้ง</td></tr>`; }).join('');
  const body = `<div class="pr-cols"><div>
      <h2 class="pr-h2">แต่ละสัปดาห์</h2><table class="pr-list pr-sum"><colgroup><col style="width:46%"><col style="width:30%"><col style="width:24%"></colgroup><thead><tr><th>ช่วงวัน</th><th>กินแล้ว / ทั้งหมด</th><th>ร้อยละ</th></tr></thead><tbody>${weekRows}</tbody></table>
      <h2 class="pr-h2">แต่ละช่วงเวลา</h2><table class="pr-list pr-sum"><colgroup><col style="width:46%"><col style="width:30%"><col style="width:24%"></colgroup><thead><tr><th>ช่วงเวลา</th><th>กินแล้ว / ทั้งหมด</th><th>ร้อยละ</th></tr></thead><tbody>${slotRows}</tbody></table></div>
    <div><div class="pr-kpi"><div class="pr-kpi-pct">${N.exp ? pct + '%' : '–'}</div><div><b>${pr.head}</b><br>กินยาตรงเวลา ${N.got} / ${N.exp} ครั้ง</div></div>
      <p class="pr-praise">${esc(pr.msg)}</p>
      <h2 class="pr-h2">ยาที่ยังไม่มีบันทึกบ่อย</h2>${missRows ? `<table class="pr-list pr-sum"><colgroup><col style="width:20%"><col style="width:56%"><col style="width:24%"></colgroup><thead><tr><th>รหัส</th><th>ชื่อยา</th><th>ยังไม่มีบันทึก</th></tr></thead><tbody>${missRows}</tbody></table>` : '<p class="pr-praise">ไม่มียาที่ขาดในเดือนนี้</p>'}</div></div>`;
  return prSection(p, 'summary', `สรุปการกินยา (${esc(p.name)})`, `เดือน${monthLabel(ym)}`, body, 'ยาที่กินเมื่อมีอาการไม่นับรวม · คำนวณจากการติ๊กในแอป');
}

// ---------- กล่องถามยืนยันก่อนแก้ไข/ลบ (ซ้อนทับหน้าที่เปิดอยู่ ถ้ากดไม่ใช่ ก็กลับไปแก้ต่อได้ ข้อมูลที่กรอกไม่หาย) ----------
function askConfirm(msg, yes = 'ใช่ ยืนยัน', no = 'ไม่ใช่') {
  // ข้อความยืนยันแก้ไข: ไม่ต้องมีบรรทัดอธิบายใต้คำถาม และให้ "ใช่หรือไม่?" ลงบรรทัดล่างเสมอ
  msg = String(msg).replace(/(?:<br>)?\s*<small class="muted">กด "ใช่ แก้ไข"[^<]*<\/small>/, '').replace(/\s*ใช่หรือไม่\?/, '<br>ใช่หรือไม่?');
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'ask-ov';
    ov.innerHTML = `<div class="ask-box" role="alertdialog" aria-modal="true"><div class="ask-ic">✋</div><p class="ask-msg">${msg}</p>
      <div class="ask-btns"><button type="button" class="btn ghost" data-v="0">${no}</button><button type="button" class="btn" data-v="1">${yes}</button></div></div>`;
    const done = (v) => { ov.remove(); resolve(v); };
    ov.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v === '1'); else if (e.target === ov) done(false); });
    document.body.appendChild(ov);
    ov.querySelector('[data-v="0"]').focus();
  });
}

// ---------- สร้างไฟล์ PDF จริงและดาวน์โหลดทันที (ตรวจสอบหลายรอบก่อนบันทึกทุกครั้ง) ----------
const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { s.remove(); rej(new Error('โหลดไม่สำเร็จ ' + src)); }; document.head.appendChild(s); });
/** โหลดเครื่องมือสร้าง PDF: ใช้ไฟล์ที่เก็บไว้ในแอป (vendor/ — ใช้ออฟไลน์ได้ ไม่พึ่งเน็ตภายนอก) ถ้าไม่มีค่อยลองโหลดจาก CDN */
async function loadPdfLibs() {
  const get = async (local, cdn) => { try { await loadScript(local); } catch (e) { await loadScript(cdn); } };
  if (!window.html2canvas) await get('vendor/html2canvas.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (!(window.jspdf && window.jspdf.jsPDF)) await get('vendor/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  return window.jspdf.jsPDF;
}
/** รอให้หน้าต่างอยู่ด้านหน้าก่อนสร้างไฟล์ — เบราว์เซอร์ที่ซ่อน/ย่ออยู่จะโหลดฟอนต์ไม่ทัน ทำให้ตัวหนังสือเพี้ยน */
async function waitVisible(maxMs = 20000) {
  if (!document.hidden) return;
  toast('กรุณาเปิดหน้าแอปค้างไว้ระหว่างสร้างไฟล์ PDF…');
  const t0 = Date.now(); while (document.hidden && Date.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 300));
}
/** ตรวจว่าตัวหนังสือที่วาดลงภาพไม่ยื่นเลย "ปลายข้อความจริง" บนหน้า (อาการช่องไฟกระจาย/ตัวเล็กเพี้ยน) — ตรวจเฉพาะข้อความบรรทัดเดียวที่ด้านขวาไม่มีอะไรอยู่ใกล้ ๆ */
function textFidelityIssues(el, cv, scale) {
  const doc = el.ownerDocument; const win = doc.defaultView; const er = el.getBoundingClientRect(); const ctx = cv.getContext('2d', { willReadFrequently: true });
  const issues = []; let checked = 0;
  for (const e of el.querySelectorAll('*')) {
    if (e.childElementCount || !/\S{3}/.test(e.textContent) || /^(SCRIPT|STYLE|svg|SVG)$/.test(e.tagName)) continue;
    const cs = win.getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const fs = parseFloat(cs.fontSize) || 14; const rg = doc.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect();
    if (r.width < 24 || r.height > fs * 2.2 || r.height < 4) continue; // บรรทัดเดียวเท่านั้น
    let tail = false; for (let n = e.nextSibling; n; n = n.nextSibling) if (n.nodeType === 3 && n.textContent.trim()) tail = true; if (tail) continue; // มีข้อความต่อท้ายในบรรทัดเดียวกัน
    const pr = e.parentElement.getBoundingClientRect(); let zoneR = Math.min(r.right + Math.max(10, r.width * 0.25), pr.right - 3);
    for (let n = e.nextElementSibling; n; n = n.nextElementSibling) { const sr = n.getBoundingClientRect(); if (sr.width && sr.top < r.bottom - 2 && sr.bottom > r.top + 2) zoneR = Math.min(zoneR, sr.left - 3); } // ไม่ล้ำเข้าไปในกล่องข้างเคียงบนบรรทัดเดียวกัน
    if (zoneR <= r.right + 3) continue;
    const x0 = Math.round((r.right + 1.5 - er.left) * scale), x1 = Math.round((zoneR - er.left) * scale), y0 = Math.round((r.top + 2 - er.top) * scale), y1 = Math.round((r.bottom - 2 - er.top) * scale);
    if (x1 <= x0 || y1 <= y0 || x0 < 0 || y0 < 0 || x1 > cv.width || y1 > cv.height) continue;
    const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data; let ink = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 330) ink++;
    checked++;
    if (ink > Math.max(8, (x1 - x0) * (y1 - y0) * 0.006)) issues.push(`"${e.textContent.trim().slice(0, 24)}" ตัวหนังสือยื่นเกินความกว้างจริง`);
  }
  return { issues, checked };
}
/** วาดหน้าลงภาพ + ตรวจตัวหนังสือเพี้ยน (ลองใหม่ได้ 3 ครั้ง) — ถ้ายังเพี้ยนจะไม่ส่งภาพที่เสียไปใส่ไฟล์ */
async function capturePage(el, opts) {
  await waitVisible(); let last = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const cv = await window.html2canvas(el, opts);
    const r = textFidelityIssues(el, cv, opts.scale || 1); last = r.issues;
    if (!last.length) return cv;
    console.warn('capturePage: ตัวหนังสือเพี้ยน ลองใหม่ครั้งที่', attempt + 2, last.slice(0, 3));
    await new Promise((res) => setTimeout(res, 500)); await waitVisible();
  }
  throw Object.assign(new PdfAuditError(last.map((x) => '[วาดภาพ] ' + x)), { kind: 'render' });
}
const PDF_SCALE = 3; // ความละเอียดภาพ PDF (เท่าของหน้าจอ) — 3 ให้ตัวอักษรไทยคมชัดตอนซูม
const PDF_PAGE_W = 1047, PDF_PAGE_H = 718; // พื้นที่พิมพ์ A4 แนวนอน (277 × 190 มม. ที่ 96dpi) — ทุกหน้าของทุกไฟล์ขนาดเท่ากัน
/** ดึงข้อมูลยา (และบันทึกการกินของเดือนที่จะพิมพ์) ล่าสุดจากฐานข้อมูลก่อนสร้างไฟล์ เผื่อมีการแก้จากเครื่องอื่น */
async function refreshForPdf(ym) {
  try {
    if (DB.mode !== 'supabase') return;
    const { data, error } = await DB.sb.from('medications').select('*').order('sort_order'); if (!error && data) S.medications = data;
    if (ym) { const r = await DB.loadMonthLogs(ym); S.med_logs = S.med_logs.filter((l) => !String(l.log_date).startsWith(ym)).concat(r.med_logs); }
  } catch (e) { console.warn('refreshForPdf', e); }
}
/** แบ่งตารางที่ยาวเกิน 1 หน้า เป็นหลายหน้า (แต่ละหน้ามีหัวเรื่อง+หัวตารางซ้ำ) */
function splitPrintSection(sec, maxH) {
  const table = sec.querySelector('table'); if (!table) return [sec];
  const tb = table.tBodies[0]; const rows = [...tb.rows]; const hs = rows.map((r) => r.getBoundingClientRect().height);
  const fixed = sec.getBoundingClientRect().height - tb.getBoundingClientRect().height; const avail = Math.max(120, maxH - fixed);
  const chunks = []; let cur = [], h = 0;
  rows.forEach((r, i) => { if (cur.length && h + hs[i] > avail) { chunks.push(cur); cur = []; h = 0; } cur.push(i); h += hs[i]; });
  if (cur.length) chunks.push(cur);
  if (chunks.length <= 1) return [sec];
  return chunks.map((idx) => { const c = sec.cloneNode(true); [...c.querySelector('table').tBodies[0].rows].forEach((r, i) => { if (!idx.includes(i)) r.remove(); }); return c; });
}
/** html2canvas คัดลอกหน้าไปเรนเดอร์ในเอกสารใหม่ — ถ้าฟอนต์ในสำเนายังโหลดไม่ครบ ตัวหนังสือจะถูกวัดด้วยฟอนต์สำรองแล้ววาดด้วย Sarabun ทำให้ช่องไฟเพี้ยน (เช่น "เมื่อ มี อาการ")
 *  จึงรอให้ฟอนต์ทุกน้ำหนักในสำเนาโหลดเสร็จก่อนเสมอ */
async function preloadCloneFonts(cdoc) {
  const t0 = Date.now();
  while (![...cdoc.fonts].some((f) => /Sarabun/.test(f.family)) && Date.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 100));
  const sample = 'เมื่อมีอาการ ก่อนอาหาร เก็บในที่ทึบแสง 0123456789 Abc';
  await Promise.all(['Sarabun', 'Prompt'].flatMap((fam) => ['400', '500', '600', '700', '800'].map((w) => cdoc.fonts.load(`${w} 16px ${fam}`, sample).catch(() => null))));
  await Promise.race([cdoc.fonts.ready, new Promise((r) => setTimeout(r, 4000))]);
  await new Promise((r) => setTimeout(r, 80));
}
/** สร้างหน้า PDF ในกรอบซ่อน (iframe) → แบ่งหน้า → ล็อกขนาดทุกหน้าเท่ากัน → ใส่เลขหน้า — คืน { ifr, doc, pages } (ผู้เรียกต้อง ifr.remove()) */
async function buildPdfFrame(sectionsHtml) {
  const css = await (await fetch('styles.css?v=' + Date.now())).text();
  const ifr = document.createElement('iframe'); ifr.setAttribute('aria-hidden', 'true'); ifr.style.cssText = `position:fixed;left:-12000px;top:0;width:${PDF_PAGE_W}px;height:1200px;border:0`;
  document.body.appendChild(ifr);
  const doc = ifr.contentDocument; doc.open();
  doc.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}"><style>${css.replace(/@media print/g, '@media all').replace(/@page[^{]*\{[^}]*\}/g, '')}</style><style>html,body{margin:0!important;padding:0!important;width:${PDF_PAGE_W}px;background:#fff!important;color:#000;font-family:Sarabun,Prompt,sans-serif}.pr-page{break-after:auto!important;width:${PDF_PAGE_W}px;background:#fff}</style></head><body>${sectionsHtml}</body></html>`);
  doc.close();
  await Promise.race([new Promise((r) => { const l = doc.querySelector('link'); if (!l) return r(); l.onload = r; l.onerror = r; }), new Promise((r) => setTimeout(r, 5000))]);
  await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 4000))]); await new Promise((r) => setTimeout(r, 300));
  const pages = []; [...doc.querySelectorAll('.pr-page')].forEach((sec) => (sec.dataset.kind === 'summary' ? [sec] : splitPrintSection(sec, PDF_PAGE_H)).forEach((s) => pages.push(s)));
  doc.body.innerHTML = ''; pages.forEach((s) => { s.style.height = `${PDF_PAGE_H}px`; doc.body.appendChild(s); });
  pages.forEach((s, i) => { const pg = s.querySelector('.pr-pg'); if (pg) pg.textContent = `หน้า ${i + 1}/${pages.length}`; });
  return { ifr, doc, pages };
}

/** ตรวจหน้า PDF ที่สร้างแล้ว — คืนรายการปัญหา (ว่าง = ผ่าน) ctx: { kind:'meds', p, meds, mode } หรือ { kind:'summary', p, ym } */
function auditFrame(frame, ctx) {
  const { pages } = frame; const issues = []; const nz = normTxt; const p = ctx.p; const pre = medPrefix(p.id);
  if (!pages.length) issues.push('ไม่มีหน้าเลย');
  // ก) แบบฟอร์มเหมือนกันทุกหน้า: ขนาด หัวกระดาษ ท้ายกระดาษ เลขหน้า ไม่ซ้อนกับตาราง
  pages.forEach((pg, pi) => {
    const r = pg.getBoundingClientRect(); const tag = `หน้า ${pi + 1}`;
    if (Math.abs(r.height - PDF_PAGE_H) > 1 || Math.abs(r.width - PDF_PAGE_W) > 1) issues.push(`${tag}: ขนาด ${Math.round(r.width)}×${Math.round(r.height)} ไม่ใช่ ${PDF_PAGE_W}×${PDF_PAGE_H}`);
    const h1 = pg.querySelector('.pr-top h1'); const boxes = pg.querySelectorAll('.pr-boxes span'); const foot = pg.querySelector('.pr-foot'); const pgNo = pg.querySelector('.pr-pg');
    if (!h1 || !nz(h1.textContent).includes(p.name)) issues.push(`${tag}: หัวเรื่องไม่มีชื่อ "${p.name}"`);
    if (boxes.length !== 2) issues.push(`${tag}: กล่องหัวกระดาษต้องมี 2 ช่อง (มี ${boxes.length})`);
    const upd = boxes[1]?.textContent || ''; if (!/^UPD: .+ เวลา \d{2}:\d{2} น\.$/.test(nz(upd))) issues.push(`${tag}: UPD ไม่ครบวันที่/เวลา "${nz(upd)}"`);
    const want = latestUpdate(medsOf(p.id)); if (want && !nz(upd).includes(thDateTime(want))) issues.push(`${tag}: UPD ไม่ตรงกับเวลาแก้ยาล่าสุด`);
    if (!foot || !/สร้างไฟล์เมื่อ .+ เวลา \d{2}:\d{2} น\./.test(nz(foot.textContent))) issues.push(`${tag}: ท้ายกระดาษไม่มีเวลาสร้างไฟล์`);
    if (!foot || !nz(foot.textContent).includes(PDF_APP_NOTE)) issues.push(`${tag}: ท้ายกระดาษไม่มีข้อความเตือน`);
    if (!foot || !nz(foot.textContent).includes('© 2026 สุขใจ (Sookjai)')) issues.push(`${tag}: ท้ายกระดาษไม่มีข้อความลิขสิทธิ์`);
    if (nz(pgNo?.textContent) !== `หน้า ${pi + 1}/${pages.length}`) issues.push(`${tag}: เลขหน้าไม่ตรง "${nz(pgNo?.textContent)}"`);
    if (foot) { const fr = foot.getBoundingClientRect(); if (fr.bottom > r.bottom + 1) issues.push(`${tag}: ท้ายกระดาษล้นออกนอกหน้า`);
      pg.querySelectorAll('table, .pr-note, .pr-cols').forEach((t) => { if (t.getBoundingClientRect().bottom > fr.top + 1) issues.push(`${tag}: เนื้อหาชนท้ายกระดาษ`); }); }
    pg.querySelectorAll('td, th').forEach((c) => {
      const cr = c.getBoundingClientRect(); const lab = nz(c.textContent).slice(0, 30);
      if (c.scrollWidth > c.clientWidth + 1) issues.push(`${tag}: ข้อความล้นกว้างในช่อง "${lab}"`);
      const kids = [...c.querySelectorAll('.pr-wn, .pr-main, .pr-nm, .pr-as, em, .pr-r, .pr-no, .pr-dz')].filter((k) => k.textContent.trim());
      kids.forEach((k) => { const kr = k.getBoundingClientRect(); if (kr.right > cr.right + 1 || kr.left < cr.left - 1 || kr.bottom > cr.bottom + 1 || kr.top < cr.top - 1) issues.push(`${tag}: "${nz(k.textContent).slice(0, 30)}" ล้นออกนอกช่อง`); });
      const blocks = [...c.querySelectorAll('.pr-wn, .pr-main, .pr-nm, .pr-as, em, .pr-r')].filter((k) => k.textContent.trim());
      for (let a = 0; a < blocks.length; a++) for (let b = a + 1; b < blocks.length; b++) {
        const A = blocks[a].getBoundingClientRect(), B = blocks[b].getBoundingClientRect();
        if (Math.min(A.right, B.right) - Math.max(A.left, B.left) > 1 && Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) > 1) issues.push(`${tag}: "${nz(blocks[a].textContent).slice(0, 20)}" ซ้อนทับ "${nz(blocks[b].textContent).slice(0, 20)}"`);
      }
    });
  });
  if (ctx.kind === 'summary') {
    const D = adherenceData(p.id, ctx.ym); const pg = pages[0]; const txt = nz(pg?.textContent || '');
    if (pages.length !== 1) issues.push(`สรุปการกินยาต้องมี 1 หน้า (มี ${pages.length})`);
    if (!txt.includes(`กินยาตรงเวลา ${D.got} / ${D.exp} ครั้ง`)) issues.push(`สรุป: ยอดรวมไม่ตรง (ควร ${D.got} / ${D.exp})`);
    const weekRows = [...(pg?.querySelectorAll('.pr-cols table')[0]?.querySelectorAll('tbody tr') || [])].map((tr) => [...tr.children].map((c) => nz(c.textContent)));
    const nW = Math.ceil(D.days.length / 7); if (weekRows.length !== nW) issues.push(`สรุป: จำนวนสัปดาห์ ${weekRows.length} ควรเป็น ${nW}`);
    weekRows.forEach((r, w) => { const part = D.days.slice(w * 7, w * 7 + 7); const e = part.reduce((a, x) => a + (x.exp || 0), 0), g = part.reduce((a, x) => a + (x.got || 0), 0);
      if (r[1] !== `${g} / ${e}` || r[2] !== pctText(g, e)) issues.push(`สรุป สัปดาห์ ${w + 1}: PDF ${r[1]} ${r[2]} ควรเป็น ${g} / ${e} ${pctText(g, e)}`); });
    if (weekRows.reduce((a, r) => a + Number(String(r[1]).split(' / ')[1]), 0) !== D.exp) issues.push('สรุป: ผลรวมสัปดาห์ไม่เท่ายอดรวม');
    const slotRows = [...(pg?.querySelectorAll('.pr-cols table')[1]?.querySelectorAll('tbody tr') || [])].map((tr) => [...tr.children].map((c) => nz(c.textContent)));
    SLOTS.filter((s) => D.perSlot[s.key]).forEach((s, i) => { const v = D.perSlot[s.key]; const r = slotRows[i] || [];
      if (r[0] !== s.label || r[1] !== `${v.got} / ${v.exp}` || r[2] !== pctText(v.got, v.exp)) issues.push(`สรุป ช่วง ${s.label}: PDF [${r}] ควรเป็น ${v.got} / ${v.exp} ${pctText(v.got, v.exp)}`); });
    const missTop = D.perMed.filter((x) => x.got < x.exp).map((x) => [x.m.id, x.exp - x.got]).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const missRows = [...(pg?.querySelectorAll('.pr-cols table')[2]?.querySelectorAll('tbody tr') || [])].map((tr) => [...tr.children].map((c) => nz(c.textContent)));
    if (missRows.length !== missTop.length) issues.push(`สรุป: ยาที่ยังไม่มีบันทึกบ่อย ${missRows.length} แถว ควร ${missTop.length}`);
    missTop.forEach(([id, c], i) => { const m = S.medications.find((x) => x.id === id); const r = missRows[i] || [];
      if (r[0] !== medNo(m) || r[1] !== nz(m.name) || r[2] !== `${c} ครั้ง`) issues.push(`สรุป ยาที่ยังไม่มีบันทึกบ่อย อันดับ ${i + 1}: PDF [${r}] ควรเป็น [${medNo(m)}, ${m.name}, ${c} ครั้ง]`); });
    if (D.exp && !txt.includes(`${Math.round((D.got / D.exp) * 100)}%`)) issues.push('สรุป: ร้อยละรวมไม่ตรง');
  }
  return issues;
}
class PdfAuditError extends Error { constructor(issues) { super('PDF_AUDIT_FAILED'); this.issues = issues; } }
const frameSig = (f) => f.pages.map((s) => s.outerHTML.replace(/สร้างไฟล์เมื่อ[^<]*/g, '')).join('\n');

/** สร้างไฟล์ PDF แบบตรวจ 3 รอบ: (1) ตรวจโครงสร้าง+ข้อมูลทุกช่อง (2) สร้างซ้ำใหม่ทั้งหมด ต้องเหมือนเดิมทุกตัวอักษรและผ่านซ้ำ (3) ตรวจภาพที่เรนเดอร์ ขนาดเท่ากันทุกหน้า ไม่ใช่หน้าว่าง */
async function renderVerifiedPdf(buildSections, ctx) {
  const jsPDF = await loadPdfLibs();
  const f1 = await buildPdfFrame(buildSections());
  try {
    const i1 = auditFrame(f1, ctx); if (i1.length) throw new PdfAuditError(i1.map((x) => '[รอบ 1] ' + x));
    const f2 = await buildPdfFrame(buildSections());
    try { const i2 = auditFrame(f2, ctx); const same = frameSig(f1) === frameSig(f2); if (i2.length || !same) throw new PdfAuditError([...i2.map((x) => '[รอบ 2] ' + x), ...(same ? [] : ['[รอบ 2] สร้างซ้ำแล้วได้ผลไม่เหมือนรอบแรก'])]); }
    finally { f2.ifr.remove(); }
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); const i3 = [];
    for (let i = 0; i < f1.pages.length; i++) {
      const cv = await capturePage(f1.pages[i], { scale: PDF_SCALE, backgroundColor: '#fff', useCORS: true, windowWidth: PDF_PAGE_W, onclone: preloadCloneFonts });
      if (cv.width !== PDF_PAGE_W * PDF_SCALE || cv.height !== PDF_PAGE_H * PDF_SCALE) i3.push(`[รอบ 3] หน้า ${i + 1}: ภาพ ${cv.width}×${cv.height} ไม่ใช่ ${PDF_PAGE_W * PDF_SCALE}×${PDF_PAGE_H * PDF_SCALE}`);
      const t = document.createElement('canvas'); t.width = 210; t.height = 144; const tc = t.getContext('2d'); tc.drawImage(cv, 0, 0, 210, 144); const d = tc.getImageData(0, 0, 210, 144).data; let ink = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 690) ink++;
      if (ink / (210 * 144) < 0.02) i3.push(`[รอบ 3] หน้า ${i + 1}: ภาพแทบว่าง (มีหมึก ${(100 * ink / (210 * 144)).toFixed(1)}%)`);
      if (i > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', 10, 10, 277, 190);
    }
    if (i3.length) throw new PdfAuditError(i3);
    return { pdf, pages: f1.pages.length };
  } finally { f1.ifr.remove(); }
}
function pdfFail(e, fallback) {
  console.error(e, e.issues);
  if (e instanceof PdfAuditError && e.kind === 'render') { toast('ตัวหนังสือในไฟล์ยังวาดไม่สมบูรณ์ จึงยังไม่บันทึกไฟล์ — เปิดหน้าแอปค้างไว้แล้วลองกดอีกครั้ง'); return; }
  if (e instanceof PdfAuditError) { toast('⚠️ ตรวจพบข้อมูลไม่ตรงในไฟล์ PDF จึงยังไม่บันทึกไฟล์ — กรุณาแจ้งผู้ดูแลระบบ'); return; }
  toast('สร้าง PDF ตรงๆ ไม่ได้ — เปิดหน้าต่างพิมพ์แทน (เลือก "บันทึกเป็น PDF")'); fallback();
}
/** ตรวจข้อมูลในเอกสารพิมพ์ (ตารางรหัสยา + รายการยา) ให้ตรงกับข้อมูลยาในแอปทุกช่อง — คืนรายการปัญหา (ว่าง = ผ่าน) */
function auditMedsDoc(root, p, meds) {
  const nz = normTxt; const issues = []; const sum = (el) => nz(el?.textContent);
  const grid = root.querySelector('section[data-kind="grid"]'); const list = root.querySelector('section[data-kind="list"]');
  if (!grid || !list) return ['ไม่มีตารางรหัสยาหรือรายการยา'];
  const ft = sum(root.querySelector('.mp-foot'));
  if (!/สร้างไฟล์เมื่อ .+ เวลา \d{2}:\d{2} น\./.test(ft) || !ft.includes(PDF_APP_NOTE) || !ft.includes('© 2026 สุขใจ (Sookjai)')) issues.push(`ท้ายกระดาษไม่ครบ (เวลาสร้างไฟล์/ข้อความเตือน/ลิขสิทธิ์) "${ft}"`);
  [grid, list].forEach((sec) => {
    const k = sec.dataset.kind; const boxes = sec.querySelectorAll('.mp-boxes span');
    if (!sum(sec.querySelector('h1')).includes(p.name)) issues.push(`${k}: หัวเรื่องไม่มีชื่อ "${p.name}"`);
    if (boxes.length !== 2) issues.push(`${k}: กล่องหัวกระดาษต้องมี 2 ช่อง`);
    if (!/^UPD: .+ เวลา \d{2}:\d{2} น\.$/.test(sum(boxes[1]))) issues.push(`${k}: UPD ไม่ครบวันที่/เวลา "${sum(boxes[1])}"`);
    const want = latestUpdate(meds); if (want && !sum(boxes[1]).includes(thDateTime(want))) issues.push(`${k}: UPD ไม่ตรงกับเวลาแก้ยาล่าสุด`);
    sec.querySelectorAll('.mp-cb').forEach((b) => { if (b.getAttribute('style')) issues.push(`${k}: รหัส "${sum(b)}" ต้องไม่มีสีพื้นหลัง`); });
  });
  // ตารางรหัสยา: แสดงเฉพาะช่วงที่มียา · เนื้อหาทุกช่องตรงกับยา · แดงเฉพาะข้อควรระวัง
  const used = SLOTS.filter((s) => meds.some((m) => m.slots.includes(s.key)));
  const ths = [...grid.querySelectorAll('tr.mp-hd th')];
  if (ths.length !== Math.max(1, used.length)) issues.push(`ตารางรหัสยา: มี ${ths.length} คอลัมน์ ควรเป็น ${Math.max(1, used.length)} (ซ่อนช่วงที่ไม่มียา)`);
  const trs = [...grid.querySelectorAll('tbody tr')];
  used.forEach((s, ci) => {
    const th = ths[ci]; if (!sum(th).includes(nz(s.short.replace(/^(ก่อน|หลัง)/, ''))) || !sum(th).includes(slotTime(s.key))) issues.push(`ตารางรหัสยา: หัวคอลัมน์ ${s.label} ไม่ตรง "${sum(th)}"`);
    const exp = meds.filter((m) => m.slots.includes(s.key));
    const cells = trs.map((tr) => tr.children[ci]).filter((c) => c && c.querySelector('.mp-cb'));
    if (cells.length !== exp.length) { issues.push(`ตารางรหัสยา ช่วง ${s.label}: ในแอป ${exp.length} ตัว ใน PDF ${cells.length}`); return; }
    exp.forEach((m, i) => { const c = cells[i]; const parts = remarkParts(m); const lab = `${medNo(m)} (${s.label})`;
      if (sum(c.querySelector('.mp-cb')) !== medNo(m)) issues.push(`ตารางรหัสยา ${lab}: รหัสไม่ตรง`);
      if (sum(c.querySelector('.mp-nm')) !== nz(printName(medShort(m)))) issues.push(`ตารางรหัสยา ${lab}: ชื่อไม่ตรง "${sum(c.querySelector('.mp-nm'))}"`);
      if (!!c.querySelector('.mp-st') !== !!m.as_needed || c.classList.contains('pn') !== !!m.as_needed) issues.push(`ตารางรหัสยา ${lab}: สถานะ "กินเมื่อมีอาการ" ไม่ตรง`);
      const dz = num(m.dose, 1) !== 1 ? nz(`${doseLabel(m.dose)} ${unitOf(m)}`) : ''; if (sum(c.querySelector('.mp-dz')) !== dz) issues.push(`ตารางรหัสยา ${lab}: จำนวนไม่ตรง`);
      const w = [...c.querySelectorAll('.mp-w')].map(sum); const h = [...c.querySelectorAll('.mp-h')].map(sum);
      if (JSON.stringify(w) !== JSON.stringify(parts.filter((x) => x.kind === 'warn').map((x) => x.t))) issues.push(`ตารางรหัสยา ${lab}: ข้อควรระวังไม่ตรง [${w}]`);
      if (JSON.stringify(h) !== JSON.stringify(parts.filter((x) => x.kind === 'hint').map((x) => x.t))) issues.push(`ตารางรหัสยา ${lab}: คำกำกับไม่ตรง [${h}]`);
      if (c.classList.contains('wr') !== !!w.length) issues.push(`ตารางรหัสยา ${lab}: สีเหลืองไม่ตรงกับข้อควรระวัง`);
      if (/\s{2,}|[ ​]/.test(c.querySelector('.mp-nm').textContent.replace(/\n/g, ' '))) issues.push(`ตารางรหัสยา ${lab}: ชื่อมีช่องว่างแปลก`);
    });
  });
  // รายการยา
  if (sum(list.querySelector('tr.mp-hd th')) !== 'รหัสยา') issues.push('รายการยา: หัวคอลัมน์แรกต้องเป็น "รหัสยา"');
  const rows = [...list.querySelectorAll('tbody tr')];
  if (rows.length !== meds.length) issues.push(`รายการยา: ในแอป ${meds.length} ตัว ใน PDF ${rows.length} แถว`);
  meds.forEach((m, i) => { const tds = rows[i] ? [...rows[i].children] : []; const t = tds.map(sum); const lab = `${medNo(m)} ${m.name}`;
    [medNo(m), nz(printName(m.name)), nz(printName(m.purpose || '')), nz(`${doseLabel(m.dose)} ${unitOf(m)}`), nz(medWhen(m))].forEach((w, k) => { if ((t[k] || '') !== w) issues.push(`รายการยา ${lab}: คอลัมน์ ${k + 1} ควรเป็น "${w}" แต่เป็น "${t[k]}"`); });
    const parts = remarkParts(m); const rs = tds[5] ? [...tds[5].querySelectorAll('.mp-r')] : [];
    if (JSON.stringify(parts.map((x) => x.t)) !== JSON.stringify(rs.map(sum))) issues.push(`รายการยา ${lab}: หมายเหตุไม่ตรง [${parts.map((x) => x.t)}] vs [${rs.map(sum)}]`);
    parts.forEach((x, k) => { if (rs[k] && rs[k].classList.contains('is-warn') !== (x.kind === 'warn')) issues.push(`รายการยา ${lab}: สีหมายเหตุ "${x.t}" ไม่ตรง (แดงเฉพาะข้อควรระวัง)`); });
    const got = rs.map(sum); got.forEach((a, x) => got.forEach((b, y) => { if (x !== y && a.includes(b)) issues.push(`รายการยา ${lab}: ข้อความ "${b}" ซ้อนอยู่ใน "${a}"`); }));
  });
  const oral = meds.filter(isOralMed).length; const s1 = sum(list.querySelector('.mp-boxes span'));
  if (!s1.includes(`ยาทาน ${oral} ตัว`) || !s1.includes(`ยาอื่นๆ ${meds.length - oral} ตัว`)) issues.push(`รายการยา: หัวกระดาษไม่ระบุจำนวนยาทาน/ยาอื่นๆ ให้ตรง "${s1}"`);
  return issues;
}
/** เตรียมข้อมูลยา + ตรวจให้ตรงกับในแอป — คืน { p, meds } หรือ null (แจ้งผู้ใช้แล้ว) */
async function prepMedsDoc(pid) {
  await refreshForPdf(); const p = profileById(pid); const meds = medsOf(pid);
  if (!p || !meds.length) { toast('ยังไม่มียาให้สร้างไฟล์'); return null; }
  const box = document.createElement('div'); box.innerHTML = mpDoc(p, meds);
  const issues = auditMedsDoc(box, p, meds);
  if (issues.length) { console.error('auditMedsDoc', issues); toast('⚠️ ตรวจพบข้อมูลไม่ตรงในไฟล์ PDF จึงยังไม่สร้างไฟล์ — กรุณาแจ้งผู้ดูแลระบบ'); return null; }
  return { p, meds };
}
/** ปุ่ม "🖨️ พิมพ์": เปิดหน้าพิมพ์ของเบราว์เซอร์ (เลือก "บันทึกเป็น PDF" ได้) — ได้ตัวหนังสือจริง ก๊อปข้อความได้ */
async function printMedsText(pid) {
  toast('กำลังเตรียมหน้าพิมพ์…');
  const d = await prepMedsDoc(pid); if (!d) return;
  let area = document.getElementById('printArea'); if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
  area.innerHTML = mpDoc(d.p, d.meds);
  const sample = 'เมื่อมีอาการ ก่อนอาหาร เก็บในที่ทึบแสง 0123456789 Abc';
  await Promise.race([Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 16px Sarabun`, sample).catch(() => null))), new Promise((r) => setTimeout(r, 4000))]);
  printNow('printing', 'landscape', { title: `ตารางยา-${d.p.name}-${todayKey()}`, pageNo: true });
}
/** ปุ่ม "📄 ไฟล์ PDF": สร้างไฟล์แล้วดาวน์โหลดทันที (หน้าตาเดียวกับหน้าพิมพ์ — เรนเดอร์เป็นภาพ ความละเอียด 2 เท่า บีบให้ไฟล์เล็ก) */
const MP_SCALE = 2, MP_JPEG = 0.8;
/** ตารางกินยา 1 วัน: วาดหน้าด้วยโค้ดโดยตรง (pdfcanvas.js) — ถ้าวาดไม่สำเร็จค่อยใช้วิธีสำรอง (html2canvas) */
async function makeMedsPdf(pid) {
  const d = await prepMedsDoc(pid); if (!d) return null;
  try {
    const jsPDF = await loadPdfLibs(); const { canvases, pages, portraits, issues } = await renderMedsCanvases(d.p, d.meds);
    if (issues.length) throw new PdfAuditError(issues.map((x) => '[วาดตรง] ' + x)); // ข้อมูลไม่ตรง/ข้อความล้น = ไม่ใช้ภาพนี้ (ไปวิธีสำรองที่ตรวจซ้ำอีกชั้น)
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    canvases.forEach((cv, i) => {
      const port = !!portraits[i]; const tw = port ? 144 : 210, th = port ? 210 : 144;
      const t = document.createElement('canvas'); t.width = tw; t.height = th; const tc = t.getContext('2d'); tc.drawImage(cv, 0, 0, tw, th); const px = tc.getImageData(0, 0, tw, th).data; let ink = 0;
      for (let k = 0; k < px.length; k += 4) if (px[k] + px[k + 1] + px[k + 2] < 690) ink++;
      if (ink / (tw * th) < 0.02) throw new PdfAuditError([`หน้า ${i + 1}: ภาพแทบว่าง`]);
      const o = port ? 'portrait' : 'landscape'; if (i > 0) pdf.addPage('a4', o); pdf.addImage(cv.toDataURL('image/jpeg', 0.85), 'JPEG', 10, 10, port ? 190 : 277, port ? 277 : 190);
    });
    return { pdf, pages, name: `ตารางยา-${d.p.name}-${todayKey()}.pdf` };
  } catch (e) { console.warn('วาดตารางตรงไม่สำเร็จ ใช้วิธีสำรอง', e); return makeMedsPdfHtml(pid); }
}
async function makeMedsPdfHtml(pid) {
  const d = await prepMedsDoc(pid); if (!d) return null;
  const { p, meds } = d; const jsPDF = await loadPdfLibs();
  const css = await (await fetch('styles.css?v=' + Date.now())).text();
  const ifr = document.createElement('iframe'); ifr.setAttribute('aria-hidden', 'true'); ifr.style.cssText = `position:fixed;left:-12000px;top:0;width:${PDF_PAGE_W}px;height:1200px;border:0`; document.body.appendChild(ifr);
  try {
    const doc = ifr.contentDocument; doc.open();
    doc.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><link rel="stylesheet" href="${new URL('fonts/fonts.css', location.href).href}"><style>${css.replace(/@media print/g, '@media all').replace(/@page[^{]*\{[^}]*\}/g, '')}</style><style>html,body{margin:0!important;padding:0!important;width:${PDF_PAGE_W}px;background:#fff!important}.mp-root{font-feature-settings:normal!important;text-wrap:wrap!important;letter-spacing:normal!important;word-spacing:normal!important;font-kerning:auto!important}.mp-root *{letter-spacing:normal!important;word-spacing:normal!important}.mp-root *{text-wrap:wrap!important}.mp-sp{display:none!important}.mp-sec{break-after:auto!important}.mp-foot{display:none!important}.rp{position:relative;width:${PDF_PAGE_W}px;height:${PDF_PAGE_H}px;overflow:hidden;background:#fff}.rp .mp-foot{display:flex!important;position:absolute;left:0;right:0;bottom:0;justify-content:space-between;gap:14px}.rp .mp-foot b{flex:none;font-size:10pt;font-weight:700;color:#000;white-space:nowrap}</style></head><body><div id="printArea" style="display:block">${mpDoc(p, meds)}</div></body></html>`);
    doc.close();
    await Promise.race([new Promise((r) => { const l = doc.querySelector('link'); if (!l) return r(); l.onload = r; l.onerror = r; }), new Promise((r) => setTimeout(r, 5000))]);
    await Promise.all(['400', '500', '600', '700'].map((w) => doc.fonts.load(`${w} 16px Sarabun`, 'เมื่อมีอาการ ก่อนอาหาร 0123 Abc').catch(() => null)));
    await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 4000))]); await new Promise((r) => setTimeout(r, 300));
    const root = doc.querySelector('.mp-root'); const foot = root.querySelector('.mp-foot'); const FOOT_H = 36;
    const pages = [];
    root.querySelectorAll('.mp-sec').forEach((sec) => {
      const tb = sec.querySelector('tbody'); const rows = [...tb.rows]; const hs = rows.map((r) => r.getBoundingClientRect().height);
      const avail = Math.max(120, PDF_PAGE_H - FOOT_H - (sec.getBoundingClientRect().height - tb.getBoundingClientRect().height));
      const chunks = []; let cur = [], h = 0;
      rows.forEach((r, i) => { if (cur.length && h + hs[i] > avail) { chunks.push(cur); cur = []; h = 0; } cur.push(i); h += hs[i]; });
      if (cur.length) chunks.push(cur);
      chunks.forEach((idx, ci) => { const c = sec.cloneNode(true); [...c.querySelector('tbody').rows].forEach((r, i) => { if (!idx.includes(i)) r.remove(); }); if (ci < chunks.length - 1) c.querySelector('.mp-loose')?.remove(); pages.push(c); });
    });
    doc.body.innerHTML = '';
    const wraps = pages.map((c, i) => { const w = doc.createElement('div'); w.className = 'rp'; const r = root.cloneNode(false); r.appendChild(c); const f = foot.cloneNode(true); f.innerHTML = `<span>${f.innerHTML}</span><b>หน้า ${i + 1}/${pages.length}</b>`; r.appendChild(f); w.appendChild(r); doc.body.appendChild(w); return w; });
    // ตรวจเค้าโครง: ไม่ล้นช่อง ไม่ชนท้ายกระดาษ ขนาดหน้าเท่ากัน
    const issues = [];
    wraps.forEach((w, i) => { const wr = w.getBoundingClientRect(); const fr = w.querySelector('.mp-foot').getBoundingClientRect(); const t = w.querySelector('.mp-t').getBoundingClientRect(); const lo = w.querySelector('.mp-loose')?.getBoundingClientRect();
      if (Math.abs(wr.height - PDF_PAGE_H) > 1) issues.push(`หน้า ${i + 1}: สูง ${Math.round(wr.height)}`);
      if (Math.max(t.bottom, lo ? lo.bottom : 0) > fr.top + 1) issues.push(`หน้า ${i + 1}: เนื้อหาชนท้ายกระดาษ`);
      if (fr.bottom > wr.bottom + 1) issues.push(`หน้า ${i + 1}: ท้ายกระดาษล้นหน้า`);
      w.querySelectorAll('td, th').forEach((c) => { if (c.scrollWidth > c.clientWidth + 1) issues.push(`หน้า ${i + 1}: ข้อความล้นช่อง "${c.textContent.trim().slice(0, 20)}"`); }); });
    if (issues.length) throw new PdfAuditError(issues);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    for (let i = 0; i < wraps.length; i++) {
      const cv = await capturePage(wraps[i], { scale: MP_SCALE, backgroundColor: '#fff', useCORS: true, windowWidth: PDF_PAGE_W, onclone: preloadCloneFonts });
      if (cv.width !== PDF_PAGE_W * MP_SCALE || cv.height !== PDF_PAGE_H * MP_SCALE) throw new PdfAuditError([`หน้า ${i + 1}: ภาพ ${cv.width}×${cv.height} ขนาดไม่ถูกต้อง`]);
      const t = document.createElement('canvas'); t.width = 210; t.height = 144; const tc = t.getContext('2d'); tc.drawImage(cv, 0, 0, 210, 144); const px = tc.getImageData(0, 0, 210, 144).data; let ink = 0;
      for (let k = 0; k < px.length; k += 4) if (px[k] + px[k + 1] + px[k + 2] < 690) ink++;
      if (ink / (210 * 144) < 0.02) throw new PdfAuditError([`หน้า ${i + 1}: ภาพแทบว่าง`]);
      if (i > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(cv.toDataURL('image/jpeg', MP_JPEG), 'JPEG', 10, 10, 277, 190);
    }
    return { pdf, pages: wraps.length, name: `ตารางยา-${p.name}-${todayKey()}.pdf` };
  } finally { ifr.remove(); }
}
async function downloadMedsPdf(pid) {
  toast('กำลังสร้างและตรวจสอบไฟล์ PDF…');
  try { const r = await makeMedsPdf(pid); if (!r) return; r.pdf.save(r.name); toast('✓ ตรวจสอบแล้ว บันทึกไฟล์ PDF เรียบร้อย'); }
  catch (e) { console.error(e, e.issues); pdfFail(e, () => {}); }
}
/** ตรวจ PDF ทุกคน ทุกแบบ ซ้ำหลายรอบ (ใช้ใน console: await auditAllPdfs(3)) */
async function auditAllPdfs(rounds = 3) {
  const out = []; await loadPdfLibs();
  for (let r = 1; r <= rounds; r++) {
    for (const p of S.profiles.filter((x) => medsOf(x.id).length)) {
      const meds = medsOf(p.id); const box = document.createElement('div'); box.innerHTML = mpDoc(p, meds);
      out.push({ round: r, who: p.name, kind: 'meds', pages: 0, issues: auditMedsDoc(box, p, meds) });
      { const cr = await renderMedsCanvases(p, meds); out.push({ round: r, who: p.name, kind: 'meds-canvas', pages: cr.pages, issues: cr.issues }); }
      const ym = ymOf(new Date()); const g = await buildPdfFrame(printSummaryHtml(p, ym));
      try { out.push({ round: r, who: p.name, kind: 'summary', pages: g.pages.length, issues: auditFrame(g, { kind: 'summary', p, ym }) }); } finally { g.ifr.remove(); }
    }
  }
  return { ok: out.every((x) => !x.issues.length), checks: out.length, failed: out.filter((x) => x.issues.length) };
}
