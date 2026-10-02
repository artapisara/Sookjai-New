/* สุขใจ — สถานะแอพ หน้าจอหลัก และการเริ่มทำงาน */
'use strict';

const CFG = window.SUKJAI_CONFIG || {};
let DB;
let S = null; // ข้อมูลทั้งหมดของผู้ใช้ที่โหลดมาไว้ในหน่วยความจำ

const ui = {
  tab: 'today',
  filter: 'all',            // หน้าวันนี้: เลือกดูทีละคน
  medsPerson: null,         // หน้ายา: คนที่กำลังดู
  calPeople: null,          // หน้าปฏิทิน: Set ของคนที่เลือก (null = ทุกคน)
  calMonth: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  calSel: todayKey(),
  careFilter: 'all',        // หน้าติดตามอาการ: เลือกดูทีละคน
};

// ---------- ตัวช่วยอ่านข้อมูล ----------
const profileById = (id) => S.profiles.find((p) => p.id === id) || { id, name: 'ไม่ระบุ', avatar: 'f-adult-smile', color: '#9AA5AB', chronic_diseases: [], drug_allergies: [] };
const hospitalById = (id) => S.hospitals.find((h) => h.id === id);
const doctorById = (id) => S.doctors.find((d) => d.id === id);
const profileIndex = (id) => S.profiles.findIndex((p) => p.id === id);
// สิทธิ์ฝั่งแอพ (ฐานข้อมูลบังคับใช้จริงอีกชั้นด้วย RLS): เจ้าของโปรไฟล์ / สมาชิกวงที่แก้ไขได้ / ดูอย่างเดียว
const ownsProfile = (pid) => { const p = profileById(pid); return !!p && (DB.mode !== 'supabase' || !p.user_id || p.user_id === DB.user.id); };
const canEditProfile = (pid) => {
  if (ownsProfile(pid)) return true;
  const circles = new Set((S.circle_care_for || []).filter((cf) => cf.profile_id === pid).map((cf) => cf.circle_id));
  return S.circle_members.some((m) => m.user_id === DB.user.id && circles.has(m.circle_id) && m.role !== 'viewer');
};
const canDeleteRow = (row, pid) => ownsProfile(pid) || !row.user_id || row.user_id === DB.user.id;
const circleNamesOf = (pid) => {
  const ids = new Set((S.circle_care_for || []).filter((cf) => cf.profile_id === pid).map((cf) => cf.circle_id));
  const mine = new Set(S.circle_members.filter((m) => m.user_id === DB.user.id).map((m) => m.circle_id));
  return S.circles.filter((c) => ids.has(c.id) && mine.has(c.id)).map((c) => c.name);
};
const shareTag = (pid) => {
  if (ownsProfile(pid)) return '';
  const names = circleNamesOf(pid);
  return `<span class="tag share-tag">👥 แชร์จากวง ${names.length ? esc(names.join(', ')) : 'ดูแล'} · ${canEditProfile(pid) ? 'แก้ไขได้' : 'ดูอย่างเดียว'}</span>`;
};
/** ยาใหม่ที่สมาชิกเพิ่ม — เจ้าของโปรไฟล์ต้องตรวจ/ยืนยันเลขลำดับ */
const pendingNoAlerts = (ids) => S.medications.filter((m) => m.no_pending && ids.includes(m.profile_id) && ownsProfile(m.profile_id))
  .map((m) => `<button class="alert sun" data-act="edit-med" data-id="${m.id}"><div class="ic">🔢</div><div><b>ยาใหม่รอยืนยันเลขลำดับ</b>
    <span class="small">${esc(profileById(m.profile_id).name)}: ${esc(m.name)} (เลขชั่วคราว ${m.sort_order}) — แตะเพื่อตรวจเลขแล้วกดบันทึก</span></div></button>`).join('');
const masterOf = (name, exceptId) => S.medications.find((m) => m.id !== exceptId && medKey(m.name) && medKey(m.name) === medKey(name));
const nextMasterNo = () => Math.max(0, ...S.medications.map((m) => num(m.sort_order))) + 1;
const medsOf = (pid, status = 'active') => S.medications.filter((m) => m.profile_id === pid && (status === 'any' || m.status === status)).sort((a, b) => a.sort_order - b.sort_order);
const dailyUse = (m) => (m.slots?.length || 0) * num(m.dose, 1);
const daysLeft = (m) => (tracksStock(m) && dailyUse(m) ? Math.floor(num(m.stock) / dailyUse(m)) : Infinity);
const slotTime = (k) => S.settings.slot_times[k] || DEFAULT_SLOT_TIMES[k];
const slotsByTime = () => [...SLOTS].sort((a, b) => slotTime(a.key).localeCompare(slotTime(b.key)));
const takenLog = (medId, slot, day = todayKey()) => S.med_logs.find((l) => l.medication_id === medId && l.slot === slot && l.log_date === day);
const slotReminderOn = (m, slot) => m.slot_reminders?.[slot] !== false;
const departmentOf = (a) => a.department || '-';

