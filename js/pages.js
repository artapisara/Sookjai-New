/* สุขใจ v1.2 — หน้าจอตามดีไซน์ใหม่: ภาพรวมวันนี้ · เมนูยา · สรุปการกินยา/อารมณ์ (ดูย้อนหลังได้) · สมาชิก · ตั้งค่า */
'use strict';

const APP_VERSION = '1.2.0';
// โลโก้: ขวดยาสี 4 สีหลัก (เขียว มิ้นต์ ส้ม เหลือง) วาดเป็น SVG — ขยับด้วย CSS (ปิดอัตโนมัติถ้าผู้ใช้ตั้งลดการเคลื่อนไหว)
const LOGO_MARK = '<g class="lg-bottle"><path class="lg-star s1" d="M98 24l2.6 6.4 6.4 2.6-6.4 2.6L98 42l-2.6-6.4L89 33l6.4-2.6z" fill="#fff"/><path class="lg-star s2" d="M20 38l1.9 4.6 4.6 1.9-4.6 1.9L20 51l-1.9-4.6-4.6-1.9 4.6-1.9z" fill="#fff"/><rect x="39" y="12" width="42" height="20" rx="6" fill="#DAFF3A"/><rect x="39" y="20" width="42" height="5" fill="#4D55F5"/><rect x="45" y="31" width="30" height="9" rx="2" fill="#fff"/><rect class="lg-body" x="26" y="38" width="68" height="72" rx="18" fill="#fff"/><path d="M26 76q17-9 34 0t34 0v16q0 18-18 18H44q-18 0-18-18z" fill="#CA7FFE"/><rect x="32" y="46" width="5" height="30" rx="2.5" fill="#DDE0FF"/><g class="lg-cross"><rect x="53" y="46" width="14" height="34" rx="4" fill="#4D55F5"/><rect x="43" y="56" width="34" height="14" rx="4" fill="#4D55F5"/></g></g>';
const logoSvg = () => `<svg viewBox="0 0 120 120" aria-hidden="true">${LOGO_MARK}</svg>`;
const backBar = (label, act, id = '') => `<button type="button" class="back-bar" data-act="${act}" data-id="${id}">‹ ${esc(label)}</button>`;

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
  medsOf(pid).forEach((m) => { if (m.as_needed) return; m.slots.forEach((s) => { total++; if (takenLog(m.id, s)) done++; else left.add(s); }); });
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
    <header class="header"><img src="icon.svg" alt="" class="logo"><div><h1 class="gem-text today-brand">สุขใจ</h1><p class="sub">${greet} · ${thDate(todayKey(), 'long')}</p></div></header>
    <h2 class="today-h">ภาพรวมวันนี้</h2>
    ${S.profiles.length ? `<div class="tool-row"><button class="pill-btn" data-act="today-visibility">👁️ เลือกคนที่จะแสดง${todayHidden().filter((id) => S.profiles.some((p) => p.id === id)).length ? ` (ซ่อน ${todayHidden().filter((id) => S.profiles.some((p) => p.id === id)).length})` : ''}</button>
      ${S.profiles.length > 1 ? '<button class="pill-btn" data-act="reorder-people">↕️ จัดลำดับ</button>' : ''}</div>` : ''}
    ${rings || (S.profiles.length ? '<div class="card empty"><div class="e">👁️</div>ซ่อนทุกคนอยู่ — กด "เลือกคนที่จะแสดง" ด้านบน</div>' : '<div class="card empty"><div class="e">👨‍👩‍👧</div>เริ่มจากเพิ่มคนในครอบครัวก่อนนะ<br><button class="btn sm" data-act="add-person" style="margin-top:12px">+ เพิ่มคน</button></div>')}
    ${moodCard()}
    ${(() => { const a = apptAlerts(ids) + careAlerts(ids) + stockAlerts(ids); return a ? `<h2>ที่ต้องรู้</h2>${a}` : ''; })()}
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
    ${tile('care', '🩹', 'var(--meadow)', 'ติดตามอาการ', 'ถ่ายรูปแผล เทียบอาการ')}
    ${tile('summary', '📊', 'var(--pink-soft)', 'สรุปการกินยา 1 เดือน', 'ดูว่ากินครบไหมใน 30 วัน · ย้อนหลังได้')}`;
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
  const head = `${back}<h1>สรุปการกินยา</h1>${chips}${monthNav(ym, 'ad-month')}`;
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
    <button class="btn ghost block no-print" data-act="print-page">📄 ดาวน์โหลดสรุปเป็น PDF</button>
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
      const n = medsOf(p.id).length; const isMe = me?.id === p.id; const age = ageOf(p.birth_year);
      return `<button type="button" class="card member-row" data-act="member-open" data-id="${p.id}" style="--pc:${p.color}">
        ${avatarHtml(p, 'lg')}
        <div class="info"><div class="mr-name">${esc(p.name)}${isMe ? ' <span class="tag">คุณ</span>' : ''}</div>
          <div class="small muted">${esc(p.relation || '')}${age ? ` · อายุ ${age} ปี` : ''} · 💊 ${n} รายการ</div>
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
  const n = medsOf(p.id).length; const age = ageOf(p.birth_year); const isMe = selfProfile()?.id === p.id;
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
      ${kv('ยา', `${n} รายการ (อักษรนำ "${esc(medPrefix(p.id)) || '-'}")`)}
      ${kv('นัดถัดไป', next ? thDate(next.appt_date) : '')}
    </div>
    <div class="two-btn">
      <button class="btn ghost" data-act="slips" data-id="${p.id}">📄 ใบนัด${slips ? ` (${slips})` : ''}</button>
      <button class="btn ghost" data-act="care-of" data-id="${p.id}">🩹 ติดตามอาการ${cares ? ` (${cares})` : ''}</button>
    </div>
    <button class="btn ghost block" data-act="adherence" data-id="${p.id}">📊 สรุปการกินยา</button>
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
      ${supa ? row('🔑', 'เปลี่ยนรหัสผ่าน', '', 'change-password') + row('🔐', 'ยืนยันตัวตน 2 ขั้นตอน', '', 'mfa-settings') : ''}</div>
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
    <p class="small muted center">สุขใจ v${APP_VERSION} · ใช้ประกอบการดูแล ไม่แทนคำแนะนำของแพทย์/เภสัชกร</p>`;
}

// ---------- ตัวจัดการคลิกของหน้าจอใหม่ ----------
function openSummary(pid) { ui.tab = 'meds'; ui.medsPage = 'summary'; ui.adPid = pid || null; ui.adYm = null; render(); window.scrollTo(0, 0); }
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || !S) return;
  const { act, id } = el.dataset; const top = () => window.scrollTo(0, 0);
  switch (act) {
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
    case 'print-meds': printMeds(id); break;
    case 'print-page': printNow('print-app'); break;
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
      <p class="sp-slogan"><span>จัดตารางยา จัดใบนัดหมอ</span><span>แชร์ข้อมูลดูแลครอบครัวพร้อมกัน</span><span>ในแอพเดียว</span></p>
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

// ---------- ดาวน์โหลด PDF (ใช้ "บันทึกเป็น PDF" ของเบราว์เซอร์ ไม่ต้องติดตั้งอะไรเพิ่ม) ----------
function printNow(cls) {
  document.body.classList.add(cls);
  const done = () => { document.body.classList.remove(cls); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1500); }, 150);
}
function printMeds(pid) {
  const p = profileById(pid); const meds = medsOf(pid); const age = ageOf(p.birth_year);
  if (!meds.length) return toast('ยังไม่มียาให้พิมพ์');
  let area = document.getElementById('printArea');
  if (!area) { area = document.createElement('div'); area.id = 'printArea'; document.body.appendChild(area); }
  const slotsText = (m) => (m.as_needed ? 'กินเมื่อมีอาการ' : SLOTS.filter((s) => m.slots.includes(s.key)).map((s) => `${s.short} ${slotTime(s.key)} น.`).join(', ') || '—');
  area.innerHTML = `
    <div class="pr-head"><div><h1>ตารางยา — ${esc(p.name)}</h1>
      <p>${esc(p.relation || '')}${age ? ` · อายุ ${age} ปี` : ''}${p.blood_type ? ` · กรุ๊ปเลือด ${esc(p.blood_type)}` : ''}${bodyText(p) ? ` · ${bodyText(p)}` : ''}</p>
      ${p.chronic_diseases?.length ? `<p>โรคประจำตัว: ${p.chronic_diseases.map(esc).join(', ')}</p>` : ''}</div>
      <div class="pr-brand">สุขใจ<br><small>พิมพ์เมื่อ ${thDate(todayKey(), 'long')}</small></div></div>
    ${p.drug_allergies?.length ? `<div class="pr-allergy">⚠️ แพ้ยา: ${p.drug_allergies.map(esc).join(', ')}</div>` : ''}
    <table class="pr-table"><thead><tr><th>ลำดับ</th><th>ชื่อยา</th><th>รักษา</th><th>ครั้งละ</th><th>เวลากิน</th><th>ข้อควรระวัง / หมายเหตุ</th></tr></thead><tbody>
      ${meds.map((m) => `<tr><td class="c"><b>${esc(medNo(m))}</b></td><td><b>${esc(m.name)}</b></td><td>${esc(m.purpose || '')}</td><td class="c">${doseLabel(m.dose)} ${esc(unitOf(m))}</td><td>${esc(slotsText(m))}</td>
        <td>${m.warning ? `<b class="pr-warn">⚠️ ${esc(m.warning)}</b> ` : ''}${esc(m.note || '')}</td></tr>`).join('')}
    </tbody></table>
    <p class="pr-foot">แอพสุขใจเป็นเครื่องช่วยจำ ไม่แทนคำแนะนำของแพทย์/เภสัชกร · กรุณาตรวจสอบรายการยากับแพทย์หรือเภสัชกรก่อนใช้</p>`;
  printNow('printing');
}
