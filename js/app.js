/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — สถานะแอพ หน้าจอหลัก และการเริ่มทำงาน */
'use strict';

const CFG = window.SUKJAI_CONFIG || {};
let DB;
let S = null; // ข้อมูลทั้งหมดของผู้ใช้ที่โหลดมาไว้ในหน่วยความจำ

const ui = {
  tab: 'today',
  filter: 'all',            // หน้าวันนี้: เลือกดูทีละคน
  medsPerson: null,         // หน้ายา: คนที่กำลังดู
  calPeople: null,          // หน้าหมอนัด: Set ของคนที่เลือก (null = ทุกคน)
  calMonth: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  calSel: todayKey(),
  careFilter: 'all',        // หน้าติดตามอาการ: เลือกดูทีละคน
  unlocked: {},             // ช่วงเวลาที่กินครบแล้วแต่ผู้ใช้ปลดล็อกเพื่อแก้ (key = profileId:slot:วันที่)
  medsPage: 'hub',          // แท็บยา: hub (เมนู 3 ไอคอน) | list (ยาที่ต้องทาน) | care (ติดตามอาการ) | summary (สรุปการกินยา)
  todayPage: 'home',        // แท็บวันนี้: home (ภาพรวม) | mood (สรุปอารมณ์รายเดือน)
  memberPage: null,         // แท็บสมาชิก: id ของคนที่เปิดดูข้อมูลส่วนตัว
  adPid: null, adYm: null,  // หน้าสรุปการกินยา: คน + เดือน (YYYY-MM)
  moodYm: null,             // หน้าสรุปอารมณ์: เดือน
};

// ---------- ตัวช่วยอ่านข้อมูล ----------
const profileById = (id) => S.profiles.find((p) => p.id === id) || { id, name: 'ไม่ระบุ', avatar: 'f-adult-smile', color: '#9AA5AB', chronic_diseases: [], drug_allergies: [] };
const hospitalById = (id) => S.hospitals.find((h) => h.id === id);
const doctorById = (id) => S.doctors.find((d) => d.id === id);
const profileIndex = (id) => S.profiles.findIndex((p) => p.id === id);
// สิทธิ์ฝั่งแอพ (ฐานข้อมูลบังคับใช้จริงอีกชั้นด้วย RLS): เจ้าของโปรไฟล์ / สมาชิกกลุ่มที่แก้ไขได้ / ดูอย่างเดียว
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
  return `<span class="tag share-tag">👥 แชร์จากกลุ่ม${names.length ? ' ' + esc(names.join(', ')) : 'ผู้ดูแล'} · ${canEditProfile(pid) ? 'แก้ไขได้' : 'ดูอย่างเดียว'}</span>`;
};
// เลขลำดับยา: เรียงต่อเนื่องรายคน + รหัสของคนนั้น เช่น ป1 ป2 ป3
const medPrefix = (pid) => { const p = profileById(pid); return p.med_prefix != null ? p.med_prefix : defaultPrefix(p.name); };
const medNo = (m) => `${medPrefix(m.profile_id)}${m.sort_order}`;
const nextNoFor = (pid) => Math.max(0, ...S.medications.filter((m) => m.profile_id === pid).map((m) => num(m.sort_order))) + 1;
const medsOf = (pid, status = 'active') => S.medications.filter((m) => m.profile_id === pid && (status === 'any' || m.status === status)).sort((a, b) => a.sort_order - b.sort_order);
const dailyUse = (m) => (m.slots?.length || 0) * num(m.dose, 1);
const daysLeft = (m) => (tracksStock(m) && dailyUse(m) && !m.as_needed ? Math.floor(num(m.stock) / dailyUse(m)) : Infinity);
const runoutDate = (m) => { const d = daysLeft(m); return d === Infinity ? null : dk(addDays(new Date(), d)); };
const slotTime = (k) => S.settings.slot_times[k] || DEFAULT_SLOT_TIMES[k];
const slotsByTime = () => [...SLOTS].sort((a, b) => slotTime(a.key).localeCompare(slotTime(b.key)));
const takenLog = (medId, slot, day = todayKey()) => S.med_logs.find((l) => l.medication_id === medId && l.slot === slot && l.log_date === day);
const slotReminderOn = (m, slot) => m.slot_reminders?.[slot] !== false;
const departmentOf = (a) => a.department || '-';
const moodLog = (pid, day = todayKey()) => (S.mood_logs || []).find((l) => l.profile_id === pid && l.log_date === day);
/** โปรไฟล์ "ตัวฉัน" ของบัญชีนี้ (ความสัมพันธ์ = ตัวเอง และเป็นเจ้าของเอง) — อารมณ์รายวันบันทึกได้เฉพาะของตัวเอง */
const selfProfile = () => S.profiles.find((p) => p.relation === 'ตัวเอง' && ownsProfile(p.id));
/** เรียงคนตามลำดับที่ผู้ใช้ตั้งไว้ (ต่อบัญชี) — "ตัวฉัน" อยู่ลำดับแรกเสมอ คนที่ยังไม่อยู่ในลำดับต่อท้ายตามเดิม */
function sortProfiles() {
  const order = S.settings.profile_order || [];
  const self = selfProfile()?.id;
  const pos = (id) => { if (id === self) return -1; const i = order.indexOf(id); return i < 0 ? order.length + profileIndex(id) : i; };
  S.profiles = [...S.profiles].sort((a, b) => pos(a.id) - pos(b.id));
}

