/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — สติกเกอร์ช่วงเวลากินยา (PDF A4 แนวนอน) 3 ขนาด · ใช้สีกรอบตามสีประจำตัวของโปรไฟล์
   1) ถุงซิปล็อก 4 × 2.7 ซม.  2) ช่องกล่องยา 2.5 × 1.5 ซม.  3) กล่องยาใหญ่ 6 × 4 ซม. */
'use strict';

const STK_TYPES = [
  { key: 'bag', title: 'ติดถุงซิปล็อก (6×8 ซม.)', size: '4 × 2.7 ซม.', w: 40, h: 27, icon: 14, fLabel: 12.5, fName: 11, gp: .5, nm: -0.6, pt: .2, lm: .3, long: true, name: true, bd: 1.1 },
  { key: 'cell', title: 'ติดช่องกล่องใส่ยา', size: '2.5 × 1.5 ซม.', w: 25, h: 15, icon: 8.4, fLabel: 8.8, fName: 0, gp: .5, nm: 0, pt: .6, lm: .2, long: false, name: false, bd: .6, byCol: true },
  { key: 'box', title: 'ติดกล่องใส่ยาขนาดใหญ่', size: '6 × 4 ซม.', w: 60, h: 40, icon: 20.5, fLabel: 18.5, fName: 15.5, gp: .7, nm: -1.0, pt: .1, lm: .5, long: true, name: true, bd: 1.6 },
  // รหัสยา: ป้ายจัตุรัส (ขนาดตามไฟล์ตัวอย่างจาก Canva) เรียงรหัสลงมาตามคอลัมน์ วนตามจำนวนยาจนเต็มแผ่น · ยาที่ไม่ได้กิน (หยอดตา ป้ายตา ครีม ฯลฯ) ใส่ชื่อยาแทนรหัส
  { key: 'num', title: 'ติดรหัสยา (ตามจำนวนยา)', size: '3.05 × 3.05 ซม.', w: 30.5, h: 30.5, num: true, bd: .5 },
];
const STK_ICON = { before_breakfast: 'morning', after_breakfast: 'morning', before_lunch: 'day', after_lunch: 'day', before_dinner: 'evening', after_dinner: 'evening', bedtime: 'night' };
const STK_PAGE = { m: 5, gap: 0, foot: 5, maxPages: 5 }; // มม. — ขอบ 5 มม. ไม่เว้นช่องไฟระหว่างดวง (วางชิดกันให้ร้านสติกเกอร์ตัด) เหลือที่ท้ายกระดาษ 5 มม. สำหรับข้อความกำกับ

/** ช่วงเวลาที่คนนี้มียากินประจำ (เรียงตามเวลาในวัน) */
function stkSlotsOf(pid) {
  const used = new Set(medsOf(pid).filter((m) => m.status === 'active' && !m.as_needed).flatMap((m) => m.slots));
  return SLOTS.filter((s) => used.has(s.key));
}
const stkEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** ป้ายรหัสยา 1 ดวง: ยาที่กิน = หัว "รหัสยา" + รหัสตัวใหญ่ · ยาที่ไม่ได้กิน = ชื่อยา */
const STK_NAME_MAX_SPAN = 4; // ป้ายชื่อยายาวได้สูงสุด 4 ช่อง (≈ 12 ซม.) ยาวกว่านั้นขึ้นบรรทัดใหม่
/** ป้ายยาที่ไม่ได้กิน (หยอดตา ป้ายตา ครีม สเปรย์ แผ่นแปะ) = ชื่อยา ความกว้างขยายเป็นจำนวนเท่าของช่องตามความยาวชื่อ · ยาที่กิน = 1 ช่อง */
const stkSpanOf = (t, m) => (isOralMed(m) ? 1 : Math.max(1, Math.min(STK_NAME_MAX_SPAN, Math.ceil((String(m.name || '').length * 2.7 + 7) / t.w))));
function stkNumCellHtml(t, p, item) {
  const m = item.m; const w = t.w * item.span;
  if (!m) return `<div class="sx-gap" style="width:${w}mm;height:${t.h}mm"></div>`; // ช่องว่างท้ายแถว (ป้ายยาวถัดไปวางไม่พอ)
  const st = `width:${w}mm;height:${t.h}mm;border:${t.bd}mm solid ${p.color};border-radius:${t.w * .06}mm`;
  if (!isOralMed(m)) {
    const nm = String(m.name || ''); const long = item.span >= STK_NAME_MAX_SPAN && nm.length * 2.7 + 7 > w; const fs = long ? 12 : 15;
    return `<div class="sx sx-n" style="${st}"><span class="sx-nm" style="font-size:${fs}pt;${long ? '' : 'white-space:nowrap'}">${stkEsc(nm)}</span></div>`;
  }
  const code = medNo(m); const fs = code.length <= 3 ? 32 : code.length === 4 ? 27 : 22;
  return `<div class="sx sx-n" style="${st}"><small class="sx-cap">รหัสยา</small><b class="sx-code" style="font-size:${fs}pt">${stkEsc(code)}</b></div>`;
}

