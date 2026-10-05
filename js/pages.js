/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ v1.2 — หน้าจอตามดีไซน์ใหม่: ภาพรวมวันนี้ · เมนูยา · สรุปการกินยา/อารมณ์ (ดูย้อนหลังได้) · สมาชิก · ตั้งค่า */
'use strict';

const APP_VERSION = '1.2.0';
// โลโก้: ขวดยาสี 4 สีหลัก (เขียว มิ้นต์ ส้ม เหลือง) วาดเป็น SVG — ขยับด้วย CSS (ปิดอัตโนมัติถ้าผู้ใช้ตั้งลดการเคลื่อนไหว)
const LOGO_MARK = '<g class="lg-bottle"><path class="lg-star s1" d="M98 24l2.6 6.4 6.4 2.6-6.4 2.6L98 42l-2.6-6.4L89 33l6.4-2.6z" fill="#fff"/><path class="lg-star s2" d="M20 38l1.9 4.6 4.6 1.9-4.6 1.9L20 51l-1.9-4.6-4.6-1.9 4.6-1.9z" fill="#fff"/><rect x="39" y="12" width="42" height="20" rx="6" fill="#DAFF3A"/><rect x="39" y="20" width="42" height="5" fill="#4D55F5"/><rect x="45" y="31" width="30" height="9" rx="2" fill="#fff"/><rect class="lg-body" x="26" y="38" width="68" height="72" rx="18" fill="#fff"/><path d="M26 76q17-9 34 0t34 0v16q0 18-18 18H44q-18 0-18-18z" fill="#CA7FFE"/><rect x="32" y="46" width="5" height="30" rx="2.5" fill="#DDE0FF"/><g class="lg-cross"><rect x="53" y="46" width="14" height="34" rx="4" fill="#4D55F5"/><rect x="43" y="56" width="34" height="14" rx="4" fill="#4D55F5"/></g></g>';
const logoSvg = () => `<svg viewBox="0 0 120 120" aria-hidden="true">${LOGO_MARK}</svg>`;
/** ชื่อหน้าตามสถานะ (ใช้เขียนบนปุ่มย้อนกลับ) */
function pageTitle(s) {
  if (!s) return '';
  if (s.tab === 'today') return s.todayPage === 'mood' ? 'สรุปอารมณ์' : 'ภาพรวมวันนี้';
  if (s.tab === 'meds') return { hub: 'ยาและการดูแล', list: 'ยาที่ต้องทาน', care: 'ติดตามอาการ', summary: 'สรุปการกินยา' }[s.medsPage] || 'ยา';
  if (s.tab === 'calendar') return 'หมอนัด';
  if (s.tab === 'family') return s.memberPage && S.profiles.some((p) => p.id === s.memberPage) ? `ข้อมูลของ${profileById(s.memberPage).name}` : 'สมาชิก';
  return s.tab === 'settings' ? 'ตั้งค่า' : '';
}
/** ปุ่มย้อนกลับ: กลับไปหน้าที่เพิ่งมาจากจริงๆ (ถ้าไม่มี ใช้หน้าแม่ตามที่กำหนด) */
const backBar = (label, act, id = '') => {
  const prev = navPrevSnap(); const to = prev ? pageTitle(prev) : label;
  return `<button type="button" class="back-bar" data-act="nav-back" data-to="${act}" data-id="${id}" aria-label="ย้อนกลับไปหน้า ${esc(to)}"><span class="bb-arrow">←</span><span class="bb-txt"><b>ย้อนกลับ</b><small>ไปหน้า ${esc(to)}</small></span></button>`;
};

// ---------- ล็อกการลบ (กันมือลั่น): ล็อกไว้เสมอตอนเปิดแอพ ปลดล็อกได้ครั้งละ 2 นาที แล้วล็อกกลับเอง ----------
const delLocked = () => !(ui.delUnlockUntil && Date.now() < ui.delUnlockUntil);
let delTimer = null;
function lockToggle() {
  const lk = delLocked();
  return `<button type="button" class="lock-toggle ${lk ? 'on' : 'off'}" data-act="toggle-dellock" aria-pressed="${lk}">
    <span class="lt-ic">${lk ? '🔒' : '🔓'}</span><span class="lt-tx"><b>${lk ? 'ล็อกการลบอยู่' : 'ปลดล็อกอยู่ (ลบได้)'}</b><small>${lk ? 'กันมือลั่น · แตะเพื่อปลดล็อก 2 นาที' : 'จะล็อกกลับเองใน 2 นาที · แตะเพื่อล็อกเดี๋ยวนี้'}</small></span></button>`;
}
function setDelLock(unlock) {
  clearTimeout(delTimer);
  if (unlock) { ui.delUnlockUntil = Date.now() + 120000; delTimer = setTimeout(() => { ui.delUnlockUntil = 0; refreshLockUi(); toast('🔒 ล็อกการลบกลับแล้ว'); }, 120000); toast('🔓 ปลดล็อกการลบ 2 นาที'); }
  else { ui.delUnlockUntil = 0; toast('🔒 ล็อกการลบแล้ว'); }
  refreshLockUi();
}
function refreshLockUi() {
  const modal = document.getElementById('modal');
  if (modal && !modal.classList.contains('hidden') && ui.slipsPid && modal.querySelector('.lock-toggle')) { const y = modal.querySelector('.sheet')?.scrollTop || 0; slipsSheet(ui.slipsPid); const sh = document.querySelector('#modal .sheet'); if (sh) sh.scrollTop = y; }
  render();
}
// ---------- โหลดบันทึกย้อนหลังทีละเดือน (เดือนนี้โหลดมาแล้วตอนเปิดแอพ) ----------
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
  : { icon: '💛', head: 'พยายามอีกนิดนะ', msg: 'ไม่เป็นไรเลย ลืมกันได้ ค่อยๆ ไปด้วยกัน เป็นกำลังใจให้เสมอ' });

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
  if (!me) return `<div class="card mood-card"><b class="h-mood">วันนี้คุณเป็นยังไง?</b><p class="small muted" style="margin:0">บันทึกอารมณ์ได้เฉพาะโปรไฟล์ "ตัวฉัน" ของบัญชีนี้</p>
    <button class="btn block" data-act="add-self">+ เพิ่มโปรไฟล์ของฉัน</button></div>`;
  const cur = moodLog(me.id);
  return `<div class="card mood-card"><b class="h-mood">วันนี้คุณเป็นยังไง?</b>
    <div class="mood-pick">${MOODS.map((mo) => `<button type="button" class="mood-opt ${cur?.mood === mo.k ? 'on' : ''}" data-act="mood-set" data-id="${mo.k}" style="--mc:${mo.color}" aria-pressed="${cur?.mood === mo.k}"><i>${mo.icon}</i><b>${mo.label}</b></button>`).join('')}</div>
    <button class="btn ghost block" data-act="mood-sum">📊 ดูสรุปอารมณ์ใน 1 เดือน</button></div>`;
}

