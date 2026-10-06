/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — สติกเกอร์ช่วงเวลากินยา (PDF A4 แนวนอน) 3 ขนาด · ใช้สีกรอบตามสีประจำตัวของโปรไฟล์
   1) ถุงซิปล็อก 4 × 2.7 ซม.  2) ช่องกล่องยา 2.5 × 1.5 ซม.  3) กล่องยาใหญ่ 6 × 4 ซม. */
'use strict';

const STK_TYPES = [
  { key: 'bag', title: 'ติดถุงซิปล็อก (6×8 ซม.)', size: '4 × 2.7 ซม.', w: 40, h: 27, icon: 14, fLabel: 12.5, fName: 11, gp: .5, nm: -0.6, pt: .2, lm: .3, long: true, name: true, bd: 1.1 },
  { key: 'cell', title: 'ติดช่องกล่องใส่ยา', size: '2.5 × 1.5 ซม.', w: 25, h: 15, icon: 8.4, fLabel: 8.8, fName: 0, gp: .5, nm: 0, pt: .6, lm: .2, long: false, name: false, bd: .6, byCol: true },
  { key: 'box', title: 'ติดกล่องใส่ยาขนาดใหญ่', size: '6 × 4 ซม.', w: 60, h: 40, icon: 20.5, fLabel: 18.5, fName: 15.5, gp: .7, nm: -1.0, pt: .1, lm: .5, long: true, name: true, bd: 1.6 },
];
const STK_ICON = { before_breakfast: 'morning', after_breakfast: 'morning', before_lunch: 'day', after_lunch: 'day', before_dinner: 'evening', after_dinner: 'evening', bedtime: 'night' };
const STK_PAGE = { m: 5, gap: 0, foot: 5, maxPages: 5 }; // มม. — ขอบ 5 มม. ไม่เว้นช่องไฟระหว่างดวง (วางชิดกันให้ร้านสติกเกอร์ตัด) เหลือที่ท้ายกระดาษ 5 มม. สำหรับข้อความกำกับ