function stkCellHtml(t, p, s) {
  if (t.num) return stkNumCellHtml(t, p, s);
  const lab = t.long ? s.label : s.short;
  return `<div class="sx" style="width:${t.w}mm;height:${t.h}mm;border:${t.bd}mm solid ${p.color};border-radius:${Math.min(t.w, t.h) * .08}mm;gap:${t.gp}mm;padding-top:${t.pt || 0}mm">
    <img src="assets/slots/${STK_ICON[s.key]}.png" style="width:${t.icon}mm;height:${t.icon}mm" alt="">
    <b style="font-size:${t.fLabel}pt;margin-top:${t.lm || 0}mm">${stkEsc(lab)}</b>${t.name ? `<span style="font-size:${t.fName}pt;margin-top:${t.nm}mm">(${stkEsc(p.name)})</span>` : ''}</div>`;
}

/** เลือกแนวกระดาษ (นอน/ตั้ง) ที่วางได้จำนวนมากกว่า — เท่ากันใช้แนวนอน */
function stkGeom(t) {
  const g = STK_PAGE; const best = { perPage: -1 };
  [['land', 297, 210], ['port', 210, 297]].forEach(([o, W, H]) => {
    const aw = W - 2 * g.m, ah = H - 2 * g.m - g.foot;
    const cols = Math.floor((aw + g.gap) / (t.w + g.gap)), rows = Math.floor((ah + g.gap) / (t.h + g.gap));
    if (cols * rows > best.perPage) Object.assign(best, { o, W, H, cols, rows, perPage: cols * rows });
  });
  return best;
}

/** ป้ายรหัสยา: ถ้าทุกดวงเป็นจัตุรัส (ยากินทั้งหมด) เรียงลงมาตามคอลัมน์เหมือนไฟล์ตัวอย่าง (1–6 คอลัมน์แรก แล้วคอลัมน์ถัดไป) วนตามจำนวนยาจนเต็มแผ่น
 *  ถ้ามีป้ายชื่อยายาว (ยาที่ไม่ได้กิน) เรียงต่อเนื่องเป็นแถว ป้ายยาวที่วางไม่พอท้ายแถวขึ้นแถวถัดไป · หลายแผ่นเลขต่อจากแผ่นก่อน */
