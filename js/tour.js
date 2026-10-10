/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — ทัวร์แนะนำการใช้งาน (พาทำทีละขั้น ชี้ปุ่มจริงบนหน้าแอป) + หน้าคำถามที่พบบ่อย
 * 2 โหมด:
 *  - guided = บัญชีใหม่ที่ยังไม่มีข้อมูล: "ขั้นให้ทำ" รอให้ผู้ใช้กดปุ่มจริง กรอกฟอร์มจริง แล้วไปขั้นต่อไปเองเมื่อบันทึกสำเร็จ (ข้ามขั้นได้)
 *  - view   = บัญชีที่มีข้อมูลแล้ว (เปิดซ้ำจากตั้งค่า): ชี้และอธิบายอย่างเดียว ไม่สร้างข้อมูลใดๆ
 * ส่วนแรก = ฟีเจอร์ของแพ็กเกจฟรี · ขั้นสุดท้าย = สิ่งที่ Premium ทำได้เหนือกว่า (ดึงจาก PREMIUM_PERKS ใน premium.js)
 * จำว่าดูจบแล้วใน localStorage ของเครื่อง (ไม่ใช้ฐานข้อมูล ไม่ต้องรัน SQL)
 * ถ้าหาปุ่มเป้าหมายไม่เจอ จะถอยไปชี้แท็บล่างแทน และขั้นให้ทำจะกลายเป็นขั้นอธิบาย — ทัวร์ไม่พัง
 */
'use strict';

const TOUR_KEY = 'sukjai_tour_done';
const tourDone = () => { try { return localStorage.getItem(TOUR_KEY) === '1'; } catch (e) { return false; } };
const tourMark = () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch (e) { /* ไม่มี localStorage = ข้าม */ } };
const tourEmptyAccount = () => !!S && !(S.profiles || []).length && !(S.medications || []).length;
/** บัญชีใหม่ที่ทัวร์จะพาสร้างข้อมูลเอง — ใช้ให้ maybeOnboard() (pages.js) ไม่เด้งฟอร์มซ้อน */
const tourWillAutoStart = () => !tourDone() && tourEmptyAccount();

const TAB = (t) => `#tabbar [data-tab="${t}"]`;
const countOf = { profiles: () => (S.profiles || []).length, meds: () => (S.medications || []).length, appts: () => (S.appointments || []).length, circles: () => (S.circles || []).length };

