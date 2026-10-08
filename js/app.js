/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — สถานะแอป หน้าจอหลัก และการเริ่มทำงาน */
'use strict';

const CFG = window.SUKJAI_CONFIG || {};
let DB;
let S = null; // ข้อมูลทั้งหมดของผู้ใช้ที่โหลดมาไว้ในหน่วยความจำ

const ui = {
  tab: 'today',
  filter: 'all',            // หน้าวันนี้: เลือกดูทีละคน
  medsPerson: null,         // หน้ายา: คนที่กำลังดู
  calPeople: null,          // หน้านัดพบหมอ: Set ของคนที่เลือก (null = ทุกคน)
  calMonth: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  calSel: todayKey(),
  careFilter: 'all',        // หน้าติดตามการรักษา: เลือกดูทีละคน
  unlocked: {},             // ช่วงเวลาที่กินครบแล้วแต่ผู้ใช้ปลดล็อกเพื่อแก้ (key = profileId:slot:วันที่)
  medsPage: 'hub',          // แท็บยา: hub (เมนู 3 ไอคอน) | list (ยาที่ต้องทาน) | care (ติดตามการรักษา) | summary (สรุปการกินยา)
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
// สิทธิ์ฝั่งแอป (ฐานข้อมูลบังคับใช้จริงอีกชั้นด้วย RLS): เจ้าของโปรไฟล์ / สมาชิกกลุ่มที่แก้ไขได้ / ดูอย่างเดียว
const ownsProfile = (pid) => { const p = profileById(pid); return !!p && (DB.mode !== 'supabase' || !p.user_id || p.user_id === DB.user.id); };
const canEditProfile = (pid) => {
  if (DB.offline) return false; // ออฟไลน์ = ดูอย่างเดียว
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
/** ความสัมพันธ์ที่แสดง: ของตัวเอง = ที่กรอกในโปรไฟล์ · ของที่คนอื่นแชร์มา = ที่ผู้ดูตั้งเองในบัญชีตัวเอง (ค่าที่เจ้าของกรอกเป็นมุมของเขา จึงไม่นำมาแสดง) */
const relOf = (p) => (ownsProfile(p.id) ? (p.relation || '') : (S.settings?.profile_relations?.[p.id] || ''));
const circleLabel = (n) => { const s = String(n || '').trim(); return /^กลุ่ม/.test(s) ? s : (s ? `กลุ่ม${s}` : 'กลุ่มผู้ดูแล'); };
const shareTag = (pid) => {
  if (ownsProfile(pid)) return '';
  const names = circleNamesOf(pid);
  return `<span class="tag share-tag">👥 แชร์จาก${names.length ? ' ' + esc(names.map(circleLabel).join(', ')) : 'กลุ่มผู้ดูแล'} · ${canEditProfile(pid) ? 'แก้ไขได้' : 'ดูอย่างเดียว'}</span>`;
};
// เลขลำดับยา: เรียงต่อเนื่องรายคน + รหัสของคนนั้น เช่น ป1 ป2 ป3
const medPrefix = (pid) => { const p = profileById(pid); return p.med_prefix != null ? p.med_prefix : defaultPrefix(p.name); };
const medNo = (m) => `${medPrefix(m.profile_id)}${m.sort_order}`;
/** รหัสยาถัดไปของคนนี้ = เลขว่างต่ำสุดที่ยังไม่มียา "กำลังทาน" ใช้ — ยางดชั่วคราว/หยุดแล้วปล่อยเลขคืน คนอื่นเอาไปใช้ซ้ำได้ */
const nextNoFor = (pid, exceptId = null) => { const used = new Set(S.medications.filter((m) => m.profile_id === pid && m.status === 'active' && m.id !== exceptId).map((m) => num(m.sort_order))); let n = 1; while (used.has(n)) n++; return n; };
const medsOf = (pid, status = 'active') => S.medications.filter((m) => m.profile_id === pid && (status === 'any' || m.status === status)).sort((a, b) => a.sort_order - b.sort_order);
const dailyUse = (m) => (m.slots?.length || 0) * num(m.dose, 1) * ((m.weekdays?.length || 7) / 7);
const daysLeft = (m) => (tracksStock(m) && dailyUse(m) && !m.as_needed ? Math.floor(stockLeft(m) / dailyUse(m)) : Infinity);
const runoutDate = (m) => { const d = daysLeft(m); return d === Infinity ? null : dk(addDays(new Date(), d)); };
const slotTime = (k) => S.settings.slot_times[k] || DEFAULT_SLOT_TIMES[k];
const slotsByTime = () => [...SLOTS].sort((a, b) => slotTime(a.key).localeCompare(slotTime(b.key)));
const takenLog = (medId, slot, day = todayKey()) => S.med_logs.find((l) => l.medication_id === medId && l.slot === slot && l.log_date === day);
const slotReminderOn = (m, slot) => true; // เตือนทุกยา/ทุกช่วงเวลาของคนที่เปิดเตือนไว้ (ไม่มีตัวเลือกรายยาแล้ว — ค่า slot_reminders เดิมในฐานข้อมูลไม่มีผล)
const departmentOf = (a) => a.department || '-';
const moodLog = (pid, day = todayKey()) => (S.mood_logs || []).find((l) => l.profile_id === pid && l.log_date === day);
/** โปรไฟล์นี้คือ "โปรไฟล์ของฉัน" หรือไม่ — ใช้คอลัมน์ is_self (limits-v2.sql) · ถ้าฐานข้อมูลยังไม่มีคอลัมน์ (โหมดทดลอง/ยังไม่รัน SQL) ใช้ความสัมพันธ์ "ตัวเอง" แทน */
const isSelfProfile = (p) => (p.is_self === undefined ? p.relation === 'ตัวเอง' : p.is_self === true);
/** โปรไฟล์ "ตัวฉัน" ของบัญชีนี้ (เป็นเจ้าของเอง และเป็นโปรไฟล์ของฉัน) — อารมณ์รายวันบันทึกได้เฉพาะของตัวเอง */
const selfProfile = () => S.profiles.find((p) => ownsProfile(p.id) && isSelfProfile(p));
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
  catch (e) {
    console.error(e); const m = /PREMIUM_REQUIRED:(\w+)/.exec(e.message || '');
    if (m) { await reload(); if (typeof premiumSheet === 'function') premiumSheet(m[1]); return false; } // ฐานข้อมูลบังคับเพดานแพ็กเกจฟรีซ้ำอีกชั้น
    toast('บันทึกไม่สำเร็จ: ' + (e.message || 'ลองใหม่อีกครั้ง')); await reload(); return false;
  }
}
async function reload() { try { S = await DB.loadAll(); resetMonths(); sortProfiles(); render(); } catch (e) { console.error(e); toast('โหลดข้อมูลไม่สำเร็จ'); } }

// รูปใน Storage ต้องขอ URL ก่อนแสดง — ใส่ <img data-path="..."> แล้วเรียก hydrateImgs (จำ URL ไว้ 50 นาที)
const urlCache = new Map();
async function fileUrlCached(path) {
  const c = urlCache.get(path); if (c && c.exp > Date.now()) return c.url;
  const url = await DB.fileUrl(path); urlCache.set(path, { url, exp: Date.now() + 50 * 60e3 }); return url;
}
// ไอคอนกล้อง (เส้นเรียบ วาดเอง) ใช้เป็นกรอบแทนรูปที่ยังไม่มี/โหลดไม่ได้ — แทนที่จะโชว์ข้อความ alt เป็นตัวหนังสือ
const CAM_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>';
const noPicHtml = (txt = 'ยังไม่มีรูป') => `<span class="img-ph">${CAM_SVG}<small>${txt}</small></span>`;
/** โหลดรูปจาก Storage: ลองใหม่ 1 ครั้งด้วยลิงก์ใหม่ (กันลิงก์หมดอายุ) · ถ้ายังไม่ได้ แสดงกรอบ "โหลดรูปไม่ได้" และบันทึกสาเหตุใน console */
function hydrateImgs(root) {
  $$('img[data-path]', root).forEach(async (img) => {
    const path = img.dataset.path; const fail = (why) => { console.warn('โหลดรูปไม่ได้:', path, why); const ph = document.createElement('span'); ph.innerHTML = noPicHtml('โหลดรูปไม่ได้'); img.replaceWith(ph.firstChild); };
    const load = (url) => new Promise((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('ไฟล์รูปเปิดไม่ได้ (ลบแล้ว/ไม่มีสิทธิ์/เสียหาย)')); img.src = url; });
    try { await load(await fileUrlCached(path)); }
    catch (e1) {
      try { urlCache.delete(path); await load(await fileUrlCached(path)); }
      catch (e2) { fail(e2?.message || e1?.message || 'ขอลิงก์รูปไม่สำเร็จ (ไม่มีไฟล์หรือไม่มีสิทธิ์อ่าน)'); }
    }
  });
}

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