function stkNumRows(t, geo, meds, pageIdx) {
  const n = meds.length, spans = meds.map((m) => stkSpanOf(t, m));
  if (spans.every((s) => s === 1)) {
    const total = geo.cols * geo.rows;
    return Array.from({ length: geo.rows }, (_, r) => Array.from({ length: geo.cols }, (_, c) => ({ m: meds[(pageIdx * total + c * geo.rows + r) % n], span: 1 })));
  }
  let idx = 0; let rows = [];
  for (let pg = 0; pg <= pageIdx; pg++) {
    rows = [];
    for (let r = 0; r < geo.rows; r++) {
      const row = []; let left = geo.cols;
      while (left > 0) { const k = idx % n; if (spans[k] <= left) { row.push({ m: meds[k], span: spans[k] }); left -= spans[k]; idx++; } else { row.push({ m: null, span: left }); left = 0; } }
      rows.push(row);
    }
  }
  return rows;
}
/** โหมด "ตามจำนวนยา": ยาละ 1 ดวง ไม่วนซ้ำ (ช่องที่เหลือว่าง) — คืนทุกหน้าของ 1 ชุด · ล้วนจัตุรัสเรียงลงตามคอลัมน์ · มีป้ายยาวเรียงเป็นแถว */
function stkNumSetRows(t, geo, meds) {
  const n = meds.length, spans = meds.map((m) => stkSpanOf(t, m)); const pages = [];
  if (spans.every((s) => s === 1)) {
    const per = geo.cols * geo.rows; const total = Math.max(1, Math.ceil(n / per));
    for (let pg = 0; pg < total; pg++) pages.push(Array.from({ length: geo.rows }, (_, r) => Array.from({ length: geo.cols }, (_, c) => { const m = meds[pg * per + c * geo.rows + r]; return { m: m || null, span: 1 }; })));
    return pages;
  }
  let idx = 0;
  while (idx < n) {
    const rows = [];
    for (let r = 0; r < geo.rows; r++) {
      const row = []; let left = geo.cols;
      while (left > 0) { if (idx < n && spans[idx] <= left) { row.push({ m: meds[idx], span: spans[idx] }); left -= spans[idx]; idx++; } else { row.push({ m: null, span: left }); left = 0; } }
      rows.push(row);
    }
    pages.push(rows);
  }
  return pages.length ? pages : [[]];
}
/** จำนวนหน้า PDF ของ 1 ขนาด: ป้ายรหัสยาโหมดตามจำนวนยา = (จำนวนหน้าของ 1 ชุด × จำนวนชุด) · ที่เหลือ = จำนวนแผ่นที่เลือก */
function stkPageCount(t, counts, pid) {
  const n = counts[t.key] || 0; if (!n) return 0;
  if (t.num && counts.numMode === 'count') return stkNumSetRows(t, stkGeom(t), medsOf(pid)).length * n;
  return n;
}
/** 1 หน้าของสติกเกอร์ 1 ขนาด → แถวของช่วงเวลา · ช่องเล็ก: เรียงช่วงเวลาซ้ำเป็นแนวตั้ง (เหมือนแผ่นต้นแบบ) · ช่องอื่น: แบ่งช่องให้แต่ละช่วงเท่าๆ กัน เรียงเป็นกลุ่ม */
function stkLayout(t, slots, meds = [], pageIdx = 0) {
  const geo = stkGeom(t); const total = geo.cols * geo.rows; const seq = [];
  if (t.num) return { rows: stkNumRows(t, geo, meds, pageIdx), geo };

  if (t.byCol) { for (let i = 0; i < total; i++) seq.push(slots[(i % geo.cols) % slots.length]); }
  else { const base = Math.floor(total / slots.length), extra = total % slots.length; slots.forEach((s, k) => { for (let j = 0; j < base + (k < extra ? 1 : 0); j++) seq.push(s); }); }
  const rows = []; for (let r = 0; r < geo.rows; r++) rows.push(seq.slice(r * geo.cols, (r + 1) * geo.cols));
  return { rows, geo };
}

/** counts: { bag: จำนวนแผ่น, cell: …, box: … } */
function stkPagesHtml(p, counts) {
  const slots = stkSlotsOf(p.id); let html = ''; const tot = STK_TYPES.reduce((a, t) => a + stkPageCount(t, counts, p.id), 0); let no = 0;
  STK_TYPES.forEach((t) => {
    const n = stkPageCount(t, counts, p.id); if (!n) return;
    const setRows = t.num && counts.numMode === 'count' ? stkNumSetRows(t, stkGeom(t), medsOf(p.id)) : null;
    for (let i = 0; i < n; i++) {
      no++; const { rows, geo } = setRows ? { rows: setRows[i % setRows.length], geo: stkGeom(t) } : stkLayout(t, slots, t.num ? medsOf(p.id) : [], i);
      html += `<section class="sx-page" data-type="${t.key}" data-o="${geo.o}" style="width:${geo.W}mm;height:${geo.H}mm;padding:${STK_PAGE.m}mm"><div class="sx-grid" style="gap:${STK_PAGE.gap}mm">${rows.map((row) => `<div class="sx-row" style="gap:${STK_PAGE.gap}mm">${row.map((s) => stkCellHtml(t, p, s)).join('')}</div>`).join('')}</div>
        <p class="sx-foot">สติกเกอร์สุขใจ (${stkEsc(p.name)}) · ${t.title} · ขนาด ${t.size} · แผ่น ${no}/${tot} · สร้างไฟล์เมื่อ ${madeAt()} · © 2026 สุขใจ (Sookjai)</p></section>`;
    }
  });
  return html;
}