/** kind: info = อธิบาย · form = ผู้ใช้กดปุ่มจริง → ฟอร์มจริง → บันทึก (นับจาก count) · tick = ผู้ใช้กดติ๊กจริง */
const TOUR_STEPS = [
  { kind: 'info', tab: 'today', center: true, title: 'ยินดีต้อนรับสู่สุขใจ',
    text: 'เรามาลองใช้จริงด้วยกันทีละขั้น ตอนนี้ยังไม่มีข้อมูลอะไรเลย เราจะเริ่มจากสร้างโปรไฟล์ แล้วเพิ่มยากับนัดหมอ ทุกขั้นข้ามได้ และใช้ฟีเจอร์ของแพ็กเกจฟรีทั้งหมด',
    textView: 'นี่คือการแนะนำแบบดูเฉยๆ จะไม่สร้างข้อมูลใดๆ ให้คุณ แสดงตามฟีเจอร์ของแพ็กเกจฟรี และมีสรุปสิ่งที่ Premium ทำได้เพิ่มตอนท้าย', sel: [] },
  { kind: 'form', tab: 'family', count: 'profiles', title: 'สร้างโปรไฟล์ของฉัน',
    text: 'แตะปุ่มนี้เพื่อสร้างโปรไฟล์ของคุณเอง (ใช้บันทึกอารมณ์และดูแลตัวเองด้วย)',
    formText: 'ใส่ชื่อเรียกของคุณ แล้วเลื่อนลงกด "บันทึก"', sel: ['[data-act="add-self"]', TAB('family')] },
  { kind: 'form', tab: 'family', count: 'profiles', title: 'เพิ่มคนที่คุณดูแล',
    text: 'แตะ "+ เพิ่มคน" เพื่อเพิ่มคนที่คุณดูแล เช่น ปู่ ย่า พ่อ แม่ (แพ็กเกจฟรีดูแลได้ 1 คน)',
    formText: 'ใส่ชื่อเรียก เช่น ย่าปลา เลือกความสัมพันธ์ ปีเกิด และสีประจำตัว ถ้ามีประวัติแพ้ยาให้ใส่ไว้ด้วย แล้วเลื่อนลงกด "บันทึก"', sel: ['[data-act="add-person"]', TAB('family')] },
  { kind: 'form', tab: 'meds', page: 'list', count: 'meds', title: 'เพิ่มยา',
    text: 'แตะปุ่ม + เพื่อเพิ่มยาของคนนี้ (แพ็กเกจฟรีใส่ได้ 10 ตัวต่อคน)',
    formText: 'ใส่ชื่อยา กรอกว่ารักษาอะไร (ต้องกรอก) จำนวนต่อครั้ง และติ๊กช่วงเวลาที่ต้องกิน (เช่น หลังอาหารเช้า) ถ้ามีจำนวนยาคงเหลือใส่ไว้ด้วย แล้วกด "บันทึก"', sel: ['.fab[data-act="add-med"]', TAB('meds')] },
  { kind: 'info', tab: 'meds', page: 'list', title: 'ตารางกินยา',
    text: 'ตรงนี้คือตารางกินยาของวัน แต่ละช่องคือยาหนึ่งตัว มีรหัสยา (เช่น ป1) แทนชื่อ อ่านง่ายสำหรับผู้สูงอายุ', sel: ['.dtable', TAB('meds')] },
  { kind: 'tick', tab: 'meds', page: 'list', title: 'ติ๊กเมื่อกินยาแล้ว',
    text: 'ถึงเวลาแล้วแตะวงกลมตรงช่องยา ช่องจะเปลี่ยนเป็นสีเขียว บอกว่ากินยาแล้ว', sel: ['.tick[data-act="take"]', '.dtable', TAB('meds')] },
  { kind: 'info', tab: 'meds', page: 'stock', title: 'จำนวนยาที่เหลือ',
    text: 'แอปคำนวณจำนวนยาที่เหลือจากตารางกินยา และบอกวันที่ยาจะหมดโดยประมาณ ถ้าเหลือ 0 จะขึ้นว่า "ยาหมด"', sel: ['.stk-t', TAB('meds')] },
  { kind: 'info', tab: 'meds', page: 'list', title: 'ดาวน์โหลดตารางยา',
    text: 'ปุ่มนี้บันทึกตารางยาเป็นไฟล์ PDF พิมพ์ให้ผู้สูงอายุติดตู้เย็นได้ (ฟรี) ลองกดได้หลังจบทัวร์', sel: ['[data-act="print-meds"]', TAB('meds')] },
  { kind: 'form', tab: 'calendar', count: 'appts', title: 'จดนัดหมอ',
    text: 'แตะปุ่ม + เพื่อจดนัดหมอ แอปเตือนล่วงหน้าให้ (แพ็กเกจฟรีเก็บใบนัดได้ 3 ใบต่อคน)',
    formText: 'เลือกคน ใส่แผนก วัน-เวลา และหมอ แนบรูปใบนัดได้สูงสุด 2 รูป แล้วกด "บันทึก"', sel: ['.fab[data-act="add-appt"]', TAB('calendar')] },
  { kind: 'form', tab: 'family', count: 'circles', title: 'สร้างกลุ่มผู้ดูแล',
    text: 'แตะปุ่มนี้เพื่อสร้างกลุ่มให้คนในครอบครัวดูข้อมูลด้วยกัน (แพ็กเกจฟรี 1 กลุ่ม เชิญได้ 5 คน)',
    formText: 'ตั้งชื่อกลุ่ม แล้วเลือกคนที่จะแชร์ข้อมูล กด "บันทึก" เชิญสมาชิกด้วยอีเมลได้ที่ปุ่มจัดการกลุ่มทีหลัง', sel: ['[data-act="new-circle"]', TAB('family')] },
  { kind: 'info', tab: 'settings', title: 'เปิดการแจ้งเตือน',
    text: 'ที่นี่เปิดการแจ้งเตือนบนเครื่องนี้ และเลือกเรื่องที่จะให้เตือน ส่วนเวลาของแต่ละช่วงยาตั้งได้ที่ "กำหนดช่วงเวลาทานยา"', sel: ['details[data-tour-t="notify"]', TAB('settings')] },
  { kind: 'info', tab: 'meds', page: 'summary', title: 'สรุปการกินยา',
    text: 'ดูเปอร์เซ็นต์การกินยาย้อนหลัง 7 วัน (แพ็กเกจฟรี) ย้อนหลังนานกว่านี้และกราฟรายเดือนสำหรับ Premium', sel: ['.ad-title', 'h1', TAB('meds')] },
  { kind: 'info', tab: 'meds', page: 'care', title: 'ติดตามการรักษา',
    text: 'จดและถ่ายรูปอาการเป็นรอบ เช่น แผลที่ขา เทียบรูปแรกกับล่าสุดได้ (แพ็กเกจฟรีสร้างได้ 1 แผน)', sel: ['h1', TAB('meds')] },
  { kind: 'info', tab: 'today', center: true, title: 'จบส่วนแพ็กเกจฟรี',
    text: 'คุณได้ลองฟีเจอร์หลักของแพ็กเกจฟรีครบแล้ว ถ้าติดขัดตรงไหน เปิด "คำถามที่พบบ่อย" ได้เสมอที่ ตั้งค่า › คำถามที่พบบ่อย', sel: [] },
  { kind: 'info', tab: 'today', center: true, premium: true, title: 'Premium ทำอะไรได้เหนือกว่า',
    text: 'ถ้าอยากได้มากกว่าแพ็กเกจฟรี Premium เพิ่มให้ดังนี้', sel: [] },
];