const tagList = (arr, cls = '') => (arr || []).map((t) => `<span class="tag ${cls}">${esc(t)}</span>`).join('');
const whenText = (n) => (n === 0 ? 'วันนี้' : n === 1 ? 'พรุ่งนี้' : `อีก ${n} วัน`);
const bodyText = (p) => [p.weight_kg ? `น้ำหนัก ${num(p.weight_kg)} กก.` : '', p.height_cm ? `ส่วนสูง ${num(p.height_cm)} ซม.` : '', p.waist_cm ? `รอบเอว ${num(p.waist_cm)} ซม.` : ''].filter(Boolean).join(' · ');

function apptAlerts(ids) {
  return S.appointments
    .filter((a) => ids.includes(a.profile_id))
    .map((a) => ({ a, n: daysUntil(a.appt_date) }))
    .filter(({ n }) => n >= 0 && n <= Math.max(...(remindDays().length ? remindDays() : REMIND_DAYS)))
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
  const low = S.medications.filter((m) => m.status === 'active' && ids.includes(m.profile_id) && isLowStock(m));
  if (!low.length) return '';
  return `<div class="alert red"><div class="ic">📦</div><div><b>ยาใกล้หมด ควรเตรียมรับยาเพิ่ม</b>
    <span class="small">${low.map((m) => `${esc(profileById(m.profile_id).name)}: ${esc(medNo(m))} ${esc(m.name)} เหลือ ${qtyText(stockLeft(m))} ${unitOf(m)} — หมดประมาณ ${thDate(runoutDate(m))}`).join('<br>')}</span></div></div>`;
}