async function setMood(k) {
  const me = selfProfile(); if (!me) return;
  const cur = moodLog(me.id); const mo = moodOf(k);
  if (cur) { Object.assign(cur, { mood: k }); render(); await dbDo(DB.update('mood_logs', cur.id, { mood: k })); }
  else { const row = { id: uuid(), profile_id: me.id, log_date: todayKey(), mood: k, note: '', created_at: new Date().toISOString() }; S.mood_logs = S.mood_logs || []; S.mood_logs.push(row); render(); await dbDo(DB.insert('mood_logs', row)); }
  toast(`บันทึกแล้ว: ${mo.icon} ${mo.label}`);
}

function viewToday() {
  if (ui.todayPage === 'mood') return viewMoodSummary();
  const shown = todayProfiles(); const ids = shown.map((p) => p.id);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  const rings = shown.map((p) => {
    const d = personDay(p.id); const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
    return `<button type="button" class="card ring-card" data-act="meds-open" data-id="${p.id}" style="--pc:${p.color}">
      ${ring(d.done, d.total)}
      <div class="rc-info"><div class="rc-name">${esc(p.name)}${selfProfile()?.id === p.id ? ' <span class="tag">คุณ</span>' : ''}</div>
        <div class="rc-line">${d.total ? `กินแล้ว ${d.done} / ${d.total} รายการ` : 'ยังไม่มียาในตาราง'}</div>
        <div class="small muted">${!d.total ? '' : d.done === d.total ? 'ครบแล้ววันนี้ เก่งมาก 🎉' : d.next ? `ช่วงถัดไป: ${esc(d.next.label)} ${slotTime(d.next.key)}` : `เหลืออีก ${d.total - d.done} รายการ`}</div></div>
      <span class="muted chev">›</span></button>`;
  }).join('');
  return `
    <header class="header"><img src="icon.svg" alt="" class="logo"><div><h1 class="gem-text today-brand">สุขใจ</h1><p class="sub ask">วันนี้ทานยาแล้วหรือยัง?</p></div></header>
    <h2 class="today-h">ภาพรวมวันนี้</h2>
    ${S.profiles.length ? `<div class="tool-row"><button class="pill-btn" data-act="today-visibility">👁️ เลือกคนที่จะแสดง${todayHidden().filter((id) => S.profiles.some((p) => p.id === id)).length ? ` (ซ่อน ${todayHidden().filter((id) => S.profiles.some((p) => p.id === id)).length})` : ''}</button>
      ${S.profiles.length > 1 ? '<button class="pill-btn" data-act="reorder-people">↕️ จัดลำดับ</button>' : ''}</div>` : ''}
    ${rings || (S.profiles.length ? '<div class="card empty"><div class="e">👁️</div>ซ่อนทุกคนอยู่ — กด "เลือกคนที่จะแสดง" ด้านบน</div>' : '<div class="card empty"><div class="e">👨‍👩‍👧</div>เริ่มจากเพิ่มคนในครอบครัวก่อนนะ<br><button class="btn sm" data-act="add-person" style="margin-top:12px">+ เพิ่มคน</button></div>')}
    ${moodCard()}
  `;
}