/** ตารางทานยา 1 วัน: เรียงตามช่วงเวลา → ภายในช่วงเรียงตามคน แล้วตาม sort_order */
function buildTimeline(profileIds) {
  return slotsByTime().map((slot) => {
    const items = S.medications
      .filter((m) => m.status === 'active' && profileIds.includes(m.profile_id) && m.slots.includes(slot.key) && dueToday(m))
      .sort((a, b) => profileIndex(a.profile_id) - profileIndex(b.profile_id) || a.sort_order - b.sort_order);
    return { slot, time: slotTime(slot.key), items };
  }).filter((x) => x.items.length);
}

async function dbDo(promise) {
  try { await promise; return true; }
  catch (e) { console.error(e); toast('บันทึกไม่สำเร็จ: ' + (e.message || 'ลองใหม่อีกครั้ง')); await reload(); return false; }
}
async function reload() { try { S = await DB.loadAll(); resetMonths(); sortProfiles(); render(); } catch (e) { console.error(e); toast('โหลดข้อมูลไม่สำเร็จ'); } }

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
    ${list.map((p) => `<button class="chip ${isOn(p.id) && !(multi && !sel) ? 'on' : ''}" data-act="${act}" data-id="${p.id}" style="--pc:${p.color};--pt:${inkOn(p.color)}">
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
const bodyText = (p) => [p.weight_kg ? `น้ำหนัก ${num(p.weight_kg)} กก.` : '', p.height_cm ? `ส่วนสูง ${num(p.height_cm)} ซม.` : '', p.waist_cm ? `รอบเอว ${num(p.waist_cm)} ซม.` : ''].filter(Boolean).join(' · ');

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
    <span class="small">${low.map((m) => `${esc(profileById(m.profile_id).name)}: ${esc(medNo(m))} ${esc(m.name)} เหลือ ${num(m.stock)} ${unitOf(m)} — หมดประมาณ ${thDate(runoutDate(m))}`).join('<br>')}</span></div></div>`;
}

// ตารางกินยาใน 1 วัน ของคนหนึ่งคน — แสดงเฉพาะเลขลำดับยา (ติ๊กที่วงกลมเล็ก)
function dayTable(p, nextKey) {
  const meds = medsOf(p.id).filter(dueToday); if (!meds.length) return '';
  const pre = medPrefix(p.id); const canTick = canEditProfile(p.id);
  const cols = SLOTS.map((s) => {
    const list = meds.filter((m) => m.slots.includes(s.key));
    const regular = list.filter((m) => !m.as_needed);
    const allDone = regular.length > 0 && regular.every((m) => takenLog(m.id, s.key));
    return { s, list, locked: allDone && !ui.unlocked[`${p.id}:${s.key}:${todayKey()}`] };
  });
  const nRows = Math.max(...cols.map((c) => c.list.length));
  const wOff = 0.32, total = cols.reduce((a, c) => a + (c.list.length ? 1 : wOff), 0);
  const colgroup = `<colgroup>${cols.map((c) => `<col style="width:${(((c.list.length ? 1 : wOff) / total) * 100).toFixed(2)}%">`).join('')}</colgroup>`;
  const head = cols.map(({ s, list, locked }) => {
    if (!list.length) return `<th class="off" title="${esc(s.label)} (ไม่มียา)" aria-label="${esc(s.label)} ไม่มียา"><span class="ic">${s.icon}</span></th>`;
    const pr = s.short.startsWith('ก่อน') ? 'ก่อน' : 'หลัง';
    return `<th class="th-${s.key} ${s.key === nextKey ? 'next' : ''} ${locked ? 'locked' : ''}"><span class="ic">${s.icon}</span><u>${pr}</u>${esc(s.short.slice(pr.length))}<small>${slotTime(s.key)}</small>${locked
      ? `<button type="button" class="lock-btn" data-act="unlock-slot" data-id="${p.id}" data-slot="${s.key}" aria-label="กินครบแล้ว ล็อกไว้ — แตะเพื่อปลดล็อก">🔒 ครบ</button>`
      : s.key === nextKey ? '<em>ถัดไป</em>' : ''}</th>`;
  }).join('');
  const body = Array.from({ length: nRows }, (_, r) => `<tr>${cols.map(({ s, list, locked }) => {
    if (!list.length) return '<td class="off"></td>';
    const m = list[r]; if (!m) return '<td class="blank"></td>';
    const log = takenLog(m.id, s.key);
    const lockedTick = log && locked;
    const tick = !canTick ? `<span class="tick ${log ? 'on' : ''} ro" aria-label="${log ? 'กินแล้ว' : 'ยังไม่ได้กิน'}">${log ? '✓' : ''}</span>`
      : `<button type="button" class="tick ${log ? 'on' : ''} ${lockedTick ? 'locked' : ''}" data-act="${lockedTick ? 'locked-tick' : 'take'}" data-id="${m.id}" data-slot="${s.key}" aria-label="${lockedTick ? 'กินแล้ว (ล็อกไว้)' : `ติ๊กว่ากินยาลำดับที่ ${esc(medNo(m))} ${esc(m.name)} แล้ว`}">${log ? '✓' : ''}</button>`;
    return `<td class="${m.warning ? 'warn' : ''} ${m.as_needed ? 'pn' : ''} ${log ? 'done' : ''}">
      <div class="dcell">
        <div class="dtop"><span class="wi">${m.warning ? '⚠️' : ''}</span>${tick}</div>
        <div class="dmain" data-act="edit-med" data-id="${m.id}" role="button" tabindex="0" aria-label="ดูรายละเอียดยาลำดับที่ ${esc(medNo(m))} ${esc(m.name)}">
          <b class="onum">${m.as_needed ? '*' : ''}<small class="pfx">${esc(pre)}</small>${m.sort_order}</b>
          <span class="mname">${esc(m.name)}</span>
        </div>
        ${num(m.dose, 1) !== 1 ? `<span class="dpill">${doseLabel(m.dose)} ${esc(unitOf(m))}</span>` : ''}
        ${m.table_hint ? `<small class="hint">${esc(m.table_hint)}</small>` : ''}
      </div></td>`;
  }).join('')}</tr>`).join('');
  const odd = meds.filter((m) => num(m.dose, 1) !== 1).map(medNo);
  const warns = meds.filter((m) => m.warning);
  const upd = latestUpdate(meds);
  return `<section class="dtable" style="--pc:${p.color}">
    <div class="dt-head">${avatarHtml(p, 'sm')}<div><b>ตารางการกินยาใน 1 วัน (${esc(p.name)})</b>
      <div class="small muted">อัปเดต ${upd ? thDateTime(upd) : '-'}</div></div></div>
    <div class="dt-note">ทานยาครั้งละ 1 เม็ด${odd.length ? ` <b>ยกเว้นลำดับที่ ${odd.map(esc).join(', ')}</b> <span>(ดูจำนวนในช่อง)</span>` : ' ทุกรายการ'}</div>
    <table>${colgroup}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${meds.some((m) => m.as_needed) ? '<p class="small muted dt-star">* กินเฉพาะตอนมีอาการเท่านั้น (ช่องสีชมพู)</p>' : ''}
    ${warns.length ? `<div class="dt-warn"><b>⚠️ ข้อควรระวัง</b>${warns.map((m) => `<div>${esc(medNo(m))}. ${esc(m.name)} → ${esc(m.warning)}</div>`).join('')}</div>` : ''}
    <details class="dt-legend" data-legend="${p.id}" ${ui.legendOpen?.[p.id] ? 'open' : ''}><summary>ดูชื่อยาตามเลขลำดับ</summary>
      ${meds.map((m) => `<div class="lg-row"><div class="lg-name"><b>${esc(medNo(m))}.</b> ${esc(m.name)}${m.purpose ? ` <span class="muted">— ${esc(m.purpose)}</span>` : ''}</div>
        <div class="lg-right"><span class="lg-dose">${doseLabel(m.dose)} ${esc(unitOf(m))}</span>${SLOTS.filter((s) => m.slots.includes(s.key)).map((s) => `<button type="button" class="slot-ic" data-act="slot-name" data-label="${esc(s.label)} (${slotTime(s.key)} น.)" title="${esc(s.label)}" aria-label="${esc(s.label)}">${s.icon}</button>`).join('')}</div></div>`).join('')}
      <p class="small muted lg-hint">แตะไอคอนเพื่อดูว่าเป็นช่วงไหน</p>
    </details>
  </section>`;
}

// ---------- หน้า: ยา ----------
function medCard(m) {
  const dl = daysLeft(m); const p = profileById(m.profile_id); const out = runoutDate(m);
  return `<div class="card med" data-id="${m.id}">
    <div class="ordnum" style="background:${p.color};color:${inkOn(p.color)}" aria-label="ยาลำดับที่ ${esc(medNo(m))}">${esc(medNo(m))}</div>
    <div class="info" data-act="edit-med" data-id="${m.id}">
      <div class="name">${esc(m.name)}</div>
      ${m.purpose ? `<div class="small muted">รักษา: ${esc(m.purpose)}</div>` : ''}
      <div class="tags">${weekdaysText(m) ? `<span class="tag sun">📅 ${weekdaysText(m)}</span>` : ''}${m.slots.length ? m.slots.map((s) => `<span class="tag">${slotOf(s).icon} ${slotOf(s).display || slotOf(s).short} ${slotReminderOn(m, s) && p.reminder_enabled ? '🔔' : '🔕'}</span>`).join('') : '<span class="tag sun">ไม่ได้กินประจำวัน · ดูหมายเหตุ</span>'}</div>
      ${m.note ? `<div class="small med-note">📝 ${esc(m.note)}</div>` : ''}
      ${m.status === 'active'
        ? `<div class="small"><span class="${dl <= LOW_STOCK_DAYS ? 'red-t' : 'muted'}">ครั้งละ ${doseLabel(m.dose)} ${esc(unitOf(m))}${tracksStock(m) ? ` · เหลือ ${num(m.stock)} ${esc(unitOf(m))}${out ? ` · หมดประมาณ ${thDate(out)} (อีก ${dl} วัน)` : ''}` : ''}</span></div>`
        : `<div class="small"><span class="tag ${m.status === 'stopped' ? 'allergy' : 'sun'}">${MED_STATUS[m.status]}</span>${m.status_reason ? ' ' + esc(m.status_reason) : ''}</div>`}
      <div class="small muted">อัปเดต ${thDateTime(m.updated_at)}</div>
    </div>
  </div>`;
}

function viewMedList() {
  if (!S.profiles.length) return `${backBar('ยาและการดูแล', 'meds-go', 'hub')}<h1>ยาที่ต้องทาน</h1><div class="card empty"><div class="e">👨‍👩‍👧</div>เพิ่มคนในครอบครัวก่อน<br><button class="btn sm" data-act="add-person" style="margin-top:12px">+ เพิ่มคน</button></div>`;
  if (!S.profiles.some((p) => p.id === ui.medsPerson)) ui.medsPerson = S.profiles[0].id;
  const p = profileById(ui.medsPerson);
  const act = medsOf(p.id);
  const off = S.medications.filter((m) => m.profile_id === p.id && m.status !== 'active').sort((a, b) => a.sort_order - b.sort_order);
  return `
    ${backBar('ยาและการดูแล', 'meds-go', 'hub')}
    <h1>ยาที่ต้องทาน</h1>
    ${personChips(ui.medsPerson, 'meds-person')}
    <div class="two-btn" style="margin:4px 0 10px;grid-template-columns:1fr 1.15fr"><button class="btn ghost" style="white-space:nowrap;padding-inline:8px" data-act="print-meds" data-id="${p.id}">📄 ดาวน์โหลด PDF</button>${canEditProfile(p.id) ? '<button class="btn" data-act="add-med">+ เพิ่มยา</button>' : '<span></span>'}</div>
    ${canEditProfile(p.id) ? lockToggle() : ''}
    ${dayTable(p, null) || ''}
    <p class="sub" style="margin-top:14px">เลขหน้ายา เช่น ${esc(medPrefix(p.id))}1 ${esc(medPrefix(p.id))}2 เรียงต่อเนื่องของแต่ละคน — ตั้งรหัสได้ในข้อมูลของคนนั้น ${canEditProfile(p.id) && ownsProfile(p.id) ? `<button class="linkbtn" data-act="edit-person" data-id="${p.id}">✏️ ตั้งรหัส "${esc(medPrefix(p.id)) || '-'}"</button>` : ''}</p>
    ${shareTag(p.id) ? `<div class="tags">${shareTag(p.id)}</div>` : ''}
    ${p.drug_allergies?.length ? `<div class="alert red"><div class="ic">⚠️</div><div><b>${esc(p.name)} แพ้ยา</b><div class="tags">${tagList(p.drug_allergies, 'allergy')}</div></div></div>` : ''}
    <h2>กำลังกิน <span class="small muted">${act.length} รายการ</span></h2>
    ${act.length > 1 && canEditProfile(p.id) ? `<button class="btn ghost block" data-act="reorder-meds" data-id="${p.id}">↕️ จัดลำดับยาของ${esc(p.name)}</button>` : ''}
    <div id="medList">${act.map(medCard).join('')}</div>
    ${act.length ? '' : `<div class="card empty"><div class="e">💊</div>ยังไม่มียา กดปุ่ม + เพื่อเพิ่ม</div>`}
    <h2>งดชั่วคราว / หยุดแล้ว <span class="small muted">${off.length} รายการ</span></h2>
    ${off.map(medCard).join('') || `<div class="card empty small">ไม่มี</div>`}
  `;
}

// ---------- หน้า: หมอนัด ----------
function viewCalendar() {
  const m = ui.calMonth;
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const visible = S.appointments.filter((a) => !ui.calPeople || ui.calPeople.has(a.profile_id));
  const byDay = {};
  visible.forEach((a) => (byDay[a.appt_date] = byDay[a.appt_date] || []).push(a));
  Object.values(byDay).forEach((l) => l.sort((a, b) => profileIndex(a.profile_id) - profileIndex(b.profile_id) || hhmm(a.appt_time).localeCompare(hhmm(b.appt_time))));
  let cells = DOW.map((d) => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i); const key = dk(d); const list = byDay[key] || [];
    if (i === 35 && d.getMonth() !== m.getMonth()) break; // ไม่แสดงแถวที่ 6 ถ้าไม่จำเป็น
    cells += `<button class="d ${d.getMonth() !== m.getMonth() ? 'out' : ''} ${key === todayKey() ? 'today' : ''} ${key === ui.calSel ? 'sel' : ''}" data-act="sel-day" data-id="${key}">
      ${list.length ? '<svg class="appt-flag" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l3 6.2 6.8.9-5 4.7 1.3 6.7L12 17l-6.1 3.3 1.3-6.7-5-4.7L9 8z" fill="#DAFF3A"/></svg>' : ''}<span class="dn">${d.getDate()}</span>
      <span class="bars">${list.slice(0, 3).map((a) => `<i style="background:${profileById(a.profile_id).color}"></i>`).join('')}${list.length > 3 ? `<em>+${list.length - 3}</em>` : ''}</span></button>`;
  }
  const sel = byDay[ui.calSel] || [];
  const upcoming = visible.filter((a) => daysUntil(a.appt_date) >= 0).sort((a, b) => (a.appt_date + hhmm(a.appt_time)).localeCompare(b.appt_date + hhmm(b.appt_time)));
  return `
    <h1>ปฏิทินนัดหมอ</h1><p class="sub">จุดสีตามสีประจำตัวแต่ละคน · แตะวันที่เพื่อดูนัด</p>
    ${personChips(ui.calPeople, 'cal-person', true)}
    ${S.profiles.length > 1 ? '<button class="linkbtn vis-btn" data-act="reorder-people">↕️ จัดลำดับคน</button>' : ''}
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
    <div class="date" style="background:${p.color};color:${inkOn(p.color)}"><b>${dt.getDate()}</b><span>${MONTHS_S[dt.getMonth()]}</span></div>
    <div class="info">
      <div class="line"><b>${esc(p.name)}</b>${n >= 0 && n <= 5 ? `<span class="countdown ${n <= 1 ? 'hot' : ''}">${whenText(n)}</span>` : ''}</div>
      <div class="small">🕘 ${hhmm(a.appt_time)} น. · ${esc(departmentOf(a))}${a.attachments?.length ? ` · 📎 ${a.attachments.length}` : ''}</div>
      <div class="small muted">👨‍⚕️ ${d ? esc(d.name) : 'ไม่ระบุหมอ'}</div>
    </div><span class="muted">›</span></button>`;
}