let tourState = null; // { i, mode, phase, active, ov, spot, card, mo, poll, base, base2, flash }

function tourFind(sels) {
  for (const s of sels) {
    const el = document.querySelector(s);
    if (el && el.getClientRects().length) return el;
  }
  return null;
}
const tourStep = () => TOUR_STEPS[tourState.i];
/** ขั้นที่ผู้ใช้ต้องลงมือจริงไหม (เฉพาะโหมด guided และหาปุ่มจริงเจอ — ตัวแรกในรายการ sel คือปุ่มจริง ตัวหลังๆ เป็นตัวสำรอง) */
const tourActive = (step) => tourState.mode === 'guided' && step.kind !== 'info' && !!tourFind(step.sel.slice(0, 1));

function tourGo(step) {
  if (typeof navTab === 'function') navTab(step.tab); else go(step.tab);
  if (step.tab !== 'meds' || !step.page) return;
  if (step.page === 'summary') { openSummary(); return; }
  ui.medsPage = step.page; render();
}

/** pass = แตะผ่านไปถึงหน้าแอปได้ (ขั้นให้ทำ) · block = กล่องคลุมหน้าจอ แตะหน้าแอปไม่ได้ (ขั้นอธิบาย) */
function tourMode(mode) { tourState.ov.classList.toggle('pass', mode === 'pass'); }