// ---------- แท็บยา: เมนู 3 ไอคอน → ยาที่ต้องทาน / ติดตามอาการ / สรุปการกินยา ----------
function viewMeds() {
  if (ui.medsPage === 'list') return viewMedList();
  if (ui.medsPage === 'care') return `${backBar('ยาและการดูแล', 'meds-go', 'hub')}${viewCare()}`;
  if (ui.medsPage === 'summary') return viewAdherence();
  const tile = (go, ic, bg, title, sub) => `<button type="button" class="card tile" data-act="meds-go" data-id="${go}"><span class="tile-ic" style="background:${bg}">${ic}</span>
    <span class="tile-tx"><b>${title}</b><small>${sub}</small></span><span class="muted chev">›</span></button>`;
  return `<h1>ยาและการดูแล</h1><p class="sub">เลือกสิ่งที่ต้องการดู</p>
    ${tile('list', '<span class="mi" style="--ic:url(assets/icons/medicine.png)"></span>', 'var(--sky-soft)', 'ยาที่ต้องทาน', 'ตารางยาประจำวัน · เพิ่ม/แก้ยา')}
    ${tile('care', '<span class="mi" style="--ic:url(assets/icons/bandaid.png)"></span>', 'var(--meadow)', 'ติดตามอาการ', 'ถ่ายรูปแผล เทียบอาการ')}
    ${tile('summary', '<span class="mi" style="--ic:url(assets/icons/summary.png)"></span>', 'var(--pink-soft)', 'สรุปการกินยา 1 เดือน', 'ดูว่ากินครบไหมใน 30 วัน · ย้อนหลังได้')}`;
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
    ${missed.length ? `<div class="card soft"><b>💡 ยาที่ลืมบ่อย</b><p class="small" style="margin:6px 0 0">${missed.map((r) => `${esc(medNo(r.m))} ${esc(r.m.name)}`).join(' · ')}<br>ลองวางยาไว้ใกล้ที่ที่เห็นทุกวัน หรือเปิดแจ้งเตือนช่วงนั้นดูนะ</p></div>` : ''}

    <p class="small muted center">ข้อมูลเก็บไว้ถาวร ย้อนดูได้สูงสุด ${HISTORY_MONTHS} เดือน · ยาที่กินเมื่อมีอาการไม่นับ</p>`;
}

// ---------- สรุปอารมณ์ (เฉพาะของตัวเอง ดูย้อนหลังได้) ----------
function viewMoodSummary() {
  const back = backBar('ภาพรวมวันนี้', 'today-go', 'home');
  const me = selfProfile();
  if (!me) return `${back}<h1>สรุปอารมณ์</h1><div class="card empty"><div class="e">😊</div>ยังไม่มีโปรไฟล์ "ตัวฉัน"<br><button class="btn sm" data-act="add-self" style="margin-top:12px">+ เพิ่มโปรไฟล์ของฉัน</button></div>`;
  const ym = ui.moodYm || (ui.moodYm = ymOf(new Date()));
  const head = `${back}<h1>สรุปอารมณ์</h1><p class="sub">ของ${esc(me.name)} · เห็นเฉพาะเจ้าของบัญชี</p>${monthNav(ym, 'mood-month')}`;
  if (ensureMonth(ym)) return `${head}<div class="card empty">กำลังโหลดข้อมูลย้อนหลัง…</div>`;
  const logs = (S.mood_logs || []).filter((l) => l.profile_id === me.id && l.log_date.startsWith(ym));
  if (!logs.length) return `${head}<div class="card empty"><div class="e">🗓️</div>ยังไม่มีบันทึกอารมณ์ในเดือนนี้<br><span class="small">เลื่อนไปดูเดือนอื่นได้ ข้อมูลเก่าไม่หาย</span></div>`;
  const counts = MOODS.map((mo) => ({ ...mo, n: logs.filter((l) => l.mood === mo.k).length }));
  const top = [...counts].sort((a, b) => b.n - a.n)[0]; const max = Math.max(1, ...counts.map((c) => c.n));
  const [y, m] = ym.split('-').map(Number); const nDays = new Date(y, m, 0).getDate(); const firstDow = new Date(y, m - 1, 1).getDay();
  return `${head}
    <div class="card praise"><div class="praise-ic">${top.icon}</div><div class="praise-h">ส่วนใหญ่รู้สึก${top.label}</div>
      <p class="small">บันทึกแล้ว ${logs.length} วัน ในเดือนนี้ — ขอบคุณที่ดูแลใจตัวเองนะ 💛</p></div>
    <div class="card"><b>จำนวนวันของแต่ละอารมณ์</b>
      ${counts.map((c) => `<div class="ad-bar"><span>${c.icon} ${c.label}</span><div><i style="width:${(c.n / max) * 100}%;background:${c.color}"></i></div><b>${c.n} วัน</b></div>`).join('')}</div>
    <div class="card"><b>ปฏิทินอารมณ์</b>
      <div class="ad-cal mood-cal">${DOW.map((d) => `<div class="dow">${d}</div>`).join('')}${'<div></div>'.repeat(firstDow)}${Array.from({ length: nDays }, (_, i) => { const k = `${ym}-${pad(i + 1)}`; const l = logs.find((x) => x.log_date === k); const mo = l && moodOf(l.mood);
        return `<div class="ad-d na" title="${mo ? esc(mo.label) : ''}"><b>${i + 1}</b><small>${mo ? mo.icon : ''}</small></div>`; }).join('')}</div></div>`;
}

// ---------- แท็บสมาชิก ----------
function viewMembers() {
  if (ui.memberPage && S.profiles.some((p) => p.id === ui.memberPage)) return memberDetail(profileById(ui.memberPage));
  ui.memberPage = null;
  const myCircles = S.circles.filter((c) => c.user_id === DB.user.id);
  const myCircleIds = new Set(myCircles.map((c) => c.id));
  const myEmail = String(DB.user?.email || '').toLowerCase();
  const myInvites = DB.mode === 'supabase' ? (S.circle_invites || []).filter((i) => i.email.toLowerCase() === myEmail && !S.circle_members.some((m) => m.circle_id === i.circle_id && m.user_id === DB.user.id)) : [];
  const sharedCircles = S.circle_members.filter((m) => m.user_id === DB.user.id && !myCircleIds.has(m.circle_id)).map((m) => S.circles.find((c) => c.id === m.circle_id)).filter(Boolean);
  const me = selfProfile();
  return `
    <header class="header between"><div><h1>สมาชิก</h1><p class="sub">แตะที่ชื่อเพื่อดูข้อมูลส่วนตัว</p></div><button class="btn sm" data-act="add-person">+ เพิ่มคน</button></header>
    ${me ? '' : '<button class="alert sun" data-act="add-self"><div class="ic">🙋</div><div><b>ยังไม่มีโปรไฟล์ของคุณ</b><span class="small">เพิ่ม "ตัวฉัน" เพื่อบันทึกอารมณ์และดูแลตัวเองด้วย</span></div></button>'}
    ${S.profiles.map((p) => {
      const n = medsOf(p.id).filter(isOralMed).length; const other = medsOf(p.id).length - n; const isMe = me?.id === p.id; const age = ageOf(p.birth_year);
      return `<button type="button" class="card member-row" data-act="member-open" data-id="${p.id}" style="--pc:${p.color}">
        ${avatarHtml(p, 'lg')}
        <div class="info"><div class="mr-name">${esc(p.name)}${isMe ? ' <span class="tag">คุณ</span>' : ''}</div>
          <div class="small muted">${esc(p.relation || '')}${age ? ` · อายุ ${age} ปี` : ''} · 💊 จำนวนยาที่ทาน ${n} รายการ${other ? ` · ยาอื่นๆ ${other}` : ''}</div>
          ${p.drug_allergies?.length ? `<div class="small red-t">⚠️ แพ้ยา: ${p.drug_allergies.map(esc).join(', ')}</div>` : ''}
          ${ownsProfile(p.id) ? '' : `<div class="tags">${shareTag(p.id)}</div>`}</div>
        <span class="muted chev">›</span></button>`;
    }).join('') || '<div class="card empty"><div class="e">👨‍👩‍👧</div>ยังไม่มีสมาชิก</div>'}

    <h2>กลุ่มผู้ดูแล</h2>
    ${myCircles.map((c) => { const shared = (S.circle_care_for || []).filter((cf) => cf.circle_id === c.id).map((cf) => S.profiles.find((p) => p.id === cf.profile_id)).filter(Boolean); const nm = S.circle_members.filter((m) => m.circle_id === c.id).length; return `<div class="card circle"><b>${esc(c.name)}</b><p class="small muted">${esc(c.description || '')}${nm ? ` · สมาชิก ${nm} คน` : ''}</p><div class="shared-row">${shared.length ? `${shared.map((p) => `<span class="shared-av" title="${esc(p.name)}">${avatarHtml(p, 'xs')}<small>${esc(p.name)}</small></span>`).join('')}` : '<span class="small muted">ยังไม่ได้เลือกข้อมูลที่แชร์</span>'}</div><button class="btn ghost sm" data-act="manage-circle" data-id="${c.id}">⚙️ จัดการ</button></div>`; }).join('')}
    ${myInvites.map((i) => `<div class="card circle"><b>คำเชิญ: ${esc(i.circle_name || 'กลุ่มผู้ดูแล')}</b><p class="small muted">สิทธิ์: ${i.role === 'viewer' ? 'ดูอย่างเดียว' : 'แก้ไขข้อมูลได้'}</p><div class="row"><button class="btn sm" data-act="accept-invite" data-id="${i.id}">✓ รับคำเชิญ</button><button class="btn ghost sm" data-act="decline-invite" data-id="${i.id}">ปฏิเสธ</button></div></div>`).join('')}
    ${sharedCircles.map((c) => { const mm = S.circle_members.find((m) => m.circle_id === c.id && m.user_id === DB.user.id); return `<div class="card circle shared"><b>${esc(c.name)}</b><p class="small muted">แชร์มาให้ · สิทธิ์ของฉัน: ${mm?.role === 'viewer' ? 'ดูอย่างเดียว' : 'แก้ไขได้'}</p><button class="btn ghost sm danger" data-act="leave-circle" data-id="${c.id}">👋 ออกจากกลุ่ม</button></div>`; }).join('')}
    <button class="btn ghost block" data-act="new-circle">+ สร้างกลุ่มผู้ดูแล</button>

    <h2>📞 เบอร์ฉุกเฉิน</h2>
    <div class="card sos-card">
      <a class="sos-btn" href="tel:1669"><span>🚑</span><b>โทร 1669</b><small>เหตุฉุกเฉิน รถพยาบาล</small></a>
      ${(S.emergency_contacts || []).map((h) => `<div class="hos-row"><a class="hos-call" href="tel:${esc(h.phone.replace(/[^\d+]/g, ''))}"><span>🏥</span><b>${esc(h.name)}</b><small>${esc(h.phone)}</small></a><button type="button" class="hos-rm" data-act="del-contact" data-id="${h.id}" aria-label="ลบ ${esc(h.name)}">×</button></div>`).join('')}
      <button class="btn ghost block" data-act="add-contact">+ เพิ่มเบอร์โรงพยาบาล</button>
    </div>`;
}

function memberDetail(p) {
  const n = medsOf(p.id).filter(isOralMed).length; const other = medsOf(p.id).length - n; const age = ageOf(p.birth_year); const isMe = selfProfile()?.id === p.id;
  const next = S.appointments.filter((a) => a.profile_id === p.id && daysUntil(a.appt_date) >= 0).sort((a, b) => a.appt_date.localeCompare(b.appt_date))[0];
  const slips = S.appointments.filter((a) => a.profile_id === p.id).reduce((s, a) => s + (a.attachments?.length || 0), 0);
  const cares = S.care_plans.filter((c) => c.profile_id === p.id && c.status === 'active').length;
  const kv = (k, v) => (v ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : '');
  return `${backBar('สมาชิก', 'member-back')}
    <div class="profile-top" style="--pc:${p.color}">${avatarHtml(p, 'lg')}<h1>${esc(p.name)}${isMe ? ' <span class="tag">คุณ</span>' : ''}</h1>
      <div class="small muted">${esc(p.relation || '')}${age ? ` · อายุ ${age} ปี` : ''}</div>${ownsProfile(p.id) ? '' : `<div class="tags">${shareTag(p.id)}</div>`}</div>
    ${p.drug_allergies?.length ? `<div class="alert red allergy-box"><div class="ic">⚠️</div><div><b>แพ้ยา</b><div class="tags">${tagList(p.drug_allergies, 'allergy')}</div></div></div>` : ''}
    <div class="card kv-card">
      ${kv('โรคประจำตัว', p.chronic_diseases?.length ? p.chronic_diseases.map(esc).join(', ') : '')}
      ${kv('กรุ๊ปเลือด', esc(p.blood_type || ''))}
      ${kv('น้ำหนัก', p.weight_kg ? `${num(p.weight_kg)} กก.` : '')}${kv('ส่วนสูง', p.height_cm ? `${num(p.height_cm)} ซม.` : '')}${kv('รอบเอว', p.waist_cm ? `${num(p.waist_cm)} ซม.` : '')}
      ${kv('จำนวนยาที่ทาน', `${n} รายการ (รหัส "${esc(medPrefix(p.id)) || '-'}")`)}
      ${kv('ยาอื่นๆ (ไม่ใช่ยาทาน)', ` รายการ`)}
      ${kv('นัดถัดไป', next ? thDate(next.appt_date) : '')}
      ${kv('ใบนัด', `${slips} ใบ`)}
    </div>
    <div class="two-btn">
      <button class="btn ghost" data-act="care-of" data-id="${p.id}">🩹 ติดตามอาการ${cares ? ` (${cares})` : ''}</button>
      <button class="btn ghost" data-act="adherence" data-id="${p.id}">📊 สรุปการกินยา</button>
    </div>
    <label class="card switch-row"><span>🔔 แจ้งเตือนกินยา</span>
      <span class="switch"><input type="checkbox" data-toggle-reminder="${p.id}" ${p.reminder_enabled ? 'checked' : ''} ${ownsProfile(p.id) ? '' : 'disabled'}><i></i></span></label>
    ${ownsProfile(p.id) ? `<button class="btn block" data-act="edit-person" data-id="${p.id}">✏️ แก้ไขข้อมูล</button>` : '<p class="small muted center">ข้อมูลส่วนตัวแก้ได้เฉพาะเจ้าของโปรไฟล์</p>'}`;
}

// ---------- แท็บตั้งค่า ----------
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
    <h3 class="set-h">การใช้งาน</h3>
    <div class="card set-group">${row('🌐', 'ภาษา', 'ไทย', 'language')}
      <details class="set-det"><summary class="set-row"><span class="sr-ic">⏰</span><span class="sr-l">เวลาแต่ละช่วงยา</span><span class="muted chev">›</span></summary>
        <div class="two">${SLOTS.map((s) => { const [hh, mm] = slotTime(s.key).split(':'); const mmOpts = [...new Set(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', mm])].sort();
          return `<div class="f"><span>${s.icon} ${s.label}</span><div class="t24">
            <select data-slot-hh="${s.key}" aria-label="ชั่วโมง">${Array.from({ length: 24 }, (_, h) => pad(h)).map((h) => `<option ${h === hh ? 'selected' : ''}>${h}</option>`).join('')}</select><b>:</b>
            <select data-slot-mm="${s.key}" aria-label="นาที">${mmOpts.map((m) => `<option ${m === mm ? 'selected' : ''}>${m}</option>`).join('')}</select><small>น.</small></div></div>`; }).join('')}</div></details>
      <details class="set-det"><summary class="set-row"><span class="sr-ic">🔔</span><span class="sr-l">การแจ้งเตือน</span><span class="muted chev">›</span></summary>
        <p class="small" style="margin-top:0">• นัดหมอ: เตือนล่วงหน้า 5, 2 และ 1 วันเสมอ<br>• กินยา: เตือนเฉพาะคนและช่วงเวลาที่เปิด 🔔 ไว้</p>
        <button class="btn block" data-act="enable-push" ${pushOk ? '' : 'disabled'}>🔔 เปิดการแจ้งเตือนบนเครื่องนี้</button>
        <button class="btn ghost block" data-act="test-push" style="margin-top:8px">ทดลองส่งแจ้งเตือน</button>
        <p class="small muted" style="margin-bottom:0">${pushOk ? (supa && CFG.VAPID_PUBLIC_KEY ? 'ใช้ Web Push — เตือนได้แม้ปิดแอพ' : 'เตือนได้เฉพาะตอนเปิดแอพค้างไว้') : 'เบราว์เซอร์นี้ไม่รองรับ Web Push'}
          ${/iPhone|iPad/.test(navigator.userAgent) ? '<br>iPhone: ต้อง "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดจากไอคอนก่อน จึงจะเปิดแจ้งเตือนได้' : ''}</p></details></div>
    <h3 class="set-h">ความเป็นส่วนตัว</h3>
    <div class="card set-group">${row('🛡️', 'ความเป็นส่วนตัวและข้อมูลสุขภาพ (PDPA)', '', 'privacy')}</div>
    <h3 class="set-h">เกี่ยวกับแอพ</h3>
    <div class="card set-group">${row('📱', 'เวอร์ชันปัจจุบัน', APP_VERSION)}
      ${row('👩‍💻', 'ผู้พัฒนา', CFG.DEVELOPER_NAME ? esc(CFG.DEVELOPER_NAME) : unset)}
      ${row('📧', 'ติดต่อเรา', mail)}
      ${row('💬', 'ช่องทางการสนับสนุน', support)}</div>
    ${supa ? '<button class="btn ghost block" data-act="logout">ออกจากระบบ</button>'
      : '<p class="small muted">ยังไม่ได้เชื่อม Supabase — ข้อมูลอยู่ในเครื่องนี้เท่านั้น</p><div class="row"><button class="btn ghost" data-act="demo">ข้อมูลตัวอย่าง</button><button class="btn danger" data-act="wipe">ล้างข้อมูล</button></div>'}
    <p class="small muted center">สุขใจ v${APP_VERSION} · ใช้ประกอบการดูแล ไม่แทนคำแนะนำของแพทย์/เภสัชกร<br>© 2026 สุขใจ (Sookjai) สงวนลิขสิทธิ์ · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต</p>`;
}