/** ตารางทานยา 1 วัน: เรียงตามช่วงเวลา → ภายในช่วงเรียงตามคน แล้วตาม sort_order */
function buildTimeline(profileIds) {
  return slotsByTime().map((slot) => {
    const items = S.medications
      .filter((m) => m.status === 'active' && profileIds.includes(m.profile_id) && m.slots.includes(slot.key))
      .sort((a, b) => profileIndex(a.profile_id) - profileIndex(b.profile_id) || a.sort_order - b.sort_order);
    return { slot, time: slotTime(slot.key), items };
  }).filter((x) => x.items.length);
}

async function dbDo(promise) {
  try { await promise; return true; }
  catch (e) { console.error(e); toast('บันทึกไม่สำเร็จ: ' + (e.message || 'ลองใหม่อีกครั้ง')); await reload(); return false; }
}
async function reload() { try { S = await DB.loadAll(); render(); } catch (e) { console.error(e); toast('โหลดข้อมูลไม่สำเร็จ'); } }

// รูปใน Storage ต้องขอ URL ก่อนแสดง — ใส่ <img data-path="..."> แล้วเรียก hydrateImgs (จำ URL ไว้ 50 นาที)
const urlCache = new Map();
async function fileUrlCached(path) {
  const c = urlCache.get(path); if (c && c.exp > Date.now()) return c.url;
  const url = await DB.fileUrl(path); urlCache.set(path, { url, exp: Date.now() + 50 * 60e3 }); return url;
}
function hydrateImgs(root) { $$('img[data-path]', root).forEach(async (img) => { try { img.src = await fileUrlCached(img.dataset.path); } catch {} }); }

// ---------- องค์ประกอบ UI ----------
const todayHidden = () => S.settings.today_hidden || [];
const todayProfiles = () => S.profiles.filter((p) => !todayHidden().includes(p.id));

function personChips(sel, act, multi, withAll = act === 'filter', list = S.profiles) {
  const isOn = (id) => (multi ? (!sel || sel.has(id)) : sel === id);
  return `<div class="chips">
    ${withAll ?`<button class="chip ${sel === 'all' ? 'on' : ''}" data-act="${act}" data-id="all">ทุกคน</button>` : ''}
    ${multi ? `<button class="chip ${!sel ? 'on' : ''}" data-act="${act}" data-id="all">ทุกคน</button>` : ''}
    ${list.map((p) => `<button class="chip ${isOn(p.id) && !(multi && !sel) ? 'on' : ''}" data-act="${act}" data-id="${p.id}" style="--pc:${p.color}">
      <span class="av xs">${avatarSVG(p.avatar, p.color)}</span>${esc(p.name)}</button>`).join('')}
  </div>`;
}

function ring(done, total) {
  const r = 36, c = 2 * Math.PI * r, pct = total ? done / total : 0;
  return `<svg class="ring" viewBox="0 0 84 84"><circle class="bg" cx="42" cy="42" r="${r}"/>
    <circle class="fg" cx="42" cy="42" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
    <text x="42" y="42">${Math.round(pct * 100)}%</text></svg>`;
}

const tagList = (arr, cls = '') => (arr || []).map((t) => `<span class="tag ${cls}">${cls === 'allergy' ? '⚠️ ' : ''}${esc(t)}</span>`).join('');
const whenText = (n) => (n === 0 ? 'วันนี้' : n === 1 ? 'พรุ่งนี้' : `อีก ${n} วัน`);

function apptAlerts(ids) {
  return S.appointments
    .filter((a) => ids.includes(a.profile_id))
    .map((a) => ({ a, n: daysUntil(a.appt_date) }))
    .filter(({ n }) => n >= 0 && n <= Math.max(...REMIND_DAYS))
    .sort((x, y) => x.n - y.n || hhmm(x.a.appt_time).localeCompare(hhmm(y.a.appt_time)))
    .map(({ a, n }) => {
      const p = profileById(a.profile_id); const h = hospitalById(a.hospital_id); const d = doctorById(a.doctor_id);
      return `<button class="alert ${n <= 1 ? 'red' : 'sun'}" data-act="appt-detail" data-id="${a.id}">
        ${avatarHtml(p, 'sm')}<div>
        <b>${esc(p.name)} นัดหมอ${whenText(n)}</b>
        <span class="small">${thDate(a.appt_date)} · ${hhmm(a.appt_time)} น. · ${esc(departmentOf(a))}${d ? ' · ' + esc(d.name) : ''}${h ? ' · ' + esc(h.name) : ''}</span>
        ${a.note ? `<span class="small note">📝 ${esc(a.note)}</span>` : ''}
      </div></button>`;
    }).join('');
}

function stockAlerts(ids) {
  const low = S.medications.filter((m) => m.status === 'active' && ids.includes(m.profile_id) && daysLeft(m) <= LOW_STOCK_DAYS);
  if (!low.length) return '';
  return `<div class="alert red"><div class="ic">📦</div><div><b>ยาใกล้หมด ควรเตรียมรับยาเพิ่ม</b>
    <span class="small">${low.map((m) => `${esc(profileById(m.profile_id).name)}: ${esc(m.name)} เหลือ ${num(m.stock)} เม็ด (≈${daysLeft(m)} วัน)`).join('<br>')}</span></div></div>`;
}