const STK_CSS = `.sx-wrap{position:fixed;left:-12000px;top:0;background:#fff;font-family:Prompt,Sarabun,sans-serif;color:#161A4D}
.sx-page{box-sizing:border-box;background:#fff;position:relative;overflow:hidden}
.sx-grid{display:flex;flex-direction:column;align-items:center}.sx-row{display:flex}
.sx{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;text-align:center;line-height:1.18;overflow:hidden;flex:none}
.sx img{display:block;object-fit:contain}.sx b{font-weight:700;white-space:nowrap}.sx span{font-weight:500;white-space:nowrap}
.sx-n .sx-cap{font-size:12pt;font-weight:600;color:#2B3060;line-height:1;margin-bottom:1mm}.sx-n .sx-code{line-height:1;letter-spacing:0;color:#000}.sx-n .sx-nm{white-space:normal;font-weight:700;line-height:1.2;padding:0 2mm;overflow-wrap:anywhere;color:#000}
.sx-gap{flex:none}.sx-foot{position:absolute;left:${STK_PAGE.m}mm;right:${STK_PAGE.m}mm;bottom:2mm;margin:0;font:400 6pt Sarabun,sans-serif;color:#5A6080;text-align:center}`;

async function makeStickersPdf(pid, counts) {
  await refreshForPdf(); const p = profileById(pid);
  const slots = stkSlotsOf(pid); if (!STK_TYPES.some((t) => counts[t.key] > 0)) throw new Error('NO_TYPES'); if (!slots.length && STK_TYPES.some((t) => !t.num && counts[t.key] > 0)) throw new Error('NO_SLOTS'); if (counts.num > 0 && !medsOf(pid).length) throw new Error('NO_MEDS');
  const jsPDF = await loadPdfLibs();
  const wrap = document.createElement('div'); wrap.className = 'sx-wrap'; wrap.innerHTML = `<style>${STK_CSS}</style>${stkPagesHtml(p, counts)}`; document.body.appendChild(wrap);
  try {
    await Promise.all([...wrap.querySelectorAll('img')].map((im) => (im.complete ? 1 : new Promise((r) => { im.onload = im.onerror = r; }))));
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]);
    const pages = [...wrap.querySelectorAll('.sx-page')]; let pdf = null;
    for (let i = 0; i < pages.length; i++) {
      const land = pages[i].dataset.o === 'land'; const o = land ? 'landscape' : 'portrait';
      const cv = await window.html2canvas(pages[i], { scale: 3, backgroundColor: '#fff', useCORS: true, onclone: preloadCloneFonts });
      if (!pdf) pdf = new jsPDF({ orientation: o, unit: 'mm', format: 'a4' }); else pdf.addPage('a4', o);
      pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, land ? 297 : 210, land ? 210 : 297);
    }
    return { pdf, pages: pages.length, name: `สติกเกอร์ยา-${p.name}-${todayKey()}.pdf` };
  } finally { wrap.remove(); }
}