// ---------- ตัวจัดการคลิกของหน้าจอใหม่ ----------
function openSummary(pid) { ui.tab = 'meds'; ui.medsPage = 'summary'; ui.adPid = pid || null; ui.adYm = null; render(); window.scrollTo(0, 0); }
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || !S) return;
  const { act, id } = el.dataset; const top = () => window.scrollTo(0, 0);
  switch (act) {
    case 'nav-back': if (navDepth > 0) history.back(); else { const to = el.dataset.to; if (to === 'meds-go') ui.medsPage = id; else if (to === 'today-go') ui.todayPage = id; else if (to === 'member-back') ui.memberPage = null; render(); top(); } break;
    case 'toggle-dellock': setDelLock(delLocked()); break;
    case 'meds-go': ui.medsPage = id; if (id === 'summary') { ui.adYm = null; } render(); top(); break;
    case 'meds-open': ui.tab = 'meds'; ui.medsPage = 'list'; ui.medsPerson = id; render(); top(); break;
    case 'member-open': ui.memberPage = id; render(); top(); break;
    case 'member-back': ui.memberPage = null; render(); top(); break;
    case 'today-go': ui.todayPage = id; render(); top(); break;
    case 'mood-sum': ui.todayPage = 'mood'; ui.moodYm = null; render(); top(); break;
    case 'mood-set': setMood(id); break;
    case 'mood-month': ui.moodYm = shiftYm(ui.moodYm || ymOf(new Date()), +id); render(); break;
    case 'ad-person': ui.adPid = id; render(); break;
    case 'ad-month': ui.adYm = shiftYm(ui.adYm || ymOf(new Date()), +id); render(); break;
    case 'adherence': openSummary(id); break;
    case 'print-meds': downloadMedsPdf(id); break;
    case 'print-page': downloadSummaryPdf(); break;
    case 'add-self': personForm(null, { relation: 'ตัวเอง', name: 'ฉัน', avatar: 'f-adult-smile' }); break;
    case 'language': openSheet(`<h3>ภาษา</h3>
      <div class="set-group card"><div class="set-row"><span class="sr-l">ไทย</span><span class="sr-v">✓ ใช้อยู่</span></div>
      <div class="set-row" style="opacity:.55"><span class="sr-l">English</span><span class="sr-v">เร็วๆ นี้</span></div></div>
      <div class="row"><button class="btn" data-act="close">ปิด</button></div>`); break;
  }
});