// ตารางกินยาใน 1 วัน ของคนหนึ่งคน — แสดงเฉพาะเลขลำดับยา (แตะเลขเพื่อติ๊กว่ากินแล้ว)
function dayTable(p, nextKey) {
  const meds = medsOf(p.id); if (!meds.length) return '';
  const cols = SLOTS.map((s) => ({ s, list: meds.filter((m) => m.slots.includes(s.key)) }));
  const nRows = Math.max(...cols.map((c) => c.list.length));
  const wOff = 0.32, total = cols.reduce((a, c) => a + (c.list.length ? 1 : wOff), 0);
  const colgroup = `<colgroup>${cols.map((c) => `<col style="width:${(((c.list.length ? 1 : wOff) / total) * 100).toFixed(2)}%">`).join('')}</colgroup>`;
  const head = cols.map(({ s, list }) => {
    if (!list.length) return `<th class="off" title="${esc(s.label)} (ไม่มียา)" aria-label="${esc(s.label)} ไม่มียา"><span class="ic">${s.icon}</span></th>`;
    const pre = s.short.startsWith('ก่อน') ? 'ก่อน' : 'หลัง';
    return `<th class="th-${s.key} ${list.length ? '' : 'off'} ${s.key === nextKey ? 'next' : ''}"><span class="ic">${s.icon}</span><u>${pre}</u>${esc(s.short.slice(pre.length))}<small>${slotTime(s.key)}</small>${s.key === nextKey ? '<em>ถัดไป</em>' : ''}</th>`;
  }).join('');
  const body = Array.from({ length: nRows }, (_, r) => `<tr>${cols.map(({ s, list }) => {
    if (!list.length) return '<td class="off"></td>';
    const m = list[r]; if (!m) return '<td class="blank"></td>';
    const log = takenLog(m.id, s.key);
    return `<td class="${m.warning ? 'warn' : ''} ${m.as_needed ? 'pn' : ''} ${log ? 'done' : ''}">
      <div class="dcell">
        <div class="dtop"><span class="wi">${m.warning ? '⚠️' : ''}</span>
          <button type="button" class="tick ${log ? 'on' : ''}" data-act="take" data-id="${m.id}" data-slot="${s.key}" aria-label="ติ๊กว่ากินยาลำดับที่ ${m.sort_order} ${esc(m.name)} แล้ว">${log ? '✓' : ''}</button></div>
        <div class="dmain" data-act="edit-med" data-id="${m.id}" role="button" tabindex="0" aria-label="ดูรายละเอียดยาลำดับที่ ${m.sort_order} ${esc(m.name)}">
          <b class="onum">${m.as_needed ? '*' : ''}${m.sort_order}${m.no_pending ? '<sup class="pend">?</sup>' : ''}</b>
          <span class="mname">${esc(m.name)}</span>
        </div>
        ${num(m.dose, 1) !== 1 ? `<span class="dpill">${doseLabel(m.dose)} ${unitOf(m)}</span>` : ''}
        ${m.table_hint ? `<small class="hint">${esc(m.table_hint)}</small>` : ''}
      </div></td>`;
  }).join('')}</tr>`).join('');
  const odd = meds.filter((m) => num(m.dose, 1) !== 1).map((m) => m.sort_order);
  const warns = meds.filter((m) => m.warning);
  const upd = meds.map((m) => String(m.updated_at).slice(0, 10)).sort().at(-1);
  return `<section class="dtable" style="--pc:${p.color}">
    <div class="dt-head">${avatarHtml(p, 'sm')}<div><b>ตารางการกินยาใน 1 วัน (${esc(p.name)})</b>
      <div class="small muted">อัปเดต ${thDate(upd)}</div></div></div>
    <div class="dt-note">ทานยาครั้งละ 1 เม็ด${odd.length ? ` <b>ยกเว้นลำดับที่ ${odd.join(', ')}</b> <span>(ดูจำนวนเม็ดในช่อง)</span>` : ' ทุกรายการ'}</div>
    <table>${colgroup}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${meds.some((m) => m.as_needed) ? '<p class="small muted dt-star">* กินเฉพาะตอนมีอาการเท่านั้น (ช่องสีชมพู)</p>' : ''}
    ${warns.length ? `<div class="dt-warn"><b>⚠️ ข้อควรระวัง</b>${warns.map((m) => `<div>${m.sort_order}. ${esc(m.name)} → ${esc(m.warning)}</div>`).join('')}</div>` : ''}
    <details class="dt-legend" data-legend="${p.id}" ${ui.legendOpen?.[p.id] ? 'open' : ''}><summary>ดูชื่อยาตามเลขลำดับ</summary>
      ${meds.map((m) => `<div class="lg-row"><div class="lg-name"><b>${m.sort_order}.</b> ${esc(m.name)}${m.purpose ? ` <span class="muted">— ${esc(m.purpose)}</span>` : ''}</div>
        <div class="lg-right"><span class="lg-dose">${doseLabel(m.dose)} ${unitOf(m)}</span>${SLOTS.filter((s) => m.slots.includes(s.key)).map((s) => `<button type="button" class="slot-ic" data-act="slot-name" data-label="${esc(s.label)} (${slotTime(s.key)} น.)" title="${esc(s.label)}" aria-label="${esc(s.label)}">${s.icon}</button>`).join('')}</div></div>`).join('')}
      <p class="small muted lg-hint">แตะไอคอนเพื่อดูว่าเป็นช่วงไหน</p>
    </details>
  </section>`;
}