// ตารางกินยาใน 1 วัน ของคนหนึ่งคน — แสดงเฉพาะเลขลำดับยา (ติ๊กที่วงกลมเล็ก)
function dayTable(p, nextKey) {
  const meds = medsOf(p.id).filter(dueToday); if (!meds.length) return '';
  const pre = medPrefix(p.id); const canTick = ownsProfile(p.id) && !DB.offline; // ติ๊กกินยาได้เฉพาะเจ้าของโปรไฟล์ — สมาชิกในกลุ่มเห็นสถานะ (ดูอย่างเดียว)
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
    const tick = !canTick ? `<span class="tick ${log ? 'on' : ''} ro" aria-label="${log ? 'กินแล้ว' : 'ยังไม่มีบันทึกการกินยา'}">${log ? '✓' : ''}</span>`
      : `<button type="button" class="tick ${log ? 'on' : ''} ${lockedTick ? 'locked' : ''}" data-act="${lockedTick ? 'locked-tick' : 'take'}" data-id="${m.id}" data-slot="${s.key}" aria-label="${lockedTick ? 'กินแล้ว (ล็อกไว้)' : `ติ๊กว่ากินยารหัส ${esc(medNo(m))} ${esc(m.name)} แล้ว`}">${log ? '✓' : ''}</button>`;
    return `<td class="${m.warning ? 'warn' : ''} ${m.as_needed ? 'pn' : ''} ${log ? 'done' : ''}">
      <div class="dcell">
        <div class="dtop"><span class="wi">${m.warning ? '⚠️' : ''}</span>${tick}</div>
        <div class="dmain" data-act="edit-med" data-id="${m.id}" role="button" tabindex="0" aria-label="ดูรายละเอียดยารหัส ${esc(medNo(m))} ${esc(m.name)}">
          <b class="onum">${m.as_needed ? '*' : ''}<small class="pfx">${esc(pre)}</small>${m.sort_order}</b>
          <span class="mname">${esc(medShort(m))}</span>${showAsn(m) ? '<small class="asn">เมื่อมีอาการ</small>' : ''}
        </div>
        ${num(m.dose, 1) !== 1 ? `<span class="dpill">${doseLabel(m.dose)} ${esc(unitOf(m))}</span>` : ''}
        ${m.table_hint ? `<small class="hint">${esc(m.table_hint)}</small>` : ''}
      </div></td>`;
  }).join('')}</tr>`).join('');
  const odd = meds.filter((m) => num(m.dose, 1) !== 1).map(medNo);
  const warns = meds.filter((m) => m.warning);
  const upd = latestUpdate(meds);
  return `<section class="dtable" style="--pc:${p.color}">
    <div class="dt-head">${avatarHtml(p, 'sm')}<div><b>ตารางการกินยาใน 1 วัน</b><br><b>(${esc(p.name)})</b>
      <div class="small muted">อัปเดต ${upd ? thDateTime(upd) : '-'}</div></div><button class="btn ghost sm dt-pdf" data-act="print-meds" data-id="${p.id}">📄 ไฟล์ PDF</button></div>
    <div class="dt-note">ทานยาครั้งละ 1 เม็ด${odd.length ? ` <b>ยกเว้นรหัส ${odd.map(esc).join(', ')}</b> <span>(ดูจำนวนในช่อง)</span>` : ' ทุกรายการ'}</div>
    <table>${colgroup}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    ${meds.some((m) => m.as_needed) ? '<p class="small muted dt-star">* กินเฉพาะตอนมีอาการเท่านั้น (ช่องสีชมพู)</p>' : ''}
    ${warns.length ? `<div class="dt-warn"><b>⚠️ ข้อควรระวัง</b><table class="dt-wt"><colgroup><col style="width:17%"><col style="width:29%"><col></colgroup><thead><tr><th>รหัสยา</th><th>ชื่อยา</th><th>ข้อควรระวัง</th></tr></thead><tbody>${warns.map((m) => `<tr><td class="c">${esc(medNo(m))}</td><td>${esc(m.name)}</td><td>${esc(m.warning)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <p class="small muted dt-check">${CHECK_MEDS_NOTE}</p>
  </section>`;
}

// ---------- หน้า: ยา ----------
function medCard(m) {
  const dl = daysLeft(m); const p = profileById(m.profile_id); const out = runoutDate(m);
  const wd = weekdaysText(m); const open = !!ui.medOpen?.[m.id];
  const slotsTxt = m.slots.length ? m.slots.map((s) => `<span class="tag">${slotOf(s).icon} ${wd ? `<b>วัน</b>${esc(wd)} · ` : ''}${slotOf(s).display || slotOf(s).short} ${slotReminderOn(m, s) && reminderOn(p) ? '🔔' : '🔕'}</span>`).join('') : '<span class="tag sun">ไม่ได้กินประจำวัน</span>';
  const kv = (k, v) => `<div class="mr-kv"><span>${k}</span><b>${v}</b></div>`;
  const stock = tracksStock(m) ? kv('จำนวนที่เหลือ', `<span class="${isLowStock(m) ? 'red-t' : ''}">${qtyText(stockLeft(m))} ${esc(unitOf(m))}${out ? `<br><small>หมดประมาณ ${thDate(out)} (อีก ${dl} วัน)</small>` : ''}</span>`) : (m.bottles != null ? kv('จำนวนขวดที่มี', `${qtyText(num(m.bottles))} ขวด` +'<br><small>ต้องนับจำนวนที่เหลือเอง</small>') : '');
  return `<div class="mrow ${open ? 'open' : ''}" data-id="${m.id}">
    <button type="button" class="mr-main" data-act="med-toggle" data-id="${m.id}" aria-expanded="${open}">
      <span class="mr-no">${m.status !== 'active' ? '' : `<span class="ordnum" style="background:${p.color};color:${inkOn(p.color)}" aria-label="รหัสยา ${esc(medNo(m))}">${esc(medNo(m))}</span>`}</span>
      <span class="mr-nm"><b class="name">${esc(m.name)}</b>${m.as_needed ? ' <span class="tag pn-tag">ทานเฉพาะเมื่อมีอาการ</span>' : ''}<span class="tags">${slotsTxt}<span class="tag dose-tag">ครั้งละ <b>${doseLabel(m.dose)} ${esc(unitOf(m))}</b></span></span>${m.purpose ? `<small class="muted">รักษา: ${esc(m.purpose)}</small>` : ''}${m.status !== 'active' ? `<small><span class="tag ${m.status === 'stopped' ? 'allergy' : 'paused'}">${MED_STATUS[m.status]}</span>${m.status_reason ? ' ' + esc(m.status_reason) : ''}</small>` : ''}</span>
      <span class="mr-chev">${open ? '▴' : '▾'}</span>
    </button>
    <div class="mr-more" ${open ? '' : 'hidden'}>
      ${stock}
      ${m.prescriber ? kv('หมอที่จ่ายยา', esc(m.prescriber)) : ''}${m.prescribed_dept ? kv('แผนกที่จ่ายยา', esc(m.prescribed_dept)) : ''}
      ${m.warning ? kv('หมายเหตุ / ข้อควรระวัง', `<span class="red-t">${esc(m.warning)}</span>`) : ''}${noteShown(m) ? kv('หมายเหตุ', esc(noteShown(m))) : ''}${m.extra_note ? kv('บันทึกเพิ่มเติม', `<span style="white-space:pre-line">${esc(m.extra_note)}</span>`) : ''}
      <div class="mr-foot"><span class="med-upd">อัปเดต ${thDateTime(m.updated_at)}</span><span class="mr-btns">${canEditProfile(m.profile_id) ? `<button type="button" class="btn sm ghost" data-act="add-stock" data-id="${m.id}">➕ ได้ยามาเพิ่ม</button>` : ''}<button type="button" class="btn sm" data-act="edit-med" data-id="${m.id}">✏️ แก้ไขยา</button></span></div>
    </div>
  </div>`;
}
function viewMedList() {
  if (!S.profiles.length) return `${backBar('ยาและการดูแล', 'meds-go', 'hub')}<h1>ยาที่ต้องทาน</h1><div class="card empty"><div class="e">👨‍👩‍👧</div>เพิ่มคนในครอบครัวก่อน<br><button class="btn sm" data-act="add-person" style="margin-top:12px">+ เพิ่มคน</button></div>`;
  // ใช้การตั้งค่า "เลือกคนที่จะแสดง" ชุดเดียวกับหน้าวันนี้ (ตั้งได้เฉพาะบัญชีนี้ ไม่กระทบคนอื่นในกลุ่ม)
  const vis = todayProfiles(); const nHidden = todayHidden().filter((id) => S.profiles.some((x) => x.id === id)).length;
  const visBtn = `<div class="tool-row"><button class="pill-btn" data-act="today-visibility">เลือกคนที่จะแสดง${nHidden ? ` (ซ่อน ${nHidden})` : ''}</button></div>`;
  if (!vis.length) return `${backBar('ยาและการดูแล', 'meds-go', 'hub')}<h1>ยาที่ต้องทาน</h1>${visBtn}<div class="card empty"><div class="e">👁️</div>ซ่อนทุกคนอยู่ — กด "เลือกคนที่จะแสดง" ด้านบน</div>`;
  if (!vis.some((x) => x.id === ui.medsPerson)) ui.medsPerson = vis[0].id;
  const p = profileById(ui.medsPerson);
  const act = medsOf(p.id); const mq = norm(ui.medsQ);
  const off = S.medications.filter((m) => m.profile_id === p.id && m.status !== 'active').sort((a, b) => String(a.name).localeCompare(String(b.name), 'en', { sensitivity: 'base' }) || a.sort_order - b.sort_order); // เรียงตามชื่อ A-Z (ภาษาอังกฤษก่อน แล้วไทย)
  return `
    ${backBar('ยาและการดูแล', 'meds-go', 'hub')}
    <h1>ยาที่ต้องทาน</h1>
    ${visBtn}
    ${personChips(ui.medsPerson, 'meds-person', false, false, vis)}
    <div class="tool-pair"><button class="btn ghost" data-act="stickers" data-id="${p.id}"><span class="tp-ic">⭐</span><span class="tp-tx">สติกเกอร์ช่วงเวลา<br>และรหัสยา (PDF)</span></button>${canEditProfile(p.id) ? lockToggle() : ''}</div>
    
    ${dayTable(p, null) || ''}
    
    ${shareTag(p.id) ? `<div class="tags">${shareTag(p.id)}</div>` : ''}
    ${p.drug_allergies?.length ? `<div class="alert red"><div class="ic">⚠️</div><div><b>${esc(p.name)} แพ้ยา</b><div class="tags">${tagList(p.drug_allergies, 'allergy')}</div></div></div>` : ''}
    <h2 class="fold-h"><button type="button" class="fold-btn" data-act="meds-fold" aria-expanded="${!ui.medsFold}"><span>ยาที่กำลังทาน <span class="small muted">${act.length} ตัว</span></span><span class="fold-chev">${ui.medsFold ? '▸' : '▾'}</span></button></h2>
    <div class="med-group" id="medsFoldBody"${ui.medsFold ? ' hidden' : ''}>${act.length ? `<input type="search" id="medQ" class="stk-search" placeholder="ค้นหาชื่อยา" value="${esc(ui.medsQ || '')}" autocomplete="off" aria-label="ค้นหาชื่อยา"><p class="small muted med-none"${act.some((m) => !mq || norm(m.name).includes(mq)) ? ' hidden' : ''}>ไม่พบยาที่ค้นหา</p>` : ''}${act.length ? '<div class="med-head"><span>รหัสยา</span><span>ชื่อยา</span></div>' : ''}<div id="medList" class="mtable">${act.map((m) => medCard(m).replace('class="mrow', `data-q="${esc(norm(m.name))}"${mq && !norm(m.name).includes(mq) ? ' hidden' : ''} class="mrow`)).join('')}</div></div>
    ${act.length ? '' : `<div class="card empty"><div class="e">💊</div>ยังไม่มียา กดปุ่ม + เพื่อเพิ่ม</div>`}
    ${canEditProfile(p.id) ? '<button class="fab" data-act="add-med" aria-label="เพิ่มยา">+</button>' : ''}
    <h2${off.length ? ' class="fold-h"' : ''}>${off.length ? `<button type="button" class="fold-btn" data-act="off-fold" aria-expanded="${!ui.offFold}"><span>งดชั่วคราว / หยุดแล้ว <span class="small muted">${off.length} ตัว</span></span><span class="fold-chev">${ui.offFold ? '▸' : '▾'}</span></button>` : 'งดชั่วคราว / หยุดแล้ว <span class="small muted">0 ตัว</span>'}</h2>
    ${off.length ? `<div class="med-group" id="offFoldBody"${ui.offFold ? ' hidden' : ''}><div class="mtable">${off.map(medCard).join('')}</div></div>` : `<div class="card empty small">ไม่มี</div>`}
  `;
}

// ---------- หน้า: นัดพบหมอ ----------
/** สีของคนในปฏิทิน/รายการนัด: ถ้ามีหลายคนใช้สีประจำตัวเดียวกัน (เช่น ต่างคนต่างแชร์มาแล้วเลือกสีซ้ำ) คนแรกคงสีเดิม คนถัดไปปรับให้เข้มขึ้น/อ่อนลงสลับกัน จะได้แยกออก — ไม่แก้สีที่บันทึกไว้ */
function calColor(pid) {
  const p = S.profiles.find((x) => x.id === pid); if (!p) return '#999999';
  const key = String(p.color || '').toLowerCase(); const same = S.profiles.filter((x) => String(x.color || '').toLowerCase() === key);
  const k = same.findIndex((x) => x.id === pid); if (k <= 0) return p.color;
  const amt = [0, .28, .3, .5, .52][Math.min(k, 4)]; const toward = k % 2 === 1 ? 0 : 255; // คี่ = เข้มขึ้น (ผสมดำ) · คู่ = อ่อนลง (ผสมขาว)
  const n = parseInt(String(p.color).replace('#', '').padEnd(6, '0').slice(0, 6), 16); const mix = (v) => Math.round(v + (toward - v) * amt).toString(16).padStart(2, '0');
  return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}
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
      <span class="bars">${list.map((a) => `<i style="background:${calColor(a.profile_id)}"></i>`).join('')}</span></button>`;
  }
  const sel = byDay[ui.calSel] || [];
  const upcoming = visible.filter((a) => daysUntil(a.appt_date) >= 0).sort((a, b) => (a.appt_date + hhmm(a.appt_time)).localeCompare(b.appt_date + hhmm(b.appt_time)));
  return `
    <h1>นัดพบหมอ</h1><p class="sub">จุดสีตามสีประจำตัวแต่ละคน · แตะวันที่เพื่อดูนัด</p>
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
  const pc = calColor(a.profile_id);
  return `<button class="card appt" data-act="appt-detail" data-id="${a.id}" style="${n < 0 ? 'opacity:.6' : ''}">
    <div class="date" style="background:${pc};color:${inkOn(pc)}"><b>${dt.getDate()}</b><span>${MONTHS_S[dt.getMonth()]}</span></div>
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
      <div class="wel-screen">
        <div class="sp-deco" aria-hidden="true"><i class="d d-ring"></i><i class="d d-blob"></i><i class="d d-cap c1"></i><i class="d d-cap c2"></i><i class="d d-cap c3"></i><b class="d d-star s1">✱</b><b class="d d-star s2">✱</b><b class="d d-star s3">✱</b></div>
        <div class="sp-inner">
          <span class="app-ic ic-xl sp-logo">${logoSvg()}</span>
          <h1 class="sp-name">สุขใจ</h1>
          <p class="sp-stars" aria-hidden="true">✱ ✱ ✱</p>
          <p class="sp-slogan"><span>ช่วยจัดตารางยาและใบนัด</span><span><b>แชร์ข้อมูลให้ทั้งครอบครัวดูแลไปพร้อมกัน<span class="kt">ในแอปเดียว</span></b></span></p>
          <p class="sp-ask">บันทึกยาเสร็จ สุขใจจัดตารางให้เลย!</p>
        </div>
        <div class="wel-actions">
          <button class="btn block wel-go" type="button" data-login-mode="in">เริ่มใช้งาน</button>
          <button class="btn ghost block wel-have" type="button" data-login-mode="in">มีบัญชีแล้ว เข้าสู่ระบบ</button>
          <p class="wel-note">${APP_DISCLAIMER}</p>
        </div>
      </div>`;    $$('[data-login-mode]').forEach((b) => (b.onclick = () => viewLogin(b.dataset.loginMode)));
    return;
  }
  $('#app').innerHTML = `
    <div class="login plain">
      <div class="login-deco" aria-hidden="true"><i class="lc lc1"></i><i class="lc lc2"></i><i class="lc lc3"></i><i class="lc lc4"></i><b class="ls ls1">✱</b><b class="ls ls2">✱</b></div>
      <img src="icon.svg" alt="" class="login-logo"><h1>สุขใจ</h1><p class="sub">${mode === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิกใหม่'}</p>
      <form id="loginForm" class="card">
        <label class="f"><span>อีเมล</span><input type="email" name="email" required autocomplete="email" inputmode="email"></label>
        <label class="f"><span>รหัสผ่าน</span><input type="password" name="password" required minlength="6" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}"></label>
        ${mode === 'up' ? '<label class="f"><span>ยืนยันรหัสผ่าน</span><input type="password" name="password2" required minlength="6" autocomplete="new-password"></label>' : ''}
        ${msg ? `<p class="small ${msg.startsWith('✓') ? '' : 'red-t'}">${esc(msg)}</p>` : ''}
        <button class="btn block" type="submit">${mode === 'in' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</button>
        <button class="btn ghost block" type="button" data-login-mode="${mode === 'in' ? 'up' : 'in'}" style="margin-top:8px">${mode === 'in' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}</button>
        <div class="login-links"><button class="linkbtn" type="button" data-login-mode="welcome">‹ กลับหน้าแรก</button>${mode === 'in' ? '<button class="linkbtn" type="button" data-login-mode="reset">ลืมรหัสผ่าน</button>' : ''}</div>
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
  if (tab === 'care') { ui.medsPage = 'care'; tab = 'meds'; } // ทางเข้าเดิมของติดตามการรักษา
  ui.tab = tab; render(); window.scrollTo(0, 0);
}
function render() {
  if (!S) return;
  document.body.classList.remove('auth');
  if (typeof relockOnPageChange === 'function') relockOnPageChange();
  updateInviteDot();
  let ob = document.getElementById('offbar');
  if (DB.offline) {
    if (!ob) { ob = document.createElement('div'); ob.id = 'offbar'; ob.setAttribute('role', 'status'); document.body.appendChild(ob); }
    ob.textContent = `📴 ออฟไลน์ — ข้อมูลล่าสุดเมื่อ ${DB.snapshotAt ? thDateTime(new Date(DB.snapshotAt).toISOString()) : '-'} · ดูได้อย่างเดียว`;
    document.body.classList.add('is-offline');
  } else { ob?.remove(); document.body.classList.remove('is-offline'); }
  const views = { today: viewToday, meds: viewMeds, calendar: viewCalendar, family: viewMembers, settings: viewSettings };
  $('#app').innerHTML = views[ui.tab]();
  hydrateImgs($('#app'));
  { const fb = $('#tabbar [data-tab="family"]'); if (fb && typeof pendingInvites === 'function') fb.classList.toggle('has-badge', pendingInvites().length > 0); } // จุดแดงที่แท็บสมาชิกเมื่อมีคำเชิญ
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  navSync();
}

// ---------- การนำทาง + ปุ่มย้อนกลับ (ใช้ร่วมกันทั้งปุ่ม ← ในแอปและปุ่มย้อนกลับของมือถือ/เบราว์เซอร์) ----------
// หลักการ: เก็บ "กองหน้า" (navStack) เอง — กดแท็บล่าง = เริ่มกองใหม่ที่หน้าแรกของแท็บนั้น (ข้างหลังคือ "วันนี้") · กดลิงก์เข้าหน้าย่อย = ซ้อนเพิ่ม · ย้อนกลับ = ถอยทีละชั้นตามที่เข้ามาจริง
// ไม่ปล่อยให้ประวัติเบราว์เซอร์ตัดสินเอง จึงไม่กระโดดข้ามแท็บ · เก็บเฉพาะ "หน้า" (ไม่รวมคนที่เลือก/เดือนที่ดู)
const navSnap = () => ({ tab: ui.tab, medsPage: ui.medsPage, todayPage: ui.todayPage, memberPage: ui.memberPage });
const navRoot = (tab) => ({ tab, medsPage: 'hub', todayPage: 'home', memberPage: null });
const navSame = (a, b) => a.tab === b.tab && (a.medsPage || 'hub') === (b.medsPage || 'hub') && (a.todayPage || 'home') === (b.todayPage || 'home') && (a.memberPage || null) === (b.memberPage || null);
let navStack = [], navKey = null, navPopping = false, navFromTab = false, navGuard = false;
/** กดแท็บล่าง: ไปหน้าแรกของแท็บนั้นเสมอ (ไม่จำหน้าย่อยที่เปิดค้างไว้) */
function navTab(tab) { navFromTab = true; ui.medsPage = 'hub'; ui.todayPage = 'home'; ui.memberPage = null; go(tab); navFromTab = false; }
function navReset() { navStack = []; navKey = null; ui.medsPage = 'hub'; ui.todayPage = 'home'; ui.memberPage = null; }
function navSync() {
  if (navPopping) return;
  const s = navSnap(); const k = JSON.stringify(s);
  if (navKey === null) { navStack = [s]; navKey = k; navGuardInit(); return; }
  if (k === navKey) return;
  navKey = k;
  if (navFromTab) navStack = navSame(s, navRoot('today')) ? [s] : [navRoot('today'), s]; // แท็บล่าง: ถอยจากแท็บอื่นจะกลับ "วันนี้" ก่อน
  else { const i = navStack.findIndex((x) => navSame(x, s)); if (i >= 0) navStack.length = i + 1; else navStack.push(s); } // เข้าหน้าที่เคยผ่านแล้ว = ถอยกลับไปที่นั่น ไม่ซ้อนวน
}
/** หน้าที่จะกลับไป (ใช้เขียนบนปุ่มย้อนกลับ) */
const navPrevSnap = () => { // ถูกเรียกตอนวาดหน้า (ก่อน navSync) จึงต้องคาดการณ์กองหน้าที่จะเกิดขึ้นเอง
  const s = navSnap();
  if (JSON.stringify(s) === navKey) return navStack[navStack.length - 2] || null;
  const i = navStack.findIndex((x) => navSame(x, s)); if (i >= 0) return navStack[i - 1] || null;
  if (navFromTab) return navSame(s, navRoot('today')) ? null : navRoot('today');
  return navStack[navStack.length - 1] || null;
};
/** ถอย 1 ชั้น — คืน true ถ้าถอยได้ */
function navBack() {
  if (navStack.length < 2) return false;
  navStack.pop(); const s = navStack[navStack.length - 1];
  navPopping = true; Object.assign(ui, s); navKey = JSON.stringify(s);
  try { render(); window.scrollTo(0, 0); } finally { navPopping = false; }
  return true;
}
/** ประวัติเบราว์เซอร์ = [ยามเฝ้า][แอป] เสมอ: กดย้อนกลับของเครื่อง → ตกมาที่ยามเฝ้า → เราถอยในแอปแล้วดันหน้าแอปกลับขึ้นมาใหม่ · ถ้าอยู่หน้าแรกแล้วค่อยปล่อยให้ออกจากแอป */
function navGuardInit() {
  if (navGuard) return; navGuard = true;
  try { history.replaceState({ guard: 1 }, '', location.href); history.pushState({ app: 1 }, '', location.href); } catch { /* ไม่รองรับ history — ใช้ปุ่ม ← ในแอปแทน */ }
}
window.addEventListener('popstate', (e) => {
  if (!S || !navGuard || (e.state && e.state.app)) return;
  const modal = document.getElementById('modal');
  try {
    if (modal && !modal.classList.contains('hidden')) { closeSheet(); history.pushState({ app: 1 }, '', location.href); return; } // มีหน้าต่างเด้งเปิดอยู่ → ปิดหน้าต่างก่อน
    if (navBack()) { history.pushState({ app: 1 }, '', location.href); return; }
    navGuard = false; history.back(); // อยู่หน้าแรกสุดแล้ว → ออกจากแอปตามปกติ
  } catch { /* ignore */ }
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

/** ย้ายสีประจำตัวชุดเก่าของโปรไฟล์ที่เราเป็นเจ้าของ ไปเป็นชุดใหม่ที่เข้ากับสีหลัก */
async function migrateColors() {
  const jobs = [];
  S.profiles.forEach((p) => { const n = LEGACY_COLORS[String(p.color).toUpperCase()]; if (n && ownsProfile(p.id)) { p.color = n; jobs.push(DB.update('profiles', p.id, { color: n })); } });
  if (jobs.length) await Promise.allSettled(jobs);
}

// ---------- คำเชิญเข้ากลุ่มผู้ดูแลที่รอตอบ: จุดแดงบนแท็บ "สมาชิก" ----------
function updateInviteDot() { // ใช้ pendingInvites() จาก pages.js · จุดแดงใช้คลาส has-badge
  const b = document.querySelector('#tabbar button[data-tab="family"]'); if (!b || !S) return;
  const n = pendingInvites().length; b.classList.toggle('has-badge', n > 0);
  b.setAttribute('aria-label', n > 0 ? `สมาชิก มี ${n} คำเชิญรอตอบ` : 'สมาชิก');
}
let lastInviteCheck = 0;
async function refreshInvites() { // กลับมาเปิดแอป/สลับกลับมาที่แอป → ดูว่ามีคำเชิญใหม่ไหม (ไม่ทับหน้าที่กำลังกรอก)
  if (!S || DB?.mode !== 'supabase' || DB.offline || Date.now() - lastInviteCheck < 30000) return;
  lastInviteCheck = Date.now();
  try {
    const rows = await DB.fetchInvites(); const old = JSON.stringify((S.circle_invites || []).map((i) => i.id).sort());
    S.circle_invites = rows;
    if (JSON.stringify(rows.map((i) => i.id).sort()) !== old) { updateInviteDot(); const m = document.getElementById('modal'); if (ui.tab === 'family' && (!m || m.classList.contains('hidden'))) render(); }
  } catch (e) { console.warn('refreshInvites', e); }
}
/** กันกรณีเปิดแอปแล้วข้อมูลว่างทั้งที่มีข้อมูลในบัญชี (เช่น iPad เปิดค้างนานแล้วโหลดตอนสิทธิ์เข้าสู่ระบบยังไม่ต่ออายุ ได้รายการว่าง ไม่มี error) — ถ้าโหลดแล้วไม่มีโปรไฟล์เลย ลองโหลดใหม่ให้เองสูงสุด 3 ครั้ง และลองอีกเมื่อกลับมาเปิดหน้าจอ */
let emptyTries = 0;
function retryIfEmpty() {
  if (!S || !DB || DB.mode !== 'supabase' || DB.offline || S.profiles.length || emptyTries >= 3) return;
  emptyTries++;
  setTimeout(async () => {
    try { const n = await DB.loadAll(); if (n.profiles.length) { S = n; resetMonths(); sortProfiles(); const m = document.getElementById('modal'); if (!m || m.classList.contains('hidden')) render(); } else retryIfEmpty(); } catch (e) { console.warn('retryIfEmpty', e); }
  }, 1500 * emptyTries);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { refreshInvites(); emptyTries = 0; retryIfEmpty(); } });

// ---------- โหลดบันทึกกินยาของเดือนนี้ใหม่ (ใช้หลังกดปุ่ม "กินแล้ว" จากการแจ้งเตือน ซึ่งบันทึกที่เซิร์ฟเวอร์ ไม่ผ่านหน้าจอ) ----------
let logsBusy = false;
async function refreshLogs() {
  if (!S || DB?.mode !== 'supabase' || DB.offline || logsBusy) return;
  logsBusy = true;
  try {
    const ym = ymOf(new Date()); const r = await DB.loadMonthLogs(ym);
    const key = (l) => `${l.medication_id}|${l.log_date}|${l.slot}`;
    const before = S.med_logs.filter((l) => String(l.log_date).startsWith(ym)).map(key).sort().join(',');
    if (before !== r.med_logs.map(key).sort().join(',')) {
      S.med_logs = S.med_logs.filter((l) => !String(l.log_date).startsWith(ym)).concat(r.med_logs);
      const m = document.getElementById('modal'); if (!m || m.classList.contains('hidden')) render();
    }
  } catch (e) { console.warn('refreshLogs', e); } finally { logsBusy = false; }
}
// ---------- ตัวอักษรใหญ่ (ตั้งต่อเครื่อง เก็บใน localStorage) ----------
const bigTextOn = () => { try { return localStorage.getItem('sukjai-bigtext') === '1'; } catch { return false; } };
const applyBigText = () => document.documentElement.classList.toggle('bigtext', bigTextOn());
applyBigText();
document.addEventListener('change', (ev) => {
  const t = ev.target; if (!t || t.dataset?.bigtext === undefined) return;
  try { localStorage.setItem('sukjai-bigtext', t.checked ? '1' : '0'); } catch { /* ไม่รองรับ */ }
  applyBigText(); toast(t.checked ? 'เปิดตัวอักษรใหญ่แล้ว' : 'ปิดตัวอักษรใหญ่แล้ว');
});
// ---------- เริ่มทำงาน ----------
/** โหลดข้อมูล — ถ้าเจอ "JWT expired" ให้ต่ออายุเซสชันแล้วลองใหม่ 1 ครั้ง · ต่ออายุไม่ได้ = ให้เข้าสู่ระบบใหม่ (error.expired) */
async function loadOrRecover() {
  try { return await DB.loadAll(); } catch (e) {
    if (DB.recoverAuth && /JWT|expired|PGRST30|401/i.test(String(e?.message || e?.code || e))) {
      if (await DB.recoverAuth()) return await DB.loadAll();
      const err = new Error('session expired'); err.expired = true; throw err;
    }
    throw e;
  }
}
async function boot() {
  const useSupa = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase;
  if (CFG.SUPABASE_URL && !window.supabase) toast('โหลดระบบ Supabase ไม่สำเร็จ — ใช้โหมดทดลองแทน');
  DB = useSupa ? new SupaDB(CFG) : new LocalDB();
  let lastUser = null; let loading = null;
  const start = async (user) => {
    if (!user && DB.offline && S) return; // ออฟไลน์: เหตุการณ์ออกจากระบบที่เกิดจากเน็ตหลุดไม่ใช่การออกจริง
    if (!user) { S = null; lastUser = null; return viewLogin('welcome'); }
    if (lastUser === user.id && S) return;
    if (loading === user.id) return;
    loading = user.id;
    try {
      $('#app').innerHTML = '<div class="empty" style="padding-top:30vh">กำลังโหลด…</div>';
      try { S = await loadOrRecover(); } catch (e) { console.error(e); if (e.expired) { await DB.signOutLocal(); S = null; lastUser = null; viewLogin('in', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'); return; } $('#app').innerHTML = `<div class="card empty">โหลดข้อมูลไม่สำเร็จ<br><span class="small">${esc(e.message)}</span><br><button class="btn sm" onclick="location.reload()">ลองใหม่</button></div>`; return; }
      lastUser = user.id;
      if (!DB.offline) await migrateColors();
      sortProfiles();
      ui.tab = 'today'; navReset(); // รีเซ็ตแท็บและกองหน้า
      showSplash(); // หน้า intro แสดงก่อนเสมอ (ทับหน้าที่โหลดอยู่ด้านล่าง แล้วจางหายไป)
      // PDPA: ต้องยินยอมการเก็บข้อมูลสุขภาพก่อนใช้งานครั้งแรก (และเมื่อเนื้อหาความยินยอมเปลี่ยน)
      if (DB.mode === 'supabase' && S.settings.pdpa_version !== PDPA_VERSION) return consentView(() => { render(); Notifier.start(); showSplash(); });
      render();
      Notifier.start();
      showSplash();
      emptyTries = 0; retryIfEmpty();
    } finally { loading = null; }
  };
  // กดลิงก์ "ตั้งรหัสผ่านใหม่" จากอีเมล → เข้าแอปแล้วเด้งหน้าตั้งรหัสผ่านใหม่ทันที
  DB.onAuth(async (u, ev) => { await start(u); if (ev === 'PASSWORD_RECOVERY' && u) passwordForm(true); });
  let first = null;
  try { first = await DB.getUser(); } catch (e) { console.warn('getUser', e); }
  if (!first && useSupa && navigator.onLine === false && DB.readSnapshot) { // ไม่มีเน็ต + เคยเข้าสู่ระบบไว้ → เปิดแบบออฟไลน์ (ดูอย่างเดียว) จากสำเนาในเครื่อง
    const snap = DB.readSnapshot(); if (snap) { first = snap.user; DB.user = snap.user; }
  }
  window.addEventListener('online', () => { if (DB.offline) location.reload(); }); // กลับมาออนไลน์ → โหลดข้อมูลล่าสุดอัตโนมัติ
  start(first);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
}
document.addEventListener('DOMContentLoaded', boot);