// ---------- หน้าเปิดแอพ (Splash): ขวดยาขยับ + ชื่อแอพ + สโลแกน ก่อนเข้าหน้าวันนี้ ----------
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
      <p class="sp-slogan"><span>จัดตารางยา จัดใบนัดหมอ</span><span>แชร์ข้อมูลดูแลครอบครัวพร้อมกัน<b>ในแอพเดียว</b></span></p>
      <p class="sp-ask">วันนี้ทานยาแล้วหรือยัง?</p>
      <p class="sp-skip">แตะเพื่อเข้าแอพ</p></div>`;
  document.body.appendChild(el);
  document.body.classList.add('noscroll');
  let done = false;
  const close = () => { if (done) return; done = true; el.classList.add('hide'); document.body.classList.remove('noscroll'); setTimeout(() => el.remove(), 600); };
  el.onclick = close;
  setTimeout(close, calm ? 2500 : 5500);
}

// iOS Safari ต้องมี touchstart ถึงจะแสดงสถานะ :active (สีขึ้นที่กรอบที่กด)
document.addEventListener('touchstart', () => {}, { passive: true });

// ---------- ดาวน์โหลด PDF (แบบฟอร์มเดียวกันทุกไฟล์ · ถ้าสร้างไฟล์ไม่ได้จะใช้ "พิมพ์ → บันทึกเป็น PDF" แทน) ----------
function printNow(cls, orient = 'portrait') {
  let st = document.getElementById('printPage');
  if (!st) { st = document.createElement('style'); st.id = 'printPage'; document.head.appendChild(st); }
  st.textContent = `@page { size: A4 ${orient}; margin: ${orient === 'landscape' ? '10mm' : '14mm'}; }`;
  document.body.classList.add(cls);
  const done = () => { document.body.classList.remove(cls); window.removeEventListener('afterprint', done); };
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
const hasFridge = (parts) => parts.some((p) => /ตู้เย็น/.test(p.t));
const medWhen = (m) => (m.as_needed ? 'เมื่อมีอาการ' : SLOTS.filter((s) => m.slots.includes(s.key)).map((s) => s.label).join(' · ') || '—');

/** โครงหน้าเดียวกันทุก PDF: หัวกระดาษ (ชื่อเรื่อง + กล่องข้อมูล 2 ช่อง) · เนื้อหา · หมายเหตุ · ท้ายกระดาษ (ข้อความเตือน + เวลาสร้างไฟล์ + เลขหน้า) */
const PDF_APP_NOTE = 'แอพสุขใจเป็นเครื่องช่วยจำ ไม่แทนคำแนะนำของแพทย์/เภสัชกร · กรุณาตรวจสอบรายการยากับแพทย์หรือเภสัชกรก่อนใช้';
function prSection(p, kind, title, box1, bodyHtml, note = '') {
  return `<section class="pr-page" data-kind="${kind}" style="--pcl:${tint(p.color, .5)};--pcs:${tint(p.color, .18)};--pcd:${p.color}">
    <div class="pr-top"><h1>${title}</h1><div class="pr-boxes"><span>${box1}</span><span>UPD: ${updDate(medsOf(p.id))}</span></div></div>
    ${bodyHtml}
    ${note ? `<p class="pr-note">${note}</p>` : ''}
    <p class="pr-foot"><span>${PDF_APP_NOTE} · สร้างไฟล์เมื่อ ${madeAt()} · © 2026 สุขใจ (Sookjai)</span><span class="pr-pg"></span></p></section>`;
}

/** แบบที่ 1: ตารางเลขรหัส (7 ช่วงเวลา) + ชื่อยาตัวเล็ก · ช่วงที่ไม่มียาแคบ */
function printGridHtml(p, meds) {
  const cols = SLOTS.map((s) => ({ s, list: meds.filter((m) => m.slots.includes(s.key)) }));
  const nRows = Math.max(1, ...cols.map((c) => c.list.length));
  const odd = meds.filter((m) => num(m.dose, 1) !== 1).map(medNo);
  const head = cols.map(({ s, list }) => { const pr = s.short.startsWith('ก่อน') ? 'ก่อน' : s.short.startsWith('หลัง') ? 'หลัง' : '';
    if (!list.length) return `<th class="off" title="${esc(s.label)} (ไม่มียา)">${s.icon}</th>`;
    return `<th class="${pr === 'หลัง' ? 'aft' : 'bef'}">${pr ? `<u>${pr}</u>${esc(s.short.slice(pr.length))}` : esc(s.short)}<small>${slotTime(s.key)}</small></th>`; }).join('');
  const nUsed = cols.filter((c) => c.list.length).length; const wOff = 4.5; const wUsed = ((100 - wOff * (cols.length - nUsed)) / Math.max(1, nUsed)).toFixed(2);
  const colgroup = `<colgroup>${cols.map((c) => `<col style="width:${c.list.length ? wUsed : wOff}%">`).join('')}</colgroup>`;
  const body = Array.from({ length: nRows }, (_, r) => `<tr>${cols.map(({ list }) => {
    if (!list.length) return '<td class="off"></td>'; const m = list[r]; if (!m) return '<td></td>';
    const parts = remarkParts(m); const tag = parts.filter((x) => x.kind === 'warn').map((x) => x.t).join(' · '); const hint = parts.filter((x) => x.kind === 'hint').map((x) => x.t).join(' · ');
    return `<td class="${tag ? 'wr' : ''}">${tag ? `<div class="pr-wn"><i></i>${esc(tag)}</div>` : ''}<div class="pr-main"><b class="pr-no">${m.as_needed ? '*' : ''}${esc(medNo(m))}</b>${num(m.dose, 1) !== 1 ? `<span class="pr-dz">${doseLabel(m.dose)} ${esc(unitOf(m))}</span>` : ''}${hasFridge(parts) ? '<span class="pr-fr">❄️</span>' : ''}</div><div class="pr-nm">${esc(m.name)}</div>${hint ? `<em>${esc(hint)}</em>` : ''}</td>`; }).join('')}</tr>`).join('');
  return prSection(p, 'grid', `ตารางการกินยาใน 1 วัน (${esc(p.name)})`,
    `ทานครั้งละ 1 เม็ด${odd.length ? ` <b class="pr-red">(ยกเว้นลำดับที่ ${odd.map(esc).join(' และ ')})</b>` : ''}`,
    `<table class="pr-grid">${colgroup}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
    meds.some((m) => m.as_needed) ? '* กินเฉพาะเมื่อมีอาการ' : '');
}