function stickerSheet(pid) {
  const p = profileById(pid); if (!p) return;
  const slots = stkSlotsOf(pid);
  if (!slots.length && !medsOf(pid).length) return toast('ยังไม่มียา จึงยังไม่มีสติกเกอร์ให้สร้าง');
  const types = slots.length ? STK_TYPES : STK_TYPES.filter((t) => t.num); // ไม่มียากินประจำ = ทำได้เฉพาะป้ายรหัสยา
  const row = (t) => { const g = stkGeom(t); return `<div class="card flat stk-opt"><span class="stk-txt"><b>${esc(t.title)}</b><br><small class="muted">ขนาด ${t.size} · ${g.perPage} ดวง/แผ่น (A4 แนว${g.o === 'land' ? 'นอน' : 'ตั้ง'})</small></span>
    <label class="stk-tick" aria-label="เลือกสติกเกอร์ขนาดนี้"><input type="checkbox" data-tick="${t.key}" checked><i></i></label></div>`; };
  const sh = openSheet(`<h3>⭐ สติกเกอร์ช่วงเวลาและรหัสยา — ${esc(p.name)}</h3>
    <p class="small muted">${slots.length ? `ช่วงที่มียา: ${slots.map((s) => esc(s.short)).join(' · ')}<br>` : ''}กรอบสีตามสีประจำตัวของ ${esc(p.name)} <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${p.color};vertical-align:-2px"></span></p>
    <p class="small"><b>ไฟล์ขนาด A4</b> แนะนำให้ใช้กระดาษสติ๊กเกอร์กันน้ำ</p>
    <div class="stk-opts">${types.filter((t) => !t.num).map(row).join('')}</div>
    <div class="card flat stk-mode" id="stk-mode-box"><div class="stk-opt-head"><span class="stk-txt"><b>ป้ายรหัสยา</b> <small class="muted">(ขนาด 3.05 × 3.05 ซม.)</small></span>
      <label class="stk-tick" aria-label="เลือกป้ายรหัสยา"><input type="checkbox" data-tick="num" checked><i></i></label></div>
      <label><input type="radio" name="stk-mode" value="fill" checked><span><b>เต็มหน้า ใช้พื้นที่คุ้ม</b><small class="muted">วนรหัสยาซ้ำจนเต็มแผ่น A4 (แผ่นละประมาณ 54 ดวง) ตัดแล้วใช้ได้หลายชุด</small></span></label>
      <label><input type="radio" name="stk-mode" value="count"><span><b>ตามจำนวนยาที่กิน</b><small class="muted">รหัสยารายการละ 1 ดวง ไม่ซ้ำ เหลือพื้นที่ว่างไว้</small></span></label></div>
    <p class="small muted" id="stk-sum"></p>
    <p class="small muted">พิมพ์ที่ 100% (ไม่ย่อ/ขยายหน้า) แล้วตัดตามกรอบ · ระบบเลือกแนวกระดาษที่วางได้มากที่สุดให้เอง</p>
    <div class="row"><button class="btn ghost" data-act="close">ปิด</button><button class="btn" id="stk-go">⬇️ สร้างไฟล์ PDF</button></div>`);
  const counts = { bag: slots.length ? 1 : 0, cell: slots.length ? 1 : 0, box: slots.length ? 1 : 0, num: 1, numMode: 'fill' };
  const sync = () => { types.forEach((t) => { const o = $(`#stk-n-${t.key}`, sh); if (o) o.textContent = counts[t.key]; });
    $('#stk-mode-box', sh)?.classList.toggle('off', !counts.num);
    const n = types.reduce((a, t) => a + stkPageCount(t, counts, pid), 0); $('#stk-sum', sh).textContent = n ? `รวม ${n} แผ่น (${n} หน้า PDF)` : 'ยังไม่ได้เลือกแผ่นไหนเลย'; $('#stk-go', sh).disabled = !n; };
  sh.addEventListener('click', (e) => { const b = e.target.closest('.stk-b'); if (!b) return; const k = b.dataset.k; counts[k] = Math.max(0, Math.min(STK_PAGE.maxPages, counts[k] + +b.dataset.d)); sync(); });
  sh.addEventListener('change', (e) => { const tk = e.target.dataset?.tick; if (tk) { counts[tk] = e.target.checked ? 1 : 0; sync(); } });
  sh.addEventListener('change', (e) => { if (e.target.name === 'stk-mode') { counts.numMode = e.target.value; sync(); } });
  sync();
  $('#stk-go', sh).onclick = async () => {
    if (!types.some((t) => counts[t.key] > 0)) return toast('เลือกจำนวนแผ่นอย่างน้อย 1 แผ่น');
    if (!canUse('pdf')) return premiumSheet('pdf');
    toast('กำลังสร้างไฟล์สติกเกอร์…');
    try { const { pdf, name, pages } = await makeStickersPdf(pid, counts); pdf.save(name); toast(`✓ บันทึกสติกเกอร์แล้ว (${pages} หน้า)`); closeSheet(); }
    catch (e) { console.error(e); toast('สร้างไฟล์สติกเกอร์ไม่สำเร็จ — ลองใหม่อีกครั้ง'); }
  };
}