// ---------- หน้า: วันนี้ (ตารางทานยา) ----------
function viewToday() {
  const shown = todayProfiles();
  if (ui.filter !== 'all' && !shown.some((p) => p.id === ui.filter)) ui.filter = 'all';
  const ids = ui.filter === 'all' ? shown.map((p) => p.id) : [ui.filter];
  const now = nowHM();
  const h1 = new Date(Date.now() - 3600e3); const graceHM = `${pad(h1.getHours())}:${pad(h1.getMinutes())}`;
  const all = buildTimeline(ids);
  let total = 0, done = 0;
  all.forEach((x) => x.items.forEach((m) => { if (m.as_needed) return; total++; if (takenLog(m.id, x.slot.key)) done++; }));
  const nextKey = all.find((x) => x.items.some((m) => !m.as_needed && !takenLog(m.id, x.slot.key)) && (x.time >= graceHM || graceHM > now))?.slot.key;
  const rows = ids.map((pid) => dayTable(profileById(pid), nextKey)).join('');

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  return `
    <header class="header"><img src="icon.svg" alt="" class="logo"><div><h1>สุขใจ</h1><p class="sub">${greet} · ${thDate(todayKey(), 'long')}</p></div></header>
    <div class="card hero">${ring(done, total)}<div>
      <div class="small" style="opacity:.9">ทานยาวันนี้</div>
      <div class="big">${done} / ${total} รายการ</div>
      <div class="small" style="opacity:.9">${total === 0 ? 'ยังไม่มียาในตาราง' : done === total ? 'ครบแล้ว เก่งมาก 🎉' : `เหลืออีก ${total - done} รายการ`}</div>
    </div></div>
    ${apptAlerts(ids)}${careAlerts(ids)}${stockAlerts(ids)}${pendingNoAlerts(ids)}
    ${shown.length ? personChips(ui.filter, 'filter', false, true, shown) : ''}
    ${S.profiles.length ? `<button class="linkbtn vis-btn" data-act="today-visibility">👁️ เลือกตารางที่จะแสดงในหน้านี้${todayHidden().length ? ` (ซ่อน ${todayHidden().filter((id) => S.profiles.some((p) => p.id === id)).length} คน)` : ''}</button>` : ''}
    <h2>ตารางทานยาวันนี้</h2>
    ${S.profiles.length && !shown.length ? '<div class="card empty"><div class="e">👁️</div>ซ่อนตารางของทุกคนอยู่<br>กด "เลือกตารางที่จะแสดงในหน้านี้" ด้านบนเพื่อเลือกใหม่</div>' : all.length ? rows : `<div class="card empty"><div class="e">💊</div>${S.profiles.length ? 'ยังไม่มียาที่ต้องทาน' : 'เริ่มจากเพิ่มคนในครอบครัวก่อนนะ'}<br>
      <button class="btn sm" data-act="${S.profiles.length ? 'add-med' : 'add-person'}" style="margin-top:12px">+ ${S.profiles.length ? 'เพิ่มยา' : 'เพิ่มคนในครอบครัว'}</button></div>`}
  `;
}

// ---------- หน้า: ยา ----------
function medCard(m, showNo) {
  const dl = daysLeft(m); const p = profileById(m.profile_id);
  return `<div class="card med" data-id="${m.id}">
    <div class="ordnum" style="background:${p.color}" aria-label="ยาลำดับที่ ${m.sort_order}">${m.sort_order}${m.no_pending ? '?' : ''}</div>
    <div class="info" data-act="edit-med" data-id="${m.id}">
      <div class="name">${esc(m.name)}</div>
      ${m.purpose ? `<div class="small muted">รักษา: ${esc(m.purpose)}</div>` : ''}
      <div class="tags">${m.slots.length ? m.slots.map((s) => `<span class="tag">${slotOf(s).icon} ${slotOf(s).display || slotOf(s).short} ${slotReminderOn(m, s) && p.reminder_enabled ? '🔔' : '🔕'}</span>`).join('') : '<span class="tag sun">ไม่ได้กินประจำวัน · ดูหมายเหตุ</span>'}</div>
      ${m.note ? `<div class="small med-note">📝 ${esc(m.note)}</div>` : ''}
      ${m.status === 'active'
        ? `<div class="small"><span class="${dl <= LOW_STOCK_DAYS ? 'red-t' : 'muted'}">ครั้งละ ${doseLabel(m.dose)} ${unitOf(m)}${tracksStock(m) ? ` · เหลือ ${num(m.stock)} เม็ด${dl !== Infinity ? ` (≈${dl} วัน)` : ''}` : ''}</span></div>`
        : `<div class="small"><span class="tag ${m.status === 'stopped' ? 'allergy' : 'sun'}">${MED_STATUS[m.status]}</span>${m.status_reason ? ' ' + esc(m.status_reason) : ''}</div>`}
      <div class="small muted">อัปเดต ${thDate(String(m.updated_at).slice(0, 10))}</div>
    </div>
  </div>`;
}