/** แบบที่ 2: รายการยามีชื่อยา — ลำดับ ชื่อยา ใช้รักษา จำนวน เวลา หมายเหตุ */
function printListHtml(p, meds) {
  const oral = meds.filter(isOralMed).length;
  return prSection(p, 'list', `รายการยา (${esc(p.name)})`,
    `${esc(p.relation || '')}${ageOf(p.birth_year) ? ` · อายุ ${ageOf(p.birth_year)} ปี` : ''} · ยาทาน ${oral} รายการ · ยาอื่นๆ ${meds.length - oral} รายการ`,
    `<table class="pr-list"><colgroup><col style="width:8%"><col style="width:20%"><col style="width:19%"><col style="width:11%"><col style="width:19%"><col style="width:23%"></colgroup>
    <thead><tr><th>ลำดับ</th><th>ชื่อยา</th><th>ใช้รักษา</th><th>จำนวน</th><th>เวลา</th><th>หมายเหตุ</th></tr></thead><tbody>
      ${meds.map((m) => { const parts = remarkParts(m); return `<tr class="${parts.some((x) => x.kind === 'warn') ? 'wr' : ''}"><td class="no">${esc(medNo(m))}</td><td>${esc(m.name)}</td><td>${esc(m.purpose || '')}</td>
        <td>${doseLabel(m.dose)} ${esc(unitOf(m))}</td><td>${esc(medWhen(m))}</td>
        <td>${parts.map((x) => `<span class="pr-r pr-${x.kind}">${x.kind === 'warn' ? '<i></i>' : ''}${/ตู้เย็น/.test(x.t) ? '❄️ ' : ''}${esc(x.t)}</span>`).join('')}</td></tr>`; }).join('')}
    </tbody></table>`);
}

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
      <h2 class="pr-h2">ยาที่ลืมบ่อย</h2>${missRows ? `<table class="pr-list pr-sum"><colgroup><col style="width:20%"><col style="width:56%"><col style="width:24%"></colgroup><thead><tr><th>รหัส</th><th>ชื่อยา</th><th>ลืม</th></tr></thead><tbody>${missRows}</tbody></table>` : '<p class="pr-praise">ไม่มียาที่ขาดในเดือนนี้</p>'}</div></div>`;
  return prSection(p, 'summary', `สรุปการกินยา (${esc(p.name)})`, `เดือน${monthLabel(ym)}`, body, 'ยาที่กินเมื่อมีอาการไม่นับรวม · คำนวณจากการติ๊กในแอพ');
}

/** mode: 'grid' | 'list' | 'both' — ทางสำรอง: พิมพ์ผ่านเบราว์เซอร์ */
function printMeds(pid, mode = 'both') {
  const p = profileById(pid); const meds = medsOf(pid);
  if (!meds.length) return toast('ยังไม่มียาให้พิมพ์');
  let area = document.getElementById('printArea');
  if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
  area.innerHTML = (mode !== 'list' ? printGridHtml(p, meds) : '') + (mode !== 'grid' ? printListHtml(p, meds) : '');
  printNow('printing', 'landscape');
}

// ---------- กล่องถามยืนยันก่อนแก้ไข/ลบ (ซ้อนทับหน้าที่เปิดอยู่ ถ้ากดไม่ใช่ ก็กลับไปแก้ต่อได้ ข้อมูลที่กรอกไม่หาย) ----------
function askConfirm(msg, yes = 'ใช่ ยืนยัน', no = 'ไม่ใช่') {
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
const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('โหลดไม่สำเร็จ ' + src)); document.head.appendChild(s); });
async function loadPdfLibs() {
  if (!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  return window.jspdf.jsPDF;
}
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
/** สร้างหน้า PDF ในกรอบซ่อน (iframe) → แบ่งหน้า → ล็อกขนาดทุกหน้าเท่ากัน → ใส่เลขหน้า — คืน { ifr, doc, pages } (ผู้เรียกต้อง ifr.remove()) */
async function buildPdfFrame(sectionsHtml) {
  const css = await (await fetch('styles.css?v=' + Date.now())).text();
  const ifr = document.createElement('iframe'); ifr.setAttribute('aria-hidden', 'true'); ifr.style.cssText = `position:fixed;left:-12000px;top:0;width:${PDF_PAGE_W}px;height:1200px;border:0`;
  document.body.appendChild(ifr);
  const doc = ifr.contentDocument; doc.open();
  doc.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap"><style>${css.replace(/@media print/g, '@media all').replace(/@page[^{]*\{[^}]*\}/g, '')}</style><style>html,body{margin:0!important;padding:0!important;width:${PDF_PAGE_W}px;background:#fff!important;color:#000;font-family:Sarabun,Prompt,sans-serif}.pr-page{break-after:auto!important;width:${PDF_PAGE_W}px;background:#fff}</style></head><body>${sectionsHtml}</body></html>`);
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
      const kids = [...c.querySelectorAll('.pr-wn, .pr-main, .pr-nm, em, .pr-r, .pr-no, .pr-dz')].filter((k) => k.textContent.trim());
      kids.forEach((k) => { const kr = k.getBoundingClientRect(); if (kr.right > cr.right + 1 || kr.left < cr.left - 1 || kr.bottom > cr.bottom + 1 || kr.top < cr.top - 1) issues.push(`${tag}: "${nz(k.textContent).slice(0, 30)}" ล้นออกนอกช่อง`); });
      const blocks = [...c.querySelectorAll('.pr-wn, .pr-main, .pr-nm, em, .pr-r')].filter((k) => k.textContent.trim());
      for (let a = 0; a < blocks.length; a++) for (let b = a + 1; b < blocks.length; b++) {
        const A = blocks[a].getBoundingClientRect(), B = blocks[b].getBoundingClientRect();
        if (Math.min(A.right, B.right) - Math.max(A.left, B.left) > 1 && Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) > 1) issues.push(`${tag}: "${nz(blocks[a].textContent).slice(0, 20)}" ซ้อนทับ "${nz(blocks[b].textContent).slice(0, 20)}"`);
      }
    });
  });
  if (ctx.kind === 'meds') {
    const meds = ctx.meds; const grids = pages.filter((s) => s.dataset.kind === 'grid'); const lists = pages.filter((s) => s.dataset.kind === 'list');
    if (ctx.mode !== 'list') {
      if (!grids.length) issues.push('ไม่มีหน้าตารางเลขรหัส');
      SLOTS.forEach((s, ci) => {
        const exp = meds.filter((m) => m.slots.includes(s.key)).map((m) => `${m.as_needed ? '*' : ''}${medNo(m)}|${nz(m.name)}`);
        const got = grids.flatMap((g) => [...g.querySelectorAll('tbody tr')].map((tr) => { const c = tr.children[ci]; const no = c?.querySelector('.pr-no')?.textContent.trim(); return no ? `${no}|${nz(c.querySelector('.pr-nm')?.textContent)}` : null; }).filter(Boolean));
        if (JSON.stringify(exp) !== JSON.stringify(got)) issues.push(`ตารางเลขรหัส ช่วง ${s.label}: ในแอพ [${exp}] แต่ใน PDF [${got}]`);
        const hd = grids[0]?.querySelectorAll('thead th')[ci]; const tw = grids[0]?.querySelector('table')?.getBoundingClientRect().width || 1; const cw = ((hd?.getBoundingClientRect().width || 0) / tw) * 100;
        if (exp.length === 0 && cw > 8) issues.push(`ช่วง ${s.label}: ไม่มียาแต่ช่องกว้าง ${cw.toFixed(1)}% (ต้องแคบ)`);
        if (exp.length > 0 && cw < 10) issues.push(`ช่วง ${s.label}: มียาแต่ช่องแคบเกินไป ${cw.toFixed(1)}%`);
      });
      grids.forEach((g, gi) => { const n = [...g.querySelectorAll('thead th')].length; if (n !== SLOTS.length) issues.push(`ตารางเลขรหัส หน้า ${gi + 1}: ต้องมี ${SLOTS.length} ช่วงเวลา (มี ${n})`); });
    }
    if (ctx.mode !== 'grid') {
      if (!lists.length) issues.push('ไม่มีหน้ารายการมีชื่อยา');
      const rows = lists.flatMap((g) => [...g.querySelectorAll('tbody tr')]);
      if (rows.length !== meds.length) issues.push(`รายการมีชื่อยา: ในแอพ ${meds.length} ตัว แต่ใน PDF ${rows.length} แถว`);
      meds.forEach((m, i) => {
        const tds = rows[i] ? [...rows[i].children].map((c) => nz(c.textContent)) : [];
        const want = [medNo(m), nz(m.name), nz(m.purpose), nz(`${doseLabel(m.dose)} ${unitOf(m)}`), nz(medWhen(m))];
        want.forEach((w, k) => { if ((tds[k] || '') !== w) issues.push(`แถว ${medNo(m)} ${m.name}: คอลัมน์ ${k + 1} ควรเป็น "${w}" แต่เป็น "${tds[k]}"`); });
        const parts = remarkParts(m).map((x) => x.t); const cell = rows[i]?.children[5];
        const got = cell ? [...cell.querySelectorAll('.pr-r')].map((e) => nz(e.textContent.replace('❄️', ''))) : [];
        if (JSON.stringify(parts.map(nz)) !== JSON.stringify(got)) issues.push(`แถว ${medNo(m)}: หมายเหตุไม่ตรง [${parts}] vs [${got}]`);
        if (new Set(got).size !== got.length) issues.push(`แถว ${medNo(m)}: หมายเหตุมีข้อความซ้ำ [${got}]`);
        got.forEach((a, x) => got.forEach((b, y) => { if (x !== y && a.includes(b)) issues.push(`แถว ${medNo(m)}: ข้อความ "${b}" ซ้อนอยู่ใน "${a}"`); }));
      });
      const oral = meds.filter(isOralMed).length; const sum = lists[0]?.querySelector('.pr-boxes span:first-child')?.textContent || '';
      if (!sum.includes(`ยาทาน ${oral} รายการ`) || !sum.includes(`ยาอื่นๆ ${meds.length - oral} รายการ`)) issues.push(`หัวกระดาษไม่ระบุจำนวนยาทาน/ยาอื่นๆ ให้ตรง (ยาทาน ${oral}, อื่นๆ ${meds.length - oral}) — "${nz(sum)}"`);
    }
  } else if (ctx.kind === 'summary') {
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
    if (missRows.length !== missTop.length) issues.push(`สรุป: ยาที่ลืมบ่อย ${missRows.length} แถว ควร ${missTop.length}`);
    missTop.forEach(([id, c], i) => { const m = S.medications.find((x) => x.id === id); const r = missRows[i] || [];
      if (r[0] !== medNo(m) || r[1] !== nz(m.name) || r[2] !== `${c} ครั้ง`) issues.push(`สรุป ยาที่ลืมบ่อย อันดับ ${i + 1}: PDF [${r}] ควรเป็น [${medNo(m)}, ${m.name}, ${c} ครั้ง]`); });
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
      const cv = await window.html2canvas(f1.pages[i], { scale: 2, backgroundColor: '#fff', useCORS: true, windowWidth: PDF_PAGE_W });
      if (cv.width !== PDF_PAGE_W * 2 || cv.height !== PDF_PAGE_H * 2) i3.push(`[รอบ 3] หน้า ${i + 1}: ภาพ ${cv.width}×${cv.height} ไม่ใช่ ${PDF_PAGE_W * 2}×${PDF_PAGE_H * 2}`);
      const t = document.createElement('canvas'); t.width = 210; t.height = 144; const tc = t.getContext('2d'); tc.drawImage(cv, 0, 0, 210, 144); const d = tc.getImageData(0, 0, 210, 144).data; let ink = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 690) ink++;
      if (ink / (210 * 144) < 0.02) i3.push(`[รอบ 3] หน้า ${i + 1}: ภาพแทบว่าง (มีหมึก ${(100 * ink / (210 * 144)).toFixed(1)}%)`);
      if (i > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 10, 10, 277, 190);
    }
    if (i3.length) throw new PdfAuditError(i3);
    return { pdf, pages: f1.pages.length };
  } finally { f1.ifr.remove(); }
}
const medsSections = (p, meds, mode) => (mode !== 'list' ? printGridHtml(p, meds) : '') + (mode !== 'grid' ? printListHtml(p, meds) : '');
async function makeMedsPdf(pid, mode = 'both') {
  await refreshForPdf(); const p = profileById(pid); const meds = medsOf(pid);
  const r = await renderVerifiedPdf(() => medsSections(p, medsOf(pid), mode), { kind: 'meds', p, meds, mode });
  return { ...r, name: `ตารางยา-${p.name}-${todayKey()}.pdf` };
}
async function makeSummaryPdf(pid, ym) {
  await refreshForPdf(ym); const p = profileById(pid);
  const r = await renderVerifiedPdf(() => printSummaryHtml(p, ym), { kind: 'summary', p, ym });
  return { ...r, name: `สรุปการกินยา-${p.name}-${ym}.pdf` };
}
function pdfFail(e, fallback) {
  console.error(e, e.issues);
  if (e instanceof PdfAuditError) { toast('⚠️ ตรวจพบข้อมูลไม่ตรงในไฟล์ PDF จึงยังไม่บันทึกไฟล์ — กรุณาแจ้งผู้ดูแลระบบ'); return; }
  toast('สร้าง PDF ตรงๆ ไม่ได้ — เปิดหน้าต่างพิมพ์แทน (เลือก "บันทึกเป็น PDF")'); fallback();
}
async function downloadMedsPdf(pid) {
  if (!medsOf(pid).length) return toast('ยังไม่มียาให้ดาวน์โหลด');
  toast('กำลังสร้างและตรวจสอบไฟล์ PDF…');
  try { const { pdf, name } = await makeMedsPdf(pid, 'both'); pdf.save(name); toast('✓ ตรวจสอบ 3 รอบแล้ว ดาวน์โหลดไฟล์ PDF เรียบร้อย'); }
  catch (e) { pdfFail(e, () => printMeds(pid, 'both')); }
}
async function downloadSummaryPdf() {
  const pid = ui.adPid; const ym = ui.adYm || ymOf(new Date()); if (!pid) return toast('ยังไม่มีข้อมูลให้ดาวน์โหลด');
  toast('กำลังสร้างและตรวจสอบไฟล์ PDF…');
  try { const { pdf, name } = await makeSummaryPdf(pid, ym); pdf.save(name); toast('✓ ตรวจสอบ 3 รอบแล้ว ดาวน์โหลดไฟล์ PDF เรียบร้อย'); }
  catch (e) { pdfFail(e, () => printNow('print-app')); }
}
/** ตรวจ PDF ทุกคน ทุกแบบ ซ้ำหลายรอบ (ใช้ใน console: await auditAllPdfs(3)) */
async function auditAllPdfs(rounds = 3) {
  const out = []; await loadPdfLibs();
  for (let r = 1; r <= rounds; r++) {
    for (const p of S.profiles.filter((x) => medsOf(x.id).length)) {
      const meds = medsOf(p.id); const f = await buildPdfFrame(medsSections(p, meds, 'both'));
      try { out.push({ round: r, who: p.name, kind: 'meds', pages: f.pages.length, issues: auditFrame(f, { kind: 'meds', p, meds, mode: 'both' }) }); } finally { f.ifr.remove(); }
      const ym = ymOf(new Date()); const g = await buildPdfFrame(printSummaryHtml(p, ym));
      try { out.push({ round: r, who: p.name, kind: 'summary', pages: g.pages.length, issues: auditFrame(g, { kind: 'summary', p, ym }) }); } finally { g.ifr.remove(); }
    }
  }
  return { ok: out.every((x) => !x.issues.length), checks: out.length, failed: out.filter((x) => x.issues.length) };
}