function tourPlace() {
  if (!tourState) return;
  const { spot, card } = tourState; const step = tourStep();
  const vw = window.innerWidth, vh = window.innerHeight;
  card.style.visibility = 'visible';
  if (tourState.phase === 'form') { // กำลังกรอกฟอร์มจริง: ไม่มืด ไม่บัง — กล่องเล็กอยู่บนสุด
    spot.style.display = 'none'; tourState.ov.classList.remove('dim');
    card.className = 'tour-card form-hint'; card.style.cssText = 'visibility:visible'; return;
  }
  const target = step.center ? null : tourFind(step.sel);
  if (!target) { // ไม่มีเป้าหมาย = กล่องกลางจอ
    spot.style.display = 'none'; tourState.ov.classList.add('dim');
    card.className = 'tour-card center'; card.style.cssText = 'visibility:visible'; return;
  }
  tourState.ov.classList.remove('dim'); spot.style.display = 'block';
  const r = target.getBoundingClientRect(); const pad = 6;
  spot.style.left = `${r.left - pad}px`; spot.style.top = `${r.top - pad}px`;
  spot.style.width = `${r.width + pad * 2}px`; spot.style.height = `${r.height + pad * 2}px`;
  const cw = Math.min(vw * 0.88, 340);
  const below = r.top + r.height / 2 < vh / 2; // เป้าหมายอยู่ครึ่งบน → กล่องอยู่ใต้ · ครึ่งล่าง → กล่องอยู่บน
  const left = Math.max(12, Math.min(vw - cw - 12, r.left + r.width / 2 - cw / 2));
  card.className = `tour-card ${below ? 'below' : 'above'}`;
  card.style.cssText = `visibility:visible;width:${cw}px;left:${left}px;` + (below ? `top:${r.bottom + pad + 14}px;` : `bottom:${vh - r.top + pad + 14}px;`);
  card.style.setProperty('--ax', `${Math.max(22, Math.min(cw - 22, r.left + r.width / 2 - left))}px`);
}