function viewMeds() {
  if (!S.profiles.length) return `<h1>รายการยา</h1><div class="card empty"><div class="e">👨‍👩‍👧</div>เพิ่มคนในครอบครัวก่อน<br><button class="btn sm" data-act="add-person" style="margin-top:12px">+ เพิ่มคน</button></div>`;
  if (!S.profiles.some((p) => p.id === ui.medsPerson)) ui.medsPerson = S.profiles[0].id;
  const p = profileById(ui.medsPerson);
  const act = medsOf(p.id);
  const off = S.medications.filter((m) => m.profile_id === p.id && m.status !== 'active');
  return `
    <h1>รายการยา</h1><p class="sub">เลขหน้ายาคือเลขประจำยาของทั้งครอบครัว — ยาชนิดเดียวกันใช้เลขเดียวกันทุกคน แก้เลขได้ในฟอร์มแก้ไขยา</p>
    ${personChips(ui.medsPerson, 'meds-person')}
    ${shareTag(p.id) ? `<div class="tags">${shareTag(p.id)}</div>` : ''}
    ${pendingNoAlerts([p.id])}
    ${p.drug_allergies?.length ? `<div class="alert red"><div class="ic">⚠️</div><div><b>${esc(p.name)} แพ้ยา</b><div class="tags">${tagList(p.drug_allergies, 'allergy')}</div></div></div>` : ''}
    <h2>กำลังกิน <span class="small muted">${act.length} รายการ</span></h2>
    <div id="medList">${act.map((m) => medCard(m, true)).join('')}</div>
    ${act.length ? '' : `<div class="card empty"><div class="e">💊</div>ยังไม่มียา กดปุ่ม + เพื่อเพิ่ม</div>`}
    <h2>งดชั่วคราว / หยุดแล้ว <span class="small muted">${off.length} รายการ</span></h2>
    ${off.map((m) => medCard(m, false)).join('') || `<div class="card empty small">ไม่มี</div>`}
    <button class="fab" data-act="add-med" aria-label="เพิ่มยา">+</button>
  `;
}

// ---------- หน้า: ปฏิทิน ----------
function viewCalendar() {
  const m = ui.calMonth;
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const visible = S.appointments.filter((a) => !ui.calPeople || ui.calPeople.has(a.profile_id));
  const byDay = {};
  visible.forEach((a) => (byDay[a.appt_date] = byDay[a.appt_date] || []).push(a));
  Object.values(byDay).forEach((l) => l.sort((a, b) => hhmm(a.appt_time).localeCompare(hhmm(b.appt_time))));
  let cells = DOW.map((d) => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i); const key = dk(d); const list = byDay[key] || [];
    if (i === 35 && d.getMonth() !== m.getMonth()) break; // ไม่แสดงแถวที่ 6 ถ้าไม่จำเป็น
    cells += `<button class="d ${d.getMonth() !== m.getMonth() ? 'out' : ''} ${key === todayKey() ? 'today' : ''} ${key === ui.calSel ? 'sel' : ''}" data-act="sel-day" data-id="${key}">
      <span class="dn">${d.getDate()}</span>
      <span class="bars">${list.slice(0, 3).map((a) => `<i style="background:${profileById(a.profile_id).color}"></i>`).join('')}${list.length > 3 ? `<em>+${list.length - 3}</em>` : ''}</span></button>`;
  }
  const sel = byDay[ui.calSel] || [];
  const upcoming = visible.filter((a) => daysUntil(a.appt_date) >= 0).sort((a, b) => (a.appt_date + hhmm(a.appt_time)).localeCompare(b.appt_date + hhmm(b.appt_time)));
  return `
    <h1>ปฏิทินนัดหมอ</h1><p class="sub">จุดสีตามสีประจำตัวแต่ละคน · แตะวันที่เพื่อดูนัด</p>
    ${personChips(ui.calPeople, 'cal-person', true)}
    <div class="card cal-card">
      <div class="cal-nav"><button class="iconbtn" data-act="cal-prev" aria-label="เดือนก่อน">‹</button>
        <b>${MONTHS[m.getMonth()]} ${m.getFullYear() + 543}</b>
        <button class="iconbtn" data-act="cal-next" aria-label="เดือนถัดไป">›</button></div>
      <div class="cal">${cells}</div>
      <div class="row" style="justify-content:center;margin-top:8px"><button class="btn ghost sm" data-act="cal-today">กลับมาวันนี้</button></div>
    </div>
    <h2>${thDate(ui.calSel, 'long')}</h2>
    ${sel.map(apptBrief).join('') || `<div class="card empty small">ไม่มีนัดวันนี้</div>`}
    <h2>นัดที่กำลังจะถึง <span class="small muted">${upcoming.length} นัด</span></h2>
    ${upcoming.slice(0, 20).map(apptBrief).join('') || `<div class="card empty small">ยังไม่มีนัดล่วงหน้า</div>`}
    <button class="fab" data-act="add-appt" data-id="${ui.calSel}" aria-label="เพิ่มนัดหมอ">+</button>
  `;
}