/** ช่วงเวลาที่คนนี้มียากินประจำ (เรียงตามเวลาในวัน) */
function stkSlotsOf(pid) {
  const used = new Set(medsOf(pid).filter((m) => m.status === 'active' && !m.as_needed).flatMap((m) => m.slots));
  return SLOTS.filter((s) => used.has(s.key));
}
const stkEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function stkCellHtml(t, p, s) {
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

/** 1 หน้าของสติกเกอร์ 1 ขนาด → แถวของช่วงเวลา · ช่องเล็ก: เรียงช่วงเวลาซ้ำเป็นแนวตั้ง (เหมือนแผ่นต้นแบบ) · ช่องอื่น: แบ่งช่องให้แต่ละช่วงเท่าๆ กัน เรียงเป็นกลุ่ม */
function stkLayout(t, slots) {
  const geo = stkGeom(t); const total = geo.cols * geo.rows; const seq = [];
  if (t.byCol) { for (let i = 0; i < total; i++) seq.push(slots[(i % geo.cols) % slots.length]); }
  else { const base = Math.floor(total / slots.length), extra = total % slots.length; slots.forEach((s, k) => { for (let j = 0; j < base + (k < extra ? 1 : 0); j++) seq.push(s); }); }
  const rows = []; for (let r = 0; r < geo.rows; r++) rows.push(seq.slice(r * geo.cols, (r + 1) * geo.cols));
  return { rows, geo };
}

/** counts: { bag: จำนวนแผ่น, cell: …, box: … } */
function stkPagesHtml(p, counts) {
  const slots = stkSlotsOf(p.id); let html = ''; const tot = STK_TYPES.reduce((a, t) => a + (counts[t.key] || 0), 0); let no = 0;
  STK_TYPES.forEach((t) => {
    const n = counts[t.key] || 0; if (!n) return; const { rows, geo } = stkLayout(t, slots);
    for (let i = 0; i < n; i++) {
      no++;
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
.sx-foot{position:absolute;left:${STK_PAGE.m}mm;right:${STK_PAGE.m}mm;bottom:2mm;margin:0;font:400 6pt Sarabun,sans-serif;color:#5A6080;text-align:center}`;

async function makeStickersPdf(pid, counts) {
  await refreshForPdf(); const p = profileById(pid);
  const slots = stkSlotsOf(pid); if (!slots.length) throw new Error('NO_SLOTS'); if (!STK_TYPES.some((t) => counts[t.key] > 0)) throw new Error('NO_TYPES');
  const jsPDF = await loadPdfLibs();
  const wrap = document.createElement('div'); wrap.className = 'sx-wrap'; wrap.innerHTML = `<style>${STK_CSS}</style>${stkPagesHtml(p, counts)}`; document.body.appendChild(wrap);
  try {
    await Promise.all([...wrap.querySelectorAll('img')].map((im) => (im.complete ? 1 : new Promise((r) => { im.onload = im.onerror = r; }))));
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]);
    const pages = [...wrap.querySelectorAll('.sx-page')]; let pdf = null;
    for (let i = 0; i < pages.length; i++) {
      const land = pages[i].dataset.o === 'land'; const o = land ? 'landscape' : 'portrait';
      const cv = await window.html2canvas(pages[i], { scale: 3, backgroundColor: '#fff', useCORS: true });
      if (!pdf) pdf = new jsPDF({ orientation: o, unit: 'mm', format: 'a4' }); else pdf.addPage('a4', o);
      pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, land ? 297 : 210, land ? 210 : 297);
    }
    return { pdf, pages: pages.length, name: `สติกเกอร์ยา-${p.name}-${todayKey()}.pdf` };
  } finally { wrap.remove(); }
}

function stickerSheet(pid) {
  const p = profileById(pid); if (!p) return;
  const slots = stkSlotsOf(pid);
  if (!slots.length) return toast('ยังไม่มียาที่กินประจำ จึงยังไม่มีสติกเกอร์ให้สร้าง');
  const row = (t) => { const g = stkGeom(t); return `<div class="card flat stk-opt"><span class="stk-txt"><b>${esc(t.title)}</b><br><small class="muted">ขนาด ${t.size} · ${g.perPage} ดวง/แผ่น (A4 แนว${g.o === 'land' ? 'นอน' : 'ตั้ง'})</small></span>
    <span class="stk-step"><button type="button" class="stk-b" data-k="${t.key}" data-d="-1" aria-label="ลด">−</button><output id="stk-n-${t.key}">1</output><button type="button" class="stk-b" data-k="${t.key}" data-d="1" aria-label="เพิ่ม">+</button></span></div>`; };
  const sh = openSheet(`<h3>🏷️ สติกเกอร์ช่วงเวลากินยา — ${esc(p.name)}</h3>
    <p class="small muted">ช่วงที่มียา: ${slots.map((s) => esc(s.short)).join(' · ')} · กรอบสีตามสีประจำตัวของ ${esc(p.name)} <span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${p.color};vertical-align:-2px"></span></p>
    <p class="small"><b>เลือกจำนวนแผ่น A4</b> ของแต่ละขนาด (0 = ไม่เอา)</p>
    <div class="stk-opts">${STK_TYPES.map(row).join('')}</div>
    <p class="small muted" id="stk-sum"></p>
    <p class="small muted">พิมพ์ที่ 100% (ไม่ย่อ/ขยายหน้า) แล้วตัดตามกรอบ · ระบบเลือกแนวกระดาษที่วางได้มากที่สุดให้เอง</p>
    <div class="row"><button class="btn ghost" data-act="close">ปิด</button><button class="btn" id="stk-go">⬇️ ดาวน์โหลด PDF</button></div>`);
  const counts = { bag: 1, cell: 1, box: 1 };
  const sync = () => { STK_TYPES.forEach((t) => { $(`#stk-n-${t.key}`, sh).textContent = counts[t.key]; });
    const n = STK_TYPES.reduce((a, t) => a + counts[t.key], 0); $('#stk-sum', sh).textContent = n ? `รวม ${n} แผ่น (${n} หน้า PDF)` : 'ยังไม่ได้เลือกแผ่นไหนเลย'; $('#stk-go', sh).disabled = !n; };
  sh.addEventListener('click', (e) => { const b = e.target.closest('.stk-b'); if (!b) return; const k = b.dataset.k; counts[k] = Math.max(0, Math.min(STK_PAGE.maxPages, counts[k] + +b.dataset.d)); sync(); });
  sync();
  $('#stk-go', sh).onclick = async () => {
    if (!STK_TYPES.some((t) => counts[t.key] > 0)) return toast('เลือกจำนวนแผ่นอย่างน้อย 1 แผ่น');
    if (!canUse('pdf')) return premiumSheet('pdf');
    toast('กำลังสร้างไฟล์สติกเกอร์…');
    try { const { pdf, name, pages } = await makeStickersPdf(pid, counts); pdf.save(name); toast(`✓ ดาวน์โหลดสติกเกอร์แล้ว (${pages} หน้า)`); closeSheet(); }
    catch (e) { console.error(e); toast('สร้างไฟล์สติกเกอร์ไม่สำเร็จ — ลองใหม่อีกครั้ง'); }
  };
}