// ---------- หน้าต้อนรับ + เข้าสู่ระบบ ----------
function viewLogin(mode = 'in', msg = '') {
  document.body.classList.add('auth');
  if (mode === 'welcome') {
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
    $('#app').innerHTML = `
      <div class="login welcome">
        <div class="welcome-top">
          <img src="icon.svg" alt="" class="login-logo">
          <p class="welcome-greet">วันนี้ทานยาแล้วหรือยัง?</p>
          <h1>สุขใจ</h1>
          <p class="sub">จัดตารางยา จัดใบนัดหมอ<br>แชร์ข้อมูลดูแลครอบครัวพร้อมกัน<br>ในแอพเดียว</p>
        </div>
        <div class="welcome-bottom">
          <button class="btn block" type="button" data-login-mode="in">เริ่มใช้งาน</button>
          <button class="btn ghost block" type="button" data-login-mode="in">มีบัญชีแล้ว เข้าสู่ระบบ</button>
          <p class="small muted center welcome-note">แอพช่วยจัดการตารางยาใน 1 วัน<br>ไม่สามารถทดแทนคำแนะนำของแพทย์/เภสัชกรได้</p>
        </div>
      </div>`;
    $$('[data-login-mode]').forEach((b) => (b.onclick = () => viewLogin(b.dataset.loginMode)));
    return;
  }
  $('#app').innerHTML = `
    <div class="login">
      <img src="icon.svg" alt="" class="login-logo"><h1>สุขใจ</h1><p class="sub">${mode === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกใหม่'}</p>
      <form id="loginForm" class="card">
        <label class="f"><span>อีเมล</span><input type="email" name="email" required autocomplete="email" inputmode="email"></label>
        <label class="f"><span>รหัสผ่าน</span><input type="password" name="password" required minlength="6" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}"></label>
        ${mode === 'up' ? '<label class="f"><span>ยืนยันรหัสผ่าน</span><input type="password" name="password2" required minlength="6" autocomplete="new-password"></label>' : ''}
        ${msg ? `<p class="small ${msg.startsWith('✓') ? '' : 'red-t'}">${esc(msg)}</p>` : ''}
        <button class="btn block" type="submit">${mode === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button>
        <button class="btn ghost block" type="button" data-login-mode="${mode === 'in' ? 'up' : 'in'}" style="margin-top:8px">${mode === 'in' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}</button>
        ${mode === 'in' ? '<button class="linkbtn" type="button" data-login-mode="reset">ลืมรหัสผ่าน</button>' : ''}
        <button class="linkbtn" type="button" data-login-mode="welcome">‹ กลับหน้าแรก</button>
      </form>
    </div>`;
  $('#loginForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target); const email = fd.get('email').trim(); const pw = fd.get('password');
    if (mode === 'up' && pw !== fd.get('password2')) return viewLogin(mode, 'รหัสผ่านสองช่องไม่ตรงกัน');
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
function go(tab) {
  // แตะแท็บที่เปิดอยู่ซ้ำ = กลับหน้าแรกของแท็บนั้น
  if (tab === ui.tab) { if (tab === 'meds') ui.medsPage = 'hub'; if (tab === 'today') ui.todayPage = 'home'; if (tab === 'family') ui.memberPage = null; }
  if (tab === 'care') { ui.medsPage = 'care'; tab = 'meds'; } // ทางเข้าเดิมของติดตามอาการ
  ui.tab = tab; render(); window.scrollTo(0, 0);
}
function render() {
  if (!S) return;
  document.body.classList.remove('auth');
  const views = { today: viewToday, meds: viewMeds, calendar: viewCalendar, family: viewMembers, settings: viewSettings };
  $('#app').innerHTML = views[ui.tab]();
  hydrateImgs($('#app'));
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  navSync();
}

// ---------- ปุ่มย้อนกลับของมือถือ/เบราว์เซอร์ ใช้ถอยทีละหน้าในแอพ (ไม่ออกจากแอพทันที) ----------
// เก็บเฉพาะ "หน้า" (ไม่รวมคนที่เลือก/เดือนที่ดู) เพื่อไม่ให้การกดเปลี่ยนคนหรือเลื่อนเดือนกลายเป็นหน้าใหม่ในประวัติ
const navSnap = () => ({ tab: ui.tab, medsPage: ui.medsPage, todayPage: ui.todayPage, memberPage: ui.memberPage });
let navKey = null, navDepth = 0, navPopping = false, navIgnore = 0; const navHist = [];
function navSync() {
  if (navPopping) return;
  const s = navSnap(); const k = JSON.stringify(s); if (k === navKey) return;
  const first = navKey === null; navKey = k;
  if (first) navDepth = 0; else navDepth++;
  navHist[navDepth] = s; navHist.length = navDepth + 1;
  try { if (first) history.replaceState({ n: 0, s }, '', location.href); else history.pushState({ n: navDepth, s }, '', location.href); }
  catch { /* ไม่รองรับ history — ใช้ปุ่มย้อนกลับในแอพแทน */ }
}
/** หน้าที่เพิ่งมาจาก (ใช้บอกบนปุ่มย้อนกลับว่ากลับไปหน้าไหน) */
function navPrevSnap() { const synced = JSON.stringify(navSnap()) === navKey; return navHist[synced ? navDepth - 1 : navDepth] || null; }
window.addEventListener('popstate', (e) => {
  if (navIgnore > 0) { navIgnore--; return; }
  if (!S || !e.state || !e.state.s) return;
  const modal = document.getElementById('modal');
  if (modal && !modal.classList.contains('hidden')) { closeSheet(); navIgnore++; history.go(1); return; } // มีหน้าต่างเด้งเปิดอยู่ → ปิดหน้าต่างก่อน
  navPopping = true; Object.assign(ui, e.state.s); navDepth = e.state.n; navKey = JSON.stringify(e.state.s);
  render(); window.scrollTo(0, 0); navPopping = false;
});

// ---------- โลโก้เคลื่อนไหว ----------
// ใช้ assets/logo.gif (ยาเม็ด+แคปซูลขยับ) แทนโลโก้ภาพนิ่ง ในหน้าต้อนรับ/เข้าสู่ระบบ/วันนี้
// ผู้ใช้ที่ตั้งเครื่องให้ "ลดการเคลื่อนไหว" หรือโหลดไฟล์ไม่ได้ จะเห็น icon.svg ตามเดิม

function animateLogos() {
  $$('#app img.logo, #app img.login-logo').forEach((img) => {
    const box = document.createElement('span');
    box.className = 'app-ic ' + (img.classList.contains('logo') ? 'ic-sm' : 'ic-lg');
    box.innerHTML = logoSvg();
    img.replaceWith(box);
  });
}new MutationObserver(() => animateLogos()).observe(document.getElementById('app'), { childList: true });

/** รูปใบนัดเก็บ 1 ปีนับจากวันนัด แล้วลบอัตโนมัติ (รูปอื่นๆ เช่นรูปติดตามอาการ เก็บไว้ตลอด) — ลบเฉพาะไฟล์ที่เราอัปโหลดเอง */
const SLIP_KEEP_DAYS = 365;
async function purgeOldSlips() {
  const cutoff = dk(addDays(new Date(), -SLIP_KEEP_DAYS)); let changed = 0;
  for (const a of S.appointments) {
    if (!a.attachments?.length || a.appt_date >= cutoff) continue;
    const mine = a.attachments.filter((x) => DB.mode !== 'supabase' || String(x).startsWith(`${DB.user.id}/`));
    if (!mine.length) continue;
    const keep = a.attachments.filter((x) => !mine.includes(x));
    try {
      await DB.update('appointments', a.id, { attachments: keep }); // แก้ข้อมูลก่อน แล้วค่อยลบไฟล์ (กันลิงก์ค้าง)
      a.attachments = keep; changed++;
      if (DB.mode === 'supabase') await DB.removeFiles(mine).catch(() => {});
    } catch (e) { console.warn('ลบรูปใบนัดเก่าไม่สำเร็จ', e); }
  }
  if (changed) { console.info(`ลบรูปใบนัดที่เก็บครบ 1 ปีแล้ว ${changed} นัด`); render(); }
}
/** ย้ายสีประจำตัวชุดเก่าของโปรไฟล์ที่เราเป็นเจ้าของ ไปเป็นชุดใหม่ที่เข้ากับสีหลัก */
async function migrateColors() {
  const jobs = [];
  S.profiles.forEach((p) => { const n = LEGACY_COLORS[String(p.color).toUpperCase()]; if (n && ownsProfile(p.id)) { p.color = n; jobs.push(DB.update('profiles', p.id, { color: n })); } });
  if (jobs.length) await Promise.allSettled(jobs);
}

// ---------- เริ่มทำงาน ----------
async function boot() {
  const useSupa = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase;
  if (CFG.SUPABASE_URL && !window.supabase) toast('โหลดระบบ Supabase ไม่สำเร็จ — ใช้โหมดทดลองแทน');
  DB = useSupa ? new SupaDB(CFG) : new LocalDB();
  let lastUser = null; let loading = null;
  const start = async (user) => {
    if (!user) { S = null; lastUser = null; return viewLogin('welcome'); }
    if (lastUser === user.id && S) return;
    if (loading === user.id) return;
    loading = user.id;
    try {
      $('#app').innerHTML = '<div class="empty" style="padding-top:30vh">กำลังโหลด…</div>';
      try { S = await DB.loadAll(); } catch (e) { console.error(e); $('#app').innerHTML = `<div class="card empty">โหลดข้อมูลไม่สำเร็จ<br><span class="small">${esc(e.message)}</span><br><button class="btn sm" onclick="location.reload()">ลองใหม่</button></div>`; return; }
      lastUser = user.id;
      await migrateColors();
      sortProfiles();
      setTimeout(() => purgeOldSlips(), 3000); // ทำเบื้องหลังหลังเปิดแอพ ไม่รบกวนการใช้งาน
      ui.tab = 'today'; // รีเซ็ตแท็บ
      showSplash(); // หน้า intro แสดงก่อนเสมอ (ทับหน้าที่โหลดอยู่ด้านล่าง แล้วจางหายไป)
      // PDPA: ต้องยินยอมการเก็บข้อมูลสุขภาพก่อนใช้งานครั้งแรก (และเมื่อเนื้อหาความยินยอมเปลี่ยน)
      if (DB.mode === 'supabase' && S.settings.pdpa_version !== PDPA_VERSION) return consentView(() => { render(); Notifier.start(); showSplash(); });
      render();
      Notifier.start();
      showSplash();
    } finally { loading = null; }
  };
  // กดลิงก์ "ตั้งรหัสผ่านใหม่" จากอีเมล → เข้าแอพแล้วเด้งหน้าตั้งรหัสผ่านใหม่ทันที
  DB.onAuth(async (u, ev) => { await start(u); if (ev === 'PASSWORD_RECOVERY' && u) passwordForm(true); });
  start(await DB.getUser());
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
}
document.addEventListener('DOMContentLoaded', boot);