function apptBrief(a) {
  const p = profileById(a.profile_id); const d = doctorById(a.doctor_id); const dt = parseDk(a.appt_date); const n = daysUntil(a.appt_date);
  return `<button class="card appt" data-act="appt-detail" data-id="${a.id}" style="${n < 0 ? 'opacity:.6' : ''}">
    <div class="date" style="background:${p.color}"><b>${dt.getDate()}</b><span>${MONTHS_S[dt.getMonth()]}</span></div>
    <div class="info">
      <div class="line"><b>${esc(p.name)}</b>${n >= 0 && n <= 5 ? `<span class="countdown ${n <= 1 ? 'hot' : ''}">${whenText(n)}</span>` : ''}</div>
      <div class="small">🕘 ${hhmm(a.appt_time)} น. · ${esc(departmentOf(a))}${a.attachments?.length ? ` · 📎 ${a.attachments.length}` : ''}</div>
      <div class="small muted">👨‍⚕️ ${d ? esc(d.name) : 'ไม่ระบุหมอ'}</div>
    </div><span class="muted">›</span></button>`;
}

// ---------- หน้า: ครอบครัว + ตั้งค่า ----------
function initCirclesUI() {
  $$('[data-act=new-circle]').forEach((b) => b.addEventListener('click', () => circleForm()));
  $$('[data-act=leave-circle]').forEach((b) => b.addEventListener('click', async () => {
    const cid = b.dataset.id;
    const c = S.circle_members.find((m) => m.circle_id === cid && m.user_id === DB.user.id);
    if (!c) return;
    if (await dbDo(DB.remove('circle_members', c.id))) { S.circle_members = S.circle_members.filter((x) => x.id !== c.id); render(); }
  }));
}