function tourCardHtml() {
  const i = tourState.i; const step = tourStep(); const n = TOUR_STEPS.length; const last = i === n - 1;
  const act = tourState.active; const form = tourState.phase === 'form';
  const txt = form ? step.formText : (tourState.mode === 'view' && step.textView ? step.textView : step.text);
  const flash = tourState.flash && !form ? `<div class="tour-ok">✅ ${esc(tourState.flash)}</div>` : '';
  const perks = step.premium ? `<ul class="tour-perks">${PREMIUM_PERKS.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
  const note = act && !form ? '<small class="tour-hint">แตะปุ่มที่ไฟส่องอยู่ได้เลย</small>' : '';
  let btns;
  if (form) btns = '<span></span><button type="button" class="btn ghost sm" data-tour-skipstep>ข้ามขั้นนี้</button>';
  else if (act) btns = '<button type="button" class="btn ghost sm" data-tour-skip>ปิดทัวร์</button><button type="button" class="btn ghost sm" data-tour-skipstep>ข้ามขั้นนี้</button>';
  else btns = `${last ? '<span></span>' : '<button type="button" class="btn ghost sm" data-tour-skip>ข้าม</button>'}<span class="tour-btns-r">${i > 0 ? '<button type="button" class="btn ghost sm" data-tour-prev>ย้อนกลับ</button>' : ''}${step.premium ? '<button type="button" class="btn ghost sm" data-tour-premium>ดู Premium</button>' : ''}<button type="button" class="btn sm" data-tour-next>${last ? 'เสร็จสิ้น' : 'ถัดไป'}</button></span>`;
  return `<div class="tour-arrow" aria-hidden="true"></div>${flash}<small class="tour-no">${form ? 'กำลังกรอก · ' : ''}${i + 1} / ${n}</small>
    <h3>${esc(step.title)}</h3><p>${esc(txt)}</p>${perks}${note}<div class="tour-btns">${btns}</div>`;
}

function tourShow(i, flash = '') {
  if (!tourState) return;
  const step = TOUR_STEPS[i]; tourState.i = i; tourState.phase = 'press'; tourState.flash = flash; tourState.active = false;
  if (!$('#modal').classList.contains('hidden')) closeSheet();
  tourGo(step);
  tourState.card.style.visibility = 'hidden';
  // รอให้หน้าวาดเสร็จ แล้วค่อยหาเป้าหมาย เลื่อนให้เห็น และเริ่มรอการกระทำของผู้ใช้
  setTimeout(() => {
    if (!tourState || tourState.i !== i) return;
    tourState.active = tourActive(step);
    tourMode(tourState.active ? 'pass' : 'block');
    const target = step.center ? null : tourFind(step.sel);
    if (target && !target.closest('#tabbar') && !target.classList.contains('fab')) target.scrollIntoView({ block: 'center', behavior: 'auto' });
    tourState.base = step.count ? countOf[step.count]() : 0;
    tourState.base2 = (S.med_logs || []).length;
    tourState.card.innerHTML = tourCardHtml();
    tourPlace();
  }, 120);
}

/** เฝ้าดูการกระทำของผู้ใช้ในขั้นที่ต้องลงมือ: เปิดฟอร์ม → กรอก → บันทึก (จำนวนข้อมูลเพิ่ม) */
function tourWatch() {
  if (!tourState || !tourState.active) return;
  const step = tourStep(); const modalOpen = !$('#modal').classList.contains('hidden');
  if (step.kind === 'form') {
    if (tourState.phase === 'press' && modalOpen) { tourState.phase = 'form'; tourState.card.innerHTML = tourCardHtml(); tourMode('pass'); tourPlace(); }
    else if (tourState.phase === 'form' && !modalOpen) {
      if (countOf[step.count]() > tourState.base) tourNext('บันทึกแล้ว เยี่ยมมาก!');
      else { tourState.phase = 'press'; tourState.card.innerHTML = tourCardHtml(); tourPlace(); } // ปิดฟอร์มโดยไม่บันทึก → กลับไปชี้ปุ่มเดิม
    }
  } else if (step.kind === 'tick' && (S.med_logs || []).length > tourState.base2) tourNext('บันทึกการกินยาแล้ว');
}

function tourNext(flash = '') {
  if (!tourState) return;
  tourState.active = false; // กันเรียกซ้ำระหว่างรอ
  const n = tourState.i + 1;
  if (n >= TOUR_STEPS.length) tourEnd(); else setTimeout(() => tourShow(n, flash), 450);
}

/** ในขั้นที่ผู้ใช้ต้องลงมือ: กันการแตะที่อื่นนอกปุ่มที่ชี้ (ฟอร์มที่เปิดอยู่และกล่องทัวร์แตะได้) */
function tourGuard(ev) {
  if (!tourState || !tourState.active) return;
  const t = ev.target;
  if (t.closest('.tour-card') || t.closest('#modal') || t.closest('.ask-ov')) return;
  const el = tourFind(tourStep().sel);
  if (el && el.contains(t)) return;
  ev.preventDefault(); ev.stopPropagation();
}

function tourEnd() {
  if (!tourState) return;
  tourMark(); clearInterval(tourState.poll); tourState.mo?.disconnect(); tourState.ov.remove(); tourState = null;
  window.removeEventListener('resize', tourPlace); window.removeEventListener('scroll', tourPlace, true);
  document.removeEventListener('keydown', tourKey); document.removeEventListener('click', tourGuard, true);
  if (!$('#modal').classList.contains('hidden')) closeSheet();
  navTab('today');
}
const tourKey = (ev) => { if (ev.key === 'Escape') tourEnd(); };

function startTour() {
  if (tourState || !S) return;
  if (!$('#modal').classList.contains('hidden')) closeSheet();
  const ov = document.createElement('div'); ov.className = 'tour-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'แนะนำการใช้งาน');
  ov.innerHTML = '<div class="tour-spot"></div><div class="tour-card" style="visibility:hidden"></div>';
  document.body.appendChild(ov);
  tourState = { i: 0, mode: tourEmptyAccount() ? 'guided' : 'view', phase: 'press', active: false, base: 0, base2: (S.med_logs || []).length, flash: '', ov, spot: ov.querySelector('.tour-spot'), card: ov.querySelector('.tour-card'), mo: null, poll: null };
  ov.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-tour-next]')) { const n = tourState.i + 1; if (n >= TOUR_STEPS.length) tourEnd(); else tourShow(n); }
    else if (ev.target.closest('[data-tour-prev]')) tourShow(Math.max(0, tourState.i - 1));
    else if (ev.target.closest('[data-tour-skipstep]')) { tourState.active = false; const n = tourState.i + 1; if (n >= TOUR_STEPS.length) tourEnd(); else tourShow(n); }
    else if (ev.target.closest('[data-tour-skip]')) tourEnd();
    else if (ev.target.closest('[data-tour-premium]')) { tourEnd(); premiumSheet('overview'); }
  });
  // หน้าถูกวาดใหม่ระหว่างทัวร์ (เช่นโหลดข้อมูลเสร็จ) → จัดตำแหน่งใหม่
  tourState.mo = new MutationObserver(() => { if (tourState && tourState.card.innerHTML) setTimeout(tourPlace, 0); });
  tourState.mo.observe(document.getElementById('app'), { childList: true, subtree: true });
  tourState.poll = setInterval(tourWatch, 300);
  window.addEventListener('resize', tourPlace); window.addEventListener('scroll', tourPlace, true);
  document.addEventListener('keydown', tourKey); document.addEventListener('click', tourGuard, true);
  tourShow(0);
}

/** ขึ้นอัตโนมัติเฉพาะบัญชีใหม่ที่ยังไม่มีข้อมูลเลย และยังไม่เคยดูจบ — รอให้หน้า intro/ขออนุญาตหายไปก่อน */
function maybeAutoTour() {
  if (!tourWillAutoStart()) return;
  let waited = 0;
  const t = setInterval(() => {
    waited += 400;
    if (waited > 20000 || !S) return clearInterval(t);
    if (document.getElementById('splash') || document.body.classList.contains('auth') || tourState) return;
    clearInterval(t); startTour();
  }, 400);
}

// ---------- คำถามที่พบบ่อย ----------
/** หน้าสุขใจบนเว็บของผู้พัฒนา (logicbrew-site/sookjai) — lb ของแต่ละคำถามคือจุดยึดในหน้า (#start/#share/#faq) · '' = เปิดหน้าบนสุด */
const LB_URL = 'https://logicbrew.dev/sookjai';
const FAQ = [
  { q: 'จะเพิ่มคนที่ดูแลยังไง', a: 'ไปที่แท็บ สมาชิก แล้วกดปุ่มเพิ่มสมาชิก ใส่ชื่อ ความสัมพันธ์ และเลือกสีประจำตัว', go: 'family', label: 'ไปหน้าสมาชิก', lb: '#start' },
  { q: 'จะเพิ่มยายังไง', a: 'ไปที่แท็บ ยา › ยาที่ต้องทาน แล้วกดปุ่ม + ใส่ชื่อยา จำนวนต่อครั้ง และช่วงเวลาที่ต้องกิน', go: 'meds', label: 'ไปหน้ายาที่ต้องทาน', lb: '#start' },
  { q: 'จะตั้งเวลาแจ้งเตือนกินยายังไง', a: 'ไปที่ ตั้งค่า › การแจ้งเตือน กดเปิดการแจ้งเตือนบนเครื่องนี้ แล้วเลือกเรื่องที่ต้องการให้เตือน ส่วนเวลาของแต่ละช่วงยาตั้งได้ที่ "กำหนดช่วงเวลาทานยา"', go: 'settings', label: 'ไปหน้าตั้งค่า', lb: '#start' },
  { q: 'จะจดนัดหมอและแนบรูปใบนัดยังไง', a: 'ไปที่แท็บ นัดพบหมอ แล้วกดปุ่ม + ใส่วัน เวลา หมอ และแนบรูปใบนัดได้สูงสุด 2 รูปต่อ 1 นัด', go: 'calendar', label: 'ไปหน้านัดพบหมอ', lb: '' },
  { q: 'จะแชร์ข้อมูลให้พี่น้องดูด้วยกันยังไง', a: 'ไปที่แท็บ สมาชิก › กลุ่มผู้ดูแล สร้างกลุ่มแล้วเชิญด้วยอีเมล เลือกได้ว่าให้ดูอย่างเดียวหรือแก้ไขได้ คนที่ถูกเชิญต้องสมัครด้วยอีเมลเดียวกับที่เชิญ', go: 'family', label: 'ไปหน้าสมาชิก', lb: '#share' },
  { q: 'ยาเหลือเท่าไหร่ ดูตรงไหน', a: 'ไปที่แท็บ ยา › จำนวนยาที่เหลือ แอปคำนวณจากจำนวนที่ใส่ไว้และตารางกินยา และบอกวันที่ยาจะหมดโดยประมาณ', go: 'stock', label: 'ไปหน้าจำนวนยาที่เหลือ' },
  { q: 'จะดูสรุปการกินยา 1 เดือนยังไง', a: 'ไปที่แท็บ ยา › สรุปการกินยา จะเห็นเปอร์เซ็นต์รายวันและยาที่ขาดบ่อย', go: 'summary', label: 'ไปหน้าสรุปการกินยา' },
  { q: 'จะดาวน์โหลดตารางยาเป็น PDF ยังไง', a: 'ไปที่แท็บ ยา › ยาที่ต้องทาน แล้วกดปุ่มไฟล์ PDF ไฟล์จะถูกบันทึกลงเครื่อง', go: 'meds', label: 'ไปหน้ายาที่ต้องทาน' },
  { q: 'จะลบบัญชีและข้อมูลทั้งหมดยังไง', a: 'ไปที่ ตั้งค่า › ความเป็นส่วนตัวและข้อมูลสุขภาพ (PDPA) แล้วเลือกลบข้อมูลทั้งหมด หรืออ่านวิธีละเอียดที่หน้าเว็บ', go: 'settings', label: 'ไปหน้าตั้งค่า', web: ['delete-account.html', 'ดูวิธีลบบัญชีบนหน้าเว็บ'] },
  { q: 'ลืมรหัสผ่านทำยังไง', a: 'ที่หน้าเข้าสู่ระบบ กด "ลืมรหัสผ่าน" แล้วทำตามอีเมลที่ส่งให้ ถ้ายังเข้าแอปอยู่ไปที่ ตั้งค่า › เปลี่ยนรหัสผ่าน', go: 'settings', label: 'ไปหน้าตั้งค่า' },
];

function openFaq() {
  openSheet(`<h3>คำถามที่พบบ่อย</h3>
    <div class="faq">${FAQ.map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary>
      <p>${esc(f.a)}</p>
      <div class="faq-btns"><button type="button" class="btn sm" data-faq-go="${f.go}">${esc(f.label)}</button>${f.web ? `<a class="btn ghost sm" href="${esc(f.web[0])}" target="_blank" rel="noopener">${esc(f.web[1])}</a>` : ''}${f.lb !== undefined ? `<a class="btn ghost sm" href="${LB_URL}${f.lb}" target="_blank" rel="noopener">อ่านวิธีละเอียดที่ logicbrew.dev</a>` : ''}</div></details>`).join('')}</div>
    <p class="small muted faq-more">ไม่เจอคำตอบ? <a href="${LB_URL}#faq" target="_blank" rel="noopener">ดูคำถามที่พบบ่อยทั้งหมดที่ logicbrew.dev/sookjai</a></p>
    <div class="row sticky-actions"><button class="btn ghost" data-act="close">ปิด</button></div>`, 'faq-sheet');
}

function faqGo(key) {
  closeSheet();
  if (key === 'summary') return openSummary();
  if (key === 'meds') { navTab('meds'); ui.medsPage = 'list'; render(); return; }
  if (key === 'stock') { navTab('meds'); ui.medsPage = 'stock'; render(); return; }
  navTab(key);
}

document.addEventListener('click', (ev) => {
  const t = ev.target;
  if (t.closest('[data-tour="start"]')) { startTour(); return; }
  if (t.closest('[data-tour="faq"]')) { openFaq(); return; }
  const g = t.closest('[data-faq-go]'); if (g) faqGo(g.dataset.faqGo);
});