function viewFamily() {
  const pushOk = 'serviceWorker' in navigator && 'PushManager' in window;
  const myCircles = S.circles.filter((c) => c.user_id === DB.user.id);
  const myCircleIds = new Set(myCircles.map((c) => c.id));
  const myEmail = String(DB.user?.email || '').toLowerCase();
  const myInvites = DB.mode === 'supabase' ? (S.circle_invites || []).filter((i) => i.email.toLowerCase() === myEmail && !S.circle_members.some((m) => m.circle_id === i.circle_id && m.user_id === DB.user.id)) : [];
  const sharedCircles = S.circle_members.filter((m) => m.user_id === DB.user.id && !myCircleIds.has(m.circle_id)).map((m) => S.circles.find((c) => c.id === m.circle_id)).filter(Boolean);
  return `
    <h1>ครอบครัว</h1><p class="sub">คนที่เราดูแล — แตะเพื่อแก้ไขข้อมูล</p>
    ${myCircles.length ? `<h2>วงดูแลของฉัน <span class="small muted">${myCircles.length} วง</span></h2>${myCircles.map((c) => { const shared = (S.circle_care_for || []).filter((cf) => cf.circle_id === c.id).map((cf) => S.profiles.find((p) => p.id === cf.profile_id)).filter(Boolean); return `<div class="card circle"><b>${esc(c.name)}</b><p class="small muted">${esc(c.description || '')}</p><div class="shared-row">${shared.length ? `${shared.map((p) => `<span class="shared-av" title="${esc(p.name)}">${avatarHtml(p, 'xs')}<small>${esc(p.name)}</small></span>`).join('')}` : '<span class="small muted">ยังไม่ได้เลือกข้อมูลที่แชร์</span>'}</div><button class="btn ghost sm" data-act="manage-circle" data-id="${c.id}">⚙️ จัดการ</button></div>`; }).join('')}` : ''}
    ${myInvites.length ? `<h2>คำเชิญเข้าวง <span class="small muted">${myInvites.length} คำเชิญ</span></h2>${myInvites.map((i) => `<div class="card circle"><b>${esc(i.circle_name || 'วงดูแล')}</b><p class="small muted">สิทธิ์: ${i.role === 'viewer' ? 'ดูอย่างเดียว' : 'แก้ไขข้อมูลได้'}</p><div class="row"><button class="btn sm" data-act="accept-invite" data-id="${i.id}">✓ รับคำเชิญ</button><button class="btn ghost sm" data-act="decline-invite" data-id="${i.id}">ปฏิเสธ</button></div></div>`).join('')}` : ''}
    ${sharedCircles.length ?`<h2>วงที่แชร์มา <span class="small muted">${sharedCircles.length} วง</span></h2>${sharedCircles.map((c) => `<div class="card circle shared"><b>${esc(c.name)}</b><p class="small muted">เจ้าของ: ${esc(S.circles.find((x) => x.id === c.id)?.user_id === DB.user.id ? 'ฉัน' : 'คนอื่น')}</p><button class="btn ghost sm danger" data-act="leave-circle" data-id="${c.id}">👋 ออกจากวง</button></div>`).join('')}` : ''}
    <button class="btn block" data-act="new-circle">⚙️ สร้างวงดูแลใหม่</button>
    <h2>คนในครอบครัว</h2>
    ${S.profiles.map((p) => {
      const n = medsOf(p.id).length;
      const next = S.appointments.filter((a) => a.profile_id === p.id && daysUntil(a.appt_date) >= 0).sort((a, b) => a.appt_date.localeCompare(b.appt_date))[0];
      const age = ageOf(p.birth_year);
      const slips = S.appointments.filter((a) => a.profile_id === p.id).reduce((s, a) => s + (a.attachments?.length || 0), 0);
      const cares = S.care_plans.filter((c) => c.profile_id === p.id && c.status === 'active').length;
      return `<div class="card person" style="--pc:${p.color}">
        <div class="person-top" data-act="edit-person" data-id="${p.id}">
          ${avatarHtml(p, 'lg')}
          <div class="info"><b class="pname">${esc(p.name)}</b>
            <div class="small muted">${esc(p.relation || '')}${age ? ` · อายุ ${age} ปี` : ''}${p.blood_type ? ` · กรุ๊ปเลือด ${esc(p.blood_type)}` : ''}</div>
            <div class="small muted">💊 ยา ${n} รายการ${next ? ` · 📅 นัดถัดไป ${thDate(next.appt_date)}` : ''}</div>
          </div>
        </div>
        ${ownsProfile(p.id) ? '' : `<div class="tags">${shareTag(p.id)}</div>`}
        ${p.drug_allergies?.length ? `<div class="tags"><span class="small red-t"><b>แพ้ยา:</b></span> ${tagList(p.drug_allergies, 'allergy')}</div>` : ''}
        ${p.chronic_diseases?.length ? `<div class="tags"><span class="small muted">โรคประจำตัว:</span> ${tagList(p.chronic_diseases)}</div>` : ''}
        <div class="row person-actions">
          <button class="btn ghost sm" data-act="slips" data-id="${p.id}">📄 ใบนัด${slips ? ` (${slips})` : ''}</button>
          <button class="btn ghost sm" data-act="care-of" data-id="${p.id}">🩹 ติดตามอาการ${cares ? ` (${cares})` : ''}</button>
        </div>
        <label class="switch-row"><span>🔔 แจ้งเตือนกินยา</span>
          <span class="switch"><input type="checkbox" data-toggle-reminder="${p.id}" ${p.reminder_enabled ? 'checked' : ''} ${ownsProfile(p.id) ? '' : 'disabled'}><i></i></span></label>
      </div>`;
    }).join('')}
    <button class="btn block" data-act="add-person">+ เพิ่มคนในครอบครัว</button>

    <h2>📞 เบอร์ฉุกเฉิน</h2>
    <div class="card sos-card">
      <a class="sos-btn" href="tel:1669"><span>🚑</span><b>โทร 1669</b><small>เหตุฉุกเฉิน รถพยาบาล</small></a>
      ${(S.emergency_contacts || []).map((h) => `<div class="hos-row"><a class="hos-call" href="tel:${esc(h.phone.replace(/[^\d+]/g, ''))}"><span>🏥</span><b>${esc(h.name)}</b><small>${esc(h.phone)}</small></a><button type="button" class="hos-rm" data-act="del-contact" data-id="${h.id}" aria-label="ลบ ${esc(h.name)}">×</button></div>`).join('')}
      <button class="btn ghost block" data-act="add-contact">+ เพิ่มเบอร์โรงพยาบาล</button>
    </div>

    <h2>ตั้งค่าเวลาแต่ละช่วง (24 ชั่วโมง)</h2>
    <div class="card"><div class="two">
      ${SLOTS.map((s) => { const [hh, mm] = slotTime(s.key).split(':'); const mmOpts = [...new Set(['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', mm])].sort();
      return `<div class="f"><span>${s.icon} ${s.label}</span><div class="t24">
        <select data-slot-hh="${s.key}" aria-label="ชั่วโมง">${Array.from({ length: 24 }, (_, h) => pad(h)).map((h) => `<option ${h === hh ? 'selected' : ''}>${h}</option>`).join('')}</select><b>:</b>
        <select data-slot-mm="${s.key}" aria-label="นาที">${mmOpts.map((m) => `<option ${m === mm ? 'selected' : ''}>${m}</option>`).join('')}</select><small>น.</small></div></div>`; }).join('')}
    </div></div>

    <h2>การแจ้งเตือน</h2>
    <div class="card">
      <p class="small" style="margin-top:0">• นัดหมอ: เตือนล่วงหน้า 5, 2 และ 1 วันเสมอ (รวมหมายเหตุ)<br>• กินยา: เตือนเฉพาะคนและช่วงเวลาที่เปิด 🔔 ไว้</p>
      <button class="btn block" data-act="enable-push" ${pushOk ? '' : 'disabled'}>🔔 เปิดการแจ้งเตือนบนเครื่องนี้</button>
      <button class="btn ghost block" data-act="test-push" style="margin-top:8px">ทดลองส่งแจ้งเตือน</button>
      <p class="small muted" style="margin-bottom:0">${pushOk ? (DB.mode === 'supabase' && CFG.VAPID_PUBLIC_KEY ? 'ใช้ Web Push — เตือนได้แม้ปิดแอพ' : (DB.mode === 'supabase' ? 'ยังไม่ได้ใส่ VAPID key — เตือนได้เฉพาะตอนเปิดแอพค้างไว้' : 'โหมดทดลอง: เตือนได้เฉพาะตอนเปิดแอพค้างไว้')) : 'เบราว์เซอร์นี้ไม่รองรับ Web Push'}
        ${/iPhone|iPad/.test(navigator.userAgent) ? '<br>iPhone: ต้อง "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดจากไอคอนก่อน จึงจะเปิดแจ้งเตือนได้' : ''}</p>
    </div>

    <h2>บัญชี</h2>
    <div class="card">
      <div class="small muted">เข้าสู่ระบบเป็น</div><b>${esc(DB.user?.email || '')}</b>
      ${DB.mode === 'supabase'
        ? `<button class="btn ghost block" data-act="logout" style="margin-top:12px">ออกจากระบบ</button>`
        : `<p class="small muted">ยังไม่ได้เชื่อม Supabase — ข้อมูลอยู่ในเครื่องนี้เท่านั้น</p>
           <div class="row"><button class="btn ghost" data-act="demo">ข้อมูลตัวอย่าง</button><button class="btn danger" data-act="wipe">ล้างข้อมูล</button></div>`}
    </div>
    <p class="small muted center">สุขใจ v0.3 · ใช้ประกอบการดูแล ไม่แทนคำแนะนำของแพทย์/เภสัชกร</p>
  `;
}

// ---------- หน้าเข้าสู่ระบบ ----------
function viewLogin(mode = 'in', msg = '') {
  document.body.classList.add('auth');
  $('#app').innerHTML = `
    <div class="login">
      <img src="icon.svg" alt="" class="login-logo"><h1>สุขใจ</h1><p class="sub">เตือนกินยา & นัดหมอ สำหรับคนที่เรารัก</p>
      <form id="loginForm" class="card">
        <label class="f"><span>อีเมล</span><input type="email" name="email" required autocomplete="email" inputmode="email"></label>
        <label class="f"><span>รหัสผ่าน</span><input type="password" name="password" required minlength="6" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}"></label>
        ${msg ? `<p class="small ${msg.startsWith('✓') ? '' : 'red-t'}">${esc(msg)}</p>` : ''}
        <button class="btn block" type="submit">${mode === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button>
        <button class="btn ghost block" type="button" data-login-mode="${mode === 'in' ? 'up' : 'in'}" style="margin-top:8px">${mode === 'in' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}</button>
        ${mode === 'in' ? '<button class="linkbtn" type="button" data-login-mode="reset">ลืมรหัสผ่าน</button>' : ''}
      </form>
    </div>`;
  $('#loginForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target); const email = fd.get('email').trim(); const pw = fd.get('password');
    const btn = $('button[type=submit]', ev.target); btn.disabled = true; btn.textContent = 'กำลังดำเนินการ…';
    try {
      if (mode === 'in') await DB.signIn(email, pw);
      else { const r = await DB.signUp(email, pw); if (r === 'confirm') return viewLogin('in', '✓ สมัครสำเร็จ — กรุณากดลิงก์ยืนยันในอีเมลก่อนเข้าสู่ระบบ'); }
    } catch (e) {
      const m = /Invalid login/i.test(e.message) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : /not confirmed/i.test(e.message) ? 'ยังไม่ได้ยืนยันอีเมล' : /registered/i.test(e.message) ? 'อีเมลนี้มีบัญชีแล้ว' : e.message;
      viewLogin(mode, m);
    }
  };
  $$('[data-login-mode]').forEach((b) => (b.onclick = async () => {
    if (b.dataset.loginMode !== 'reset') return viewLogin(b.dataset.loginMode);
    const email = $('#loginForm input[name=email]').value.trim();
    if (!email) return viewLogin('in', 'กรอกอีเมลก่อน แล้วกด "ลืมรหัสผ่าน"');
    try { await DB.resetPassword(email); viewLogin('in', '✓ ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว'); } catch (e) { viewLogin('in', e.message); }
  }));
}

// ---------- แสดงผล ----------
function go(tab) { ui.tab = tab; render(); window.scrollTo(0, 0); }
function render() {
  if (!S) return;
  document.body.classList.remove('auth');
  const views = { today: viewToday, meds: viewMeds, calendar: viewCalendar, care: viewCare, family: viewFamily };
  $('#app').innerHTML = views[ui.tab]();
  hydrateImgs($('#app'));
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  if (ui.tab === 'family') initCirclesUI();
}

// ---------- เริ่มทำงาน ----------
async function boot() {
  const useSupa = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase;
  if (CFG.SUPABASE_URL && !window.supabase) toast('โหลดระบบ Supabase ไม่สำเร็จ — ใช้โหมดทดลองแทน');
  DB = useSupa ? new SupaDB(CFG) : new LocalDB();
  let lastUser = null;
  const start = async (user) => {
    if (!user) { S = null; lastUser = null; return viewLogin('in'); }
    if (lastUser === user.id && S) return;
    lastUser = user.id;
    $('#app').innerHTML = '<div class="empty" style="padding-top:30vh">กำลังโหลด…</div>';
    try { S = await DB.loadAll(); } catch (e) { console.error(e); $('#app').innerHTML = `<div class="card empty">โหลดข้อมูลไม่สำเร็จ<br><span class="small">${esc(e.message)}</span><br><button class="btn sm" onclick="location.reload()">ลองใหม่</button></div>`; return; }
    ui.tab = 'today'; // รีเซ็ตแท็บ
    render();
    Notifier.start();
  };
  DB.onAuth((u) => start(u));
  start(await DB.getUser());
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
}
document.addEventListener('DOMContentLoaded', boot);
