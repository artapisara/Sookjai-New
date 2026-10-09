/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — วาดหน้า PDF ด้วยโค้ดโดยตรง (Canvas 2D) แทนการให้ html2canvas เลียนแบบหน้าเว็บ
 * ข้อความทุกตัวถูกจัดและวาดด้วยตัวจัดภาษาไทยของเบราว์เซอร์เอง (ฟอนต์ Sarabun ที่ฝังในแอป) จึงไม่เกิดอาการช่องไฟกระจาย/ตัวเล็กเพี้ยน
 * ตอนนี้ใช้กับ "ตารางกินยา 1 วัน" (ตารางรหัสยา + รายการยา) — ข้อมูลและหน้าตาเหมือน mpDoc() ใน pages.js
 */
'use strict';

const CVS = { S: 2, W: 1047, H: 718, FOOT: 40, INK: '#111', LINE: '#333', RED: '#C62828', GREY: '#555', PINK: '#B0407E' };
const cvFont = (w, px) => `${w} ${px}px Sarabun, 'TH Sarabun New', 'Leelawadee UI', sans-serif`;

/** ตัดบรรทัดตามคำภาษาไทย (Intl.Segmenter) ให้ไม่กว้างเกิน maxW — คำยาวเกินช่องจะตัดตามตัวอักษร */
function cvWrap(ctx, text, maxW) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim(); if (!t) return [];
  const toks = (typeof Intl !== 'undefined' && Intl.Segmenter) ? [...new Intl.Segmenter('th', { granularity: 'word' }).segment(t)].map((s) => s.segment) : t.split(/(?<= )/);
  // วงเล็บ ( … ) เป็นก้อนเดียวไม่แยกบรรทัด — ชื่อยาที่ยาว เช่น "Paracetamol + Tramadol (DUOCETZ)" จะย้ายทั้ง "(DUOCETZ)" ลงบรรทัดล่าง ไม่ปล่อย "(" ค้างท้ายบรรทัด
  { const merged = []; let pend = null;
    for (const tk of toks.splice(0)) {
      if (pend) { pend.push(tk); if (tk.includes(')')) { merged.push(pend.join('')); pend = null; } continue; }
      if (tk.includes('(') && !tk.includes(')')) { pend = [tk]; continue; }
      merged.push(tk);
    }
    if (pend) merged.push(...pend); // วงเล็บไม่ปิด = ไม่รวมก้อน
    toks.push(...merged); }
  const lines = []; let cur = '';
  const pushLong = (w) => { let piece = ''; for (const ch of [...w]) { if (ctx.measureText(piece + ch).width > maxW && piece) { lines.push(piece); piece = ch; } else piece += ch; } return piece; };
  for (const w of toks) {
    if (ctx.measureText(cur + w).width <= maxW) { cur += w; continue; }
    if (cur.trim()) lines.push(cur.trimEnd());
    cur = w.trimStart();
    if (ctx.measureText(cur).width > maxW) cur = pushLong(cur);
  }
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines;
}
/** วาดข้อความ 1 บรรทัด (จุดกึ่งกลางแนวตั้งที่ y) */
let CV_LOG = null; let CV_ISSUES = []; // ปัญหาที่พบตอนจัดหน้า (เช่น หมายเหตุมากเกินหน้า) // ระหว่างวาด: เก็บทุกข้อความที่วาดไว้ตรวจความถูกต้องภายหลัง (cvAudit)
function cvText(ctx, str, x, y, font, color, align = 'left') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y);
  if (CV_LOG) CV_LOG.push({ t: String(str), x, align, w: ctx.measureText(String(str)).width, cv: ctx.canvas });
}
/** ตรวจ PDF ที่วาดตรง: (1) ฟอนต์ Sarabun พร้อมครบ (2) ไม่มีข้อความล้นขอบหน้า (3) ข้อมูลยาทุกตัวถูกวาดครบตามที่กรอก — รหัสยาครบทุกช่อง/หน้า ชื่อ จำนวน เวลา ใช้รักษา หมายเหตุ · คืนรายการปัญหา (ว่าง = ผ่าน) */
function cvAuditBasic(log) {
  const issues = [];
  { const mc = document.createElement('canvas').getContext('2d'); const sample = 'กิ่งไม้ผู้ปู่ ๑๒๓ Abc';
    ['400', '600', '700'].forEach((w) => { const wd = (fam) => { mc.font = `${w} 40px ${fam}`; return mc.measureText(sample).width; }; const a = wd('Sarabun'); if (Math.abs(a - wd('monospace')) < 0.5 && Math.abs(a - wd('serif')) < 0.5) issues.push(`ฟอนต์ Sarabun น้ำหนัก ${w} ไม่ถูกใช้ (ตกไปใช้ฟอนต์สำรอง)`); }); } // วัดความกว้างจริง: ถ้าเท่ากับฟอนต์สำรองทุกชนิด = ฟอนต์ยังไม่ถูกโหลด
  log.forEach(({ t, x, align, w, cv }) => { const pw = cv.width / (cv.__sc || CVS.S); const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; if (left < -1 || left + w > pw + 1) issues.push(`ข้อความล้นขอบหน้า "${t.slice(0, 24)}"`); });
  return issues;
}
function cvAudit(p, meds, log) {
  const issues = cvAuditBasic(log); const nz = (s) => String(s ?? '').replace(/\s+/g, '');
  const all = nz(log.map((l) => l.t).join('')); const cnt = {}; log.forEach((l) => { cnt[l.t] = (cnt[l.t] || 0) + 1; });
  meds.forEach((m) => {
    const code = medNo(m); const want = m.slots.length * 2 + 1; // ตารางรหัสยา + หน้าเฉพาะตัวเลข (อย่างละ 1 ต่อช่วงเวลา) + รายการยา 1
    if ((cnt[code] || 0) < want) issues.push(`รหัส ${code}: วาด ${cnt[code] || 0} ครั้ง ควร ${want}`);
    const mustHave = [m.slots.length ? printName(medShort(m)) : null, printName(m.name), medGeneric(m) ? printName(medGeneric(m)) : null, printName(m.purpose || ''), `${doseLabel(m.dose)} ${unitOf(m)}`, medWhen(m), ...remarkParts(m).map((x) => x.t)].filter(Boolean);
    mustHave.forEach((s) => { if (nz(s) && !all.includes(nz(s))) issues.push(`รหัส ${code}: ไม่พบข้อความ "${String(s).slice(0, 24)}" ใน PDF`); });
  });
  return issues;
}
function cvDot(ctx, x, y, r = 3.5, c = CVS.RED) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function cvRect(ctx, x, y, w, h, fill, stroke, lw = 1) { if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h); } }

/** ชิ้นส่วนที่ "วัดขนาดก่อน แล้ววาดทีหลัง": คืน { h, draw(ctx, x, y, w) } */
function cvBlock(h, draw) { return { h, draw }; }

/** จำนวนเม็ดยา (เมื่อไม่ใช่ 1): ตัวหนังสือใหญ่อ่านง่ายในกรอบสีเทาบางๆ ชิดขวาของรหัสยา — ย่อขนาดอัตโนมัติถ้าที่ไม่พอ · คืนความกว้างที่ใช้ */
function cvDosePill(ctx, text, x, cy, px, maxW) {
  let fs = px; ctx.font = cvFont(700, fs); let tw = ctx.measureText(text).width;
  while (tw + 14 > maxW && fs > 11) { fs -= 1; ctx.font = cvFont(700, fs); tw = ctx.measureText(text).width; }
  const w = tw + 14, h = fs + 10, r = h / 2;
  ctx.save(); ctx.beginPath(); ctx.moveTo(x + r, cy - h / 2); ctx.arcTo(x + w, cy - h / 2, x + w, cy + h / 2, r); ctx.arcTo(x + w, cy + h / 2, x, cy + h / 2, r); ctx.arcTo(x, cy + h / 2, x, cy - h / 2, r); ctx.arcTo(x, cy - h / 2, x + w, cy - h / 2, r); ctx.closePath();
  ctx.fillStyle = '#F0F0F0'; ctx.fill(); ctx.strokeStyle = '#CFCFCF'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  cvText(ctx, text, x + 7, cy + 1, cvFont(700, fs), CVS.RED); return w;
}
/** เซลล์ตารางรหัสยา (1 ยา) */
function cvGridCell(ctx, m, w) {
  const parts = remarkParts(m); const warn = parts.filter((x) => x.kind === 'warn').map((x) => x.t); const hint = parts.filter((x) => x.kind === 'hint').map((x) => x.t);
  const pad = 8, inner = w - pad * 2; const dz = num(m.dose, 1) !== 1 ? `${doseLabel(m.dose)} ${unitOf(m)}` : '';
  const fCode = cvFont(700, 24), fStar = cvFont(700, 24), fName = cvFont(600, 16.7), fAs = cvFont(600, 12.7), fWarn = cvFont(600, 12.7), fHint = cvFont(400, 12);
  ctx.font = fCode; const code = medNo(m); const wCode = ctx.measureText(code).width;
  ctx.font = fStar; const wStar = m.as_needed ? ctx.measureText('*').width + 4 : 0;
  ctx.font = fName; const nameLines = cvWrap(ctx, printName(medShort(m)), inner);
  ctx.font = fWarn; const warnLines = warn.map((t) => cvWrap(ctx, t, inner - 12));
  ctx.font = fHint; const hintLines = hint.map((t) => cvWrap(ctx, t, inner));
  const lhName = 21, lhSm = 16;
  const h = pad + 30 + 3 + nameLines.length * lhName + (showAsn(m) ? lhSm + 1 : 0) + warnLines.reduce((a, l) => a + l.length * lhSm + 2, 0) + hintLines.reduce((a, l) => a + l.length * lhSm + 1, 0) + pad;
  const bg = m.as_needed ? '#FDE7F1' : warn.length ? '#FFF3B0' : '#fff';
  return { h, bg, draw(x, y) {
    const cx = x + w / 2; const cy = y + pad + 15; const px = cx - wCode / 2; // รหัสยาอยู่กลางช่องเสมอ · ดอกจันชิดซ้ายของรหัส · จำนวนเม็ดชิดขวาของรหัส
    if (m.as_needed) cvText(ctx, '*', px - wStar, cy, fStar, CVS.PINK);
    cvText(ctx, code, px, cy, fCode, '#000');
    if (dz) cvDosePill(ctx, dz, px + wCode + 6, cy, 20, x + w - 4 - (px + wCode + 6));
    let ty = y + pad + 30 + 3; // ขอบบนของบรรทัดถัดไป (จุดกลางบรรทัด = ty + ความสูงบรรทัด/2)
    for (const l of nameLines) { cvText(ctx, l, cx, ty + lhName / 2, fName, CVS.INK, 'center'); ty += lhName; }
    if (showAsn(m)) { cvText(ctx, 'เมื่อมีอาการ', cx, ty + lhSm / 2, fAs, CVS.PINK, 'center'); ty += lhSm + 1; }
    for (const ls of warnLines) { ls.forEach((l, i) => { ctx.font = fWarn; const tw = ctx.measureText(l).width; const off = i === 0 ? 10 : 0; const sx = cx - (tw + off) / 2; if (i === 0) cvDot(ctx, sx + 3, ty + lhSm / 2, 3); cvText(ctx, l, sx + off, ty + lhSm / 2, fWarn, CVS.RED); ty += lhSm; }); ty += 2; }
    for (const ls of hintLines) { for (const l of ls) { cvText(ctx, l, cx, ty + lhSm / 2, fHint, CVS.GREY, 'center'); ty += lhSm; } ty += 1; }
  } };
}

/** ส่วนหัวของหน้า: ชื่อเรื่อง + กล่องข้อมูล 2 ช่อง + แถบสี — คืนตำแหน่ง y ที่เริ่มตาราง */
function cvHead(ctx, p, meds, kind, W = CVS.W, ym = null) {
  const fTitle = cvFont(700, 26.7), f14 = cvFont(400, 14), f14b = cvFont(700, 14), f12 = cvFont(600, 12);
  const title = kind === 'grid' ? `ตารางการกินยาใน 1 วัน (${p.name})` : kind === 'num' ? `ตารางรหัสยา เฉพาะตัวเลข (${p.name})` : kind === 'sum' ? `สรุปการกินยา (${p.name})` : `รายการยา (${p.name})`;
  const odd = meds.filter((m) => num(m.dose, 1) !== 1).map(medNo); const oral = meds.filter(isOralMed).length;
  const upd = `UPD: ${updDate(meds)}`;
  ctx.font = f14; const wUpd = ctx.measureText(upd).width + 24;
  let box1W, box1Draw; const boxH = 48;
  if (kind === 'num') {
    const l1a = 'ทานครั้งละ 1 เม็ด ', l1b = odd.length ? '(ยกเว้นรหัสที่ระบุจำนวนไว้ในช่อง)' : '', l2 = '* = กินเฉพาะเมื่อมีอาการ'; // จำนวนที่ไม่ใช่ 1 เขียนไว้ในช่องของแต่ละรหัสอยู่แล้ว
    ctx.font = f14; const wa = ctx.measureText(l1a).width; ctx.font = f14b; const wb = l1b ? ctx.measureText(l1b).width : 0; ctx.font = f12; const w2 = ctx.measureText(l2).width;
    box1W = Math.max(wa + wb, w2) + 24;
    box1Draw = (x, y) => { cvText(ctx, l1a, x + 12, y + 14, f14, CVS.INK); cvText(ctx, l1b, x + 12 + wa, y + 14, f14b, CVS.RED); cvText(ctx, l2, x + 12, y + 34, f12, '#333'); };
  } else if (kind === 'grid') {
    const l1a = 'ทานครั้งละ 1 เม็ด ', l1b = odd.length ? `(ยกเว้นรหัส ${odd.join(' และ ')})` : '';
    ctx.font = f14; const wa = ctx.measureText(l1a).width; ctx.font = f14b; const wb = l1b ? ctx.measureText(l1b).width : 0;
    const leg = ['สัญลักษณ์: ', 'เหลือง = ข้อควรระวัง', ' ', 'ชมพู * = กินเฉพาะเมื่อมีอาการ']; ctx.font = f12; const wl = leg.reduce((a, s) => a + ctx.measureText(s).width, 0) + 2 * 14;
    box1W = Math.max(wa + wb, wl) + 24;
    box1Draw = (x, y) => { cvText(ctx, l1a, x + 12, y + 14, f14, CVS.INK); cvText(ctx, l1b, x + 12 + wa, y + 14, f14b, CVS.RED);
      let lx = x + 12; const ly = y + 34; cvText(ctx, leg[0], lx, ly, f12, '#333'); ctx.font = f12; lx += ctx.measureText(leg[0]).width;
      cvRect(ctx, lx, ly - 6, 12, 12, '#FFF3B0', '#777', .8); lx += 16; cvText(ctx, leg[1], lx, ly, f12, '#333'); ctx.font = f12; lx += ctx.measureText(leg[1]).width + 8;
      cvRect(ctx, lx, ly - 6, 12, 12, '#FDE7F1', '#777', .8); lx += 16; cvText(ctx, leg[3], lx, ly, f12, '#333'); };
  } else {
    const t1 = kind === 'sum' ? `เดือน${monthLabel(ym)}` : `${p.relation || ''}${ageOf(p.birth_year) ? ` · อายุ ${ageOf(p.birth_year)} ปี` : ''} · ยาทาน ${oral} ตัว · ยาอื่นๆ ${meds.length - oral} ตัว`.replace(/^ · /, ''); ctx.font = f14;
    box1W = ctx.measureText(t1).width + 24; box1Draw = (x, y) => cvText(ctx, t1, x + 12, y + boxH / 2, f14, CVS.INK);
  }
  const bx2 = W - wUpd, bx1 = bx2 - box1W; const by = 4;
  if (bx1 < 360) { // หน้าแคบ (แนวตั้ง) หรือกล่องยาว: ชื่อเรื่องเต็มบรรทัดบน กล่องข้อมูลลงบรรทัดล่างชิดขวา — ไม่บีบชื่อเรื่อง
    const b2x = Math.max(0, W - wUpd), b1x = Math.max(0, b2x - box1W - 8); const rowY = by + 38;
    ctx.font = fTitle; cvText(ctx, cvWrap(ctx, title, W)[0] || title, 0, by + 17, fTitle, '#000');
    cvRect(ctx, b1x, rowY, box1W, boxH, '#fff', '#666'); cvRect(ctx, b2x, rowY, wUpd, boxH, '#fff', '#666'); box1Draw(b1x, rowY); cvText(ctx, upd, b2x + 12, rowY + boxH / 2, f14, CVS.INK);
    const barY2 = rowY + boxH + 8; cvRect(ctx, 0, barY2, W, 5, p.color); return barY2 + 5 + 10;
  }
  ctx.font = fTitle; const tLines = cvWrap(ctx, title, bx1 - 20); const tl = tLines.slice(0, 2);
  const th = tl.length * 34; const blockH = Math.max(boxH, th);
  cvRect(ctx, bx1, by + (blockH - boxH) / 2, box1W, boxH, '#fff', '#666'); cvRect(ctx, bx2, by + (blockH - boxH) / 2, wUpd, boxH, '#fff', '#666'); box1Draw(bx1, by + (blockH - boxH) / 2); cvText(ctx, upd, bx2 + 12, by + blockH / 2, f14, CVS.INK);
  tl.forEach((l, i) => cvText(ctx, l, 0, by + (blockH - th) / 2 + 17 + i * 34, fTitle, '#000'));
  const barY = by + blockH + 8; cvRect(ctx, 0, barY, W, 5, p.color); return barY + 5 + 10;
}

/** วาดเป็นภาพรายหน้า — คืน { canvases, pages } */
async function renderMedsCanvases(p, meds) {
  CV_LOG = []; CV_ISSUES = [];
  await waitVisible();
  await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 16px Sarabun`, 'ก ภาษาไทย ABC 123 ๑'))); await document.fonts.ready;
  const { S, W, H, FOOT } = CVS; const pages = []; const mk = (portrait = false) => { const pw = portrait ? H : W, ph = portrait ? W : H; const c = document.createElement('canvas'); c.width = pw * S; c.height = ph * S; const ctx = c.getContext('2d'); ctx.scale(S, S); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pw, ph); const pg = { c, ctx, portrait, pw, ph }; pages.push(pg); return pg; };
  const measure = document.createElement('canvas').getContext('2d');
  const tint = (hex, a) => { const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16); const m = (v) => Math.round(255 - (255 - v) * a); return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`; };
  const pcl = tint(p.color, .5), pcs = tint(p.color, .18); const limitY = H - FOOT - 6;

  // ---------- 1) ตารางรหัสยา ----------
  { const cols = SLOTS.map((s) => ({ s, list: meds.filter((m) => m.slots.includes(s.key)) })).filter((c) => c.list.length); const n = Math.max(1, cols.length); const cw = W / n;
    const nRows = Math.max(1, ...cols.map((c) => c.list.length));
    const headH = 58; let pg = mk(); let y = cvHead(pg.ctx, p, meds, 'grid');
    const drawHeader = () => { cols.forEach(({ s }, i) => { const x = i * cw; const pre = s.short.startsWith('ก่อน') ? 'ก่อน' : s.short.startsWith('หลัง') ? 'หลัง' : ''; const aft = pre === 'หลัง'; cvRect(pg.ctx, x, y, cw, headH, aft ? pcl : pcs, CVS.LINE);
        const f = cvFont(700, 16.7); const rest = pre ? s.short.slice(pre.length) : s.short; pg.ctx.font = f; const w1 = pre ? pg.ctx.measureText(pre).width : 0; const w2 = pg.ctx.measureText(rest).width; let sx = x + cw / 2 - (w1 + w2) / 2;
        if (pre) { cvText(pg.ctx, pre, sx, y + 19, f, '#000'); pg.ctx.fillStyle = '#000'; pg.ctx.fillRect(sx, y + 29, w1, 1.4); sx += w1; } cvText(pg.ctx, rest, sx, y + 19, f, '#000'); cvText(pg.ctx, slotTime(s.key), x + cw / 2, y + 43, cvFont(600, 12.7), '#222', 'center'); }); y += headH; };
    drawHeader();
    for (let r = 0; r < nRows; r++) {
      const cells = cols.map(({ list }) => (list[r] ? cvGridCell(measure, list[r], cw) : null)); const rh = Math.max(40, ...cells.map((c) => (c ? c.h : 0)));
      if (y + rh > limitY && y > 90) { pg = mk(); y = cvHead(pg.ctx, p, meds, 'grid'); drawHeader(); }
      cells.forEach((c, i) => { const x = i * cw; if (c) { const real = cvGridCell(pg.ctx, cols[i].list[r], cw); cvRect(pg.ctx, x, y, cw, rh, real.bg, null); real.draw(x, y); } else cvRect(pg.ctx, x, y, cw, rh, '#fff', null); cvRect(pg.ctx, x, y, cw, rh, null, CVS.LINE); });
      y += rh;
    }
    const loose = meds.filter((m) => !m.slots.length);
    if (loose.length) { const t = `ยาที่ไม่ได้กำหนดช่วงเวลา (ไม่อยู่ในตาราง): ${loose.map((m) => `${medNo(m)} ${printName(medShort(m))}`).join('   ')}`; measure.font = cvFont(400, 13.3); const ls = cvWrap(measure, t, W); if (y + 14 + ls.length * 18 > limitY) { pg = mk(); y = cvHead(pg.ctx, p, meds, 'grid'); } ls.forEach((l, i) => cvText(pg.ctx, l, 0, y + 16 + i * 18, cvFont(400, 13.3), '#444')); }
  }
  // ---------- 2) รายการยา ----------
  { const wp = [9, 23, 17, 10, 16, 25]; const xs = []; let acc = 0; wp.forEach((v) => { xs.push(Math.round((acc / 100) * W)); acc += v; }); xs.push(W); const cwOf = (i) => xs[i + 1] - xs[i];
    const heads = ['รหัสยา', 'ชื่อยา', 'ใช้รักษา', 'จำนวน', 'เวลา', 'หมายเหตุ']; const headH = 38; let pg = mk(); let y = cvHead(pg.ctx, p, meds, 'list');
    const drawHeader = () => { heads.forEach((t, i) => { cvRect(pg.ctx, xs[i], y, cwOf(i), headH, pcl, CVS.LINE); cvText(pg.ctx, t, i === 0 ? xs[i] + cwOf(i) / 2 : xs[i] + 8, y + headH / 2, cvFont(700, 16.7), '#000', i === 0 ? 'center' : 'left'); }); y += headH; };
    drawHeader();
    const f15 = cvFont(400, 15.3), fGen = cvFont(400, 12.7), fNm = cvFont(600, 16.7), fCode = cvFont(700, 24), fNote = cvFont(600, 15.3), fNoteG = cvFont(400, 15.3);
    for (const m of meds) {
      const parts = remarkParts(m); const lay = (ctx0) => {
        const gen = medGeneric(m); // ชื่อทางการแพทย์ ใต้ชื่อยา (ตัวเล็กบาง)
        const out = { nm: (ctx0.font = fNm, cvWrap(ctx0, printName(m.name), cwOf(1) - 16)), gn: gen ? (ctx0.font = fGen, cvWrap(ctx0, printName(gen), cwOf(1) - 16)) : [], pu: (ctx0.font = f15, cvWrap(ctx0, printName(m.purpose || ''), cwOf(2) - 16)), dz: (ctx0.font = f15, cvWrap(ctx0, `${doseLabel(m.dose)} ${unitOf(m)}`, cwOf(3) - 16)), wh: (ctx0.font = f15, cvWrap(ctx0, medWhen(m), cwOf(4) - 16)) };
        out.notes = parts.map((x) => { ctx0.font = x.kind === 'warn' ? fNote : fNoteG; return { x, ls: cvWrap(ctx0, x.t, cwOf(5) - 16 - (x.kind === 'warn' ? 14 : 0)) }; });
        const lh = 22; const nh = out.notes.reduce((a, n) => a + n.ls.length * lh + 2, 0);
        out.h = Math.max(46, 12 + Math.max(out.nm.length * lh + out.gn.length * 18, out.pu.length * lh, out.dz.length * lh, out.wh.length * lh, nh, 30)); return out; };
      const L = lay(measure);
      if (y + L.h > limitY && y > 90) { pg = mk(); y = cvHead(pg.ctx, p, meds, 'list'); drawHeader(); }
      const c = pg.ctx; for (let i = 0; i < 6; i++) cvRect(c, xs[i], y, cwOf(i), L.h, '#fff', CVS.LINE);
      cvText(c, medNo(m), xs[0] + cwOf(0) / 2, y + 12 + 15, fCode, '#000', 'center');
      const col = (lines, i, font, color, bold) => lines.forEach((l, k) => cvText(c, l, xs[i] + 8, y + 6 + 11 + k * 22, font, color));
      col(L.nm, 1, fNm, '#000'); L.gn.forEach((l, k) => cvText(c, l, xs[1] + 8, y + 6 + 11 + L.nm.length * 22 + 2 + k * 18, fGen, CVS.GREY)); col(L.pu, 2, f15, CVS.INK); col(L.dz, 3, f15, CVS.INK); col(L.wh, 4, f15, CVS.INK);
      let ny = y + 6 + 11;
      for (const { x, ls } of L.notes) { const warnK = x.kind === 'warn'; ls.forEach((l, k) => { if (k === 0 && warnK) cvDot(c, xs[5] + 12, ny, 3.5); cvText(c, l, xs[5] + 8 + (warnK ? 14 : 0), ny, warnK ? fNote : fNoteG, warnK ? CVS.RED : CVS.GREY); ny += 22; }); ny += 2; }
      y += L.h;
    }
  }
  // ---------- 3) ตารางรหัสยาเฉพาะตัวเลข (ท้ายไฟล์ 1 หน้า A4 · ยาเยอะ = แนวตั้งอัตโนมัติ) ----------
  { const cols = SLOTS.map((s) => ({ s, list: meds.filter((m) => m.slots.includes(s.key)) })).filter((c) => c.list.length);
    if (cols.length) {
      const nRows = Math.max(...cols.map((c) => c.list.length)); const headH = 58; const NOTE_GAP = 10; const layoutIssues = [];
      // หมายเหตุ = ข้อความจากช่อง "หมายเหตุ / ข้อควรระวัง" ของยา เป็นตัวอักษรเล็กอยู่ฝั่งซ้ายของรหัส เว้นระยะจากรหัส — ลองแนวนอนก่อน ไม่พอค่อยแนวตั้ง/ลดขนาด
      const LMIN = 30; // กว้างต่ำสุดของที่ว่างฝั่งซ้ายสำหรับหมายเหตุ (px)
      const tryLayout = (portrait, fs, fzMax, withNotes = true) => {
        const pw = portrait ? H : W, ph = portrait ? W : H; const cw = pw / cols.length;
        const saved = CV_LOG; CV_LOG = null; const y0 = cvHead(measure, p, meds, 'num', pw); CV_LOG = saved; // วัดความสูงหัวกระดาษ (ไม่บันทึกลงรายการตรวจ)
        const availH = ph - FOOT - 12 - y0 - headH; const fzBase = Math.min(fzMax, Math.floor(Math.min(64, availH / nRows) * 0.62)); const lh = Math.round(fs * 1.25);
        let bad = false; const below = withNotes; // หมายเหตุอยู่ใต้รหัส (ทั้งแนวนอนและแนวตั้ง)
        const info = cols.map(({ list }) => list.map((m) => {
          measure.font = cvFont(700, fzBase); const wC = measure.measureText(medNo(m)).width, wS = m.as_needed ? measure.measureText('*').width : 0;
          const Lw = below ? cw - 10 : cw / 2 - wC / 2 - wS - NOTE_GAP - 5; const parts = withNotes && normTxt(m.warning) ? [{ t: normTxt(m.warning), kind: 'warn' }] : []; if (parts.length && Lw < (below ? 40 : LMIN)) bad = true; // เฉพาะข้อความในช่อง "หมายเหตุ / ข้อควรระวัง" ที่ผู้ใช้กรอก
          measure.font = cvFont(400, fs); const lines = parts.map((x) => ({ x, ls: Lw >= (below ? 40 : LMIN) ? cvWrap(measure, x.t, Lw) : [x.t] })); return { m, Lw, lines, n: lines.reduce((a, l) => a + l.ls.length, 0) };
        }));
        const rowH0 = Array.from({ length: nRows }, (_, r) => Math.max(withNotes ? 40 : 24, ...info.map((c) => (c[r] ? (below && c[r].n ? Math.ceil(fzBase * 1.15) + 3 : 0) + c[r].n * lh + 10 : 0))));
        const total0 = rowH0.reduce((a, b) => a + b, 0);
        return { portrait, below, fs, pw, ph, cw, availH, fzBase, lh, info, rowH0, total0, ok: !bad && total0 <= availH };
      };
      // ลองจากรหัสตัวใหญ่ + แนวนอนก่อน แล้วค่อยลดขนาดรหัส/ตัวหมายเหตุ/เปลี่ยนเป็นแนวตั้ง จนพอดี 1 หน้าและมีที่ว่างฝั่งซ้ายพอ
      // หมายเหตุฝั่งซ้ายใช้เฉพาะตารางแนวนอน (ยาไม่เยอะ) · ยาเยอะจนต้องเป็นแนวตั้ง = ตารางเฉพาะตัวเลขล้วน ไม่มีหมายเหตุ · แนวนอนใส่หมายเหตุไม่พอ = แสดงเฉพาะตัวเลข (หมายเหตุอยู่ในหน้าอื่นของไฟล์ครบแล้ว)
      const needPortrait = (H - 96 - FOOT - 20 - headH) / nRows < 44; let L = null;
      if (!needPortrait) { search: for (const fz of [34, 30, 26, 22]) for (const fs of [10.5, 9.5]) { const t = tryLayout(false, fs, fz, true); if (t.ok) { L = t; break search; } } }
      if (!L) { search2: for (const fz of [34, 30, 26, 22]) for (const fs of [10.5, 9.5, 8.5]) { const t = tryLayout(true, fs, fz, true); if (t.ok) { L = t; break search2; } } }
      if (!L) L = tryLayout(needPortrait, 10, 34, false);
      const { portrait, pw, ph, cw, fzBase, lh, info } = L; const pg = mk(portrait); let y = cvHead(pg.ctx, p, meds, 'num', pw);
      const extra = Math.max(0, L.availH - L.total0); const rowH = L.rowH0.map((h) => Math.min(Math.max(h, 64), h + extra / nRows));
      cols.forEach(({ s }, i) => { const x = i * cw; const pre = s.short.startsWith('ก่อน') ? 'ก่อน' : s.short.startsWith('หลัง') ? 'หลัง' : ''; const aft = pre === 'หลัง'; cvRect(pg.ctx, x, y, cw, headH, aft ? pcl : pcs, CVS.LINE);
        const f = cvFont(700, cols.length > 5 && portrait ? 14.5 : 16.7); const rest = pre ? s.short.slice(pre.length) : s.short; pg.ctx.font = f; const w1 = pre ? pg.ctx.measureText(pre).width : 0; const w2 = pg.ctx.measureText(rest).width; let sx = x + cw / 2 - (w1 + w2) / 2;
        if (pre) { cvText(pg.ctx, pre, sx, y + 19, f, '#000'); pg.ctx.fillStyle = '#000'; pg.ctx.fillRect(sx, y + 29, w1, 1.4); sx += w1; } cvText(pg.ctx, rest, sx, y + 19, f, '#000'); cvText(pg.ctx, slotTime(s.key), x + cw / 2, y + 43, cvFont(600, 12.7), '#222', 'center'); });
      y += headH;
      for (let r = 0; r < nRows; r++) {
        const rh = rowH[r];
        cols.forEach(({ list }, i) => { const x = i * cw; const m = list[r]; cvRect(pg.ctx, x, y, cw, rh, '#fff', CVS.LINE);
          if (!m) return; const c = pg.ctx; const code = medNo(m); const star = m.as_needed ? '*' : ''; const dz = num(m.dose, 1) !== 1 ? `${doseLabel(m.dose)} ${unitOf(m)}` : '';
          const fC = cvFont(700, fzBase); c.font = fC; const wC = c.measureText(code).width, wS = star ? c.measureText(star).width : 0; const px = x + cw / 2 - wC / 2; const ci = info[i][r]; const codeH = Math.ceil(fzBase * 1.15); const blk = L.below && ci.n ? codeH + 3 + ci.n * lh : 0; const cy = L.below && ci.n ? y + (rh - blk) / 2 + codeH / 2 : y + rh / 2; // รหัสอยู่กลางช่อง · จำนวนเม็ดชิดขวาในกรอบสีเทา
          if (star) cvText(c, star, px - wS, cy, fC, CVS.PINK); cvText(c, code, px, cy, fC, '#000'); if (dz) cvDosePill(c, dz, px + wC + 6, cy, Math.min(20, Math.max(13, Math.round(fzBase * 0.6))), x + cw - 4 - (px + wC + 6));
          const total = ci.n * lh; let ny = L.below ? cy + codeH / 2 + 3 : cy - total / 2; // หมายเหตุตัวเล็กอยู่ใต้รหัส กึ่งกลางช่อง
          for (const { x: part, ls } of ci.lines) for (const line of ls) { if (L.below) cvText(c, line, x + cw / 2, ny + lh / 2, cvFont(400, L.fs), part.kind === 'warn' ? CVS.RED : CVS.GREY, 'center'); else cvText(c, line, x + 5, ny + lh / 2, cvFont(400, L.fs), part.kind === 'warn' ? CVS.RED : CVS.GREY); ny += lh; } });
        y += rh;
      }
      if (y > ph - FOOT - 2) layoutIssues.push('ตารางเฉพาะตัวเลขยาวเกินหน้า');
      layoutIssues.forEach((t) => CV_ISSUES.push(t));    }
  }
  // ---------- ท้ายกระดาษ ----------
  const foot = `สร้างไฟล์เมื่อ ${madeAt()} · ${PDF_APP_NOTE} · © 2026 สุขใจ (Sookjai)`;
  pages.forEach((pg, i) => { const c = pg.ctx; const pw = pg.pw, ph = pg.ph; c.fillStyle = '#999'; c.fillRect(0, ph - FOOT, pw, 1); const fl = cvFont(400, 10.7); measure.font = fl; const ls = cvWrap(measure, foot, pw - 110).slice(0, 2); ls.forEach((l, k) => cvText(c, l, 0, ph - FOOT + 12 + k * 14, fl, '#444')); cvText(c, `หน้า ${i + 1}/${pages.length}`, pw, ph - FOOT + 14, cvFont(700, 13.3), '#000', 'right'); });
  const issues = [...cvAudit(p, meds, CV_LOG), ...CV_ISSUES]; CV_LOG = null;
  return { canvases: pages.map((x) => x.c), pages: pages.length, portraits: pages.map((x) => x.portrait), issues };
}

// ================= สรุปก่อนพบหมอ (A4 แนวตั้ง · วาดตรงด้วย Canvas) =================
const RC = { SC: 3, W: 794, H: 1123, X: 40, TOP: 34, HEAD: 46, FOOT: 44, BOT: 22, GAP: 10 };
function cvRound(ctx, x, y, w, h, r, fill, stroke, lw = 1.2, dash = false) {
  r = Math.min(r, w / 2, h / 2); ctx.save(); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dash) ctx.setLineDash([5, 4]); ctx.stroke(); } ctx.restore();
}
const cvWrapPre = (ctx, text, w) => String(text ?? '').split(/\n/).flatMap((l) => (l.trim() ? cvWrap(ctx, l, w) : ['']));
const rcTint = (hex, a) => { const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16); const m = (v) => Math.round(255 - (255 - v) * a); return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`; };
/** ตรวจสรุปก่อนพบหมอที่วาดตรง: ฟอนต์/ข้อความล้นขอบ + ข้อมูลทุกอย่างที่ควรมีอยู่ในภาพ — คืนรายการปัญหา (ว่าง = ผ่าน) */
function cvAuditReport(R, log) {
  const issues = cvAuditBasic(log); const nz = (s) => String(s ?? '').replace(/\s+/g, ''); const all = nz(log.map((l) => l.t).join(''));
  const need = (s, label) => { if (nz(s) && !all.includes(nz(s))) issues.push(`ไม่พบ${label} "${String(s).slice(0, 24)}"`); };
  const { a, p, meds, prev } = R; const d = doctorById(a.doctor_id), h = hospitalById(a.hospital_id);
  need(p.name, 'ชื่อ'); need(`${thDate(a.appt_date)} ${hhmm(a.appt_time)} น.`, 'วันนัด'); need(a.department || '–', 'แผนก'); need(d?.name || '–', 'หมอ'); need(h?.name || '–', 'โรงพยาบาล'); need(a.visit_reason || '–', 'สาเหตุ');
  (p.drug_allergies || []).forEach((x) => need(x, 'แพ้ยา')); if (!(p.drug_allergies || []).length) need('ยังไม่ได้บันทึกว่าแพ้ยา', 'ข้อความแพ้ยา');
  reportBodyItems(p).forEach(([k, v]) => { need(k, 'หัวข้อ'); need(v, k); }); (p.chronic_diseases || []).forEach((x) => need(x, 'โรคประจำตัว'));
  if (prev) { need('ครั้งที่แล้วหมอแนะนำว่า', 'หัวข้อ'); need(String(prev.visit_summary).trim(), 'ข้อความหมอแนะนำ'); need(`หมอ: ${reportPrevDoc(prev)}`, 'ชื่อหมอของนัดครั้งก่อน'); }
  meds.forEach((m) => { const code = reportCode(m); need(code, 'รหัสยา'); need(m.name, 'ชื่อยา'); need(medGeneric(m), 'ชื่อทางการแพทย์'); need(`หมอ: ${reportMedDoc(m)}`, `ชื่อหมอที่จ่ายยา ${code}`); if (reportStatusLine(m)) need(reportStatusLine(m), `สถานะยา ${m.name}`); need(m.purpose || '', 'ใช้รักษา'); need(m.as_needed ? 'เมื่อมีอาการ' : `${doseLabel(m.dose)} ${unitOf(m)}`, `ทานครั้งละ ${code}`); need(medWhen(m), `เวลา ${code}`);
    if (tracksStock(m)) need(`${qtyText(stockLeft(m))} ${unitOf(m)}`, `ยาเหลือ ${code}`); if (normTxt(m.note || '')) need(String(m.note).trim().slice(0, 220), `บันทึก ${code}`);
    const ex = reportExtraNote(m, a.department); if (ex) need(ex, `บันทึกเพิ่มเติม ${code}`); else if (m.extra_note && nz(m.extra_note).length > 3 && all.includes(nz(m.extra_note))) issues.push(`แสดงบันทึกเพิ่มเติมของยาที่ไม่เกี่ยวกับแผนก ${code}`); });
  return issues;
}
async function renderReportCanvases(R) {
  CV_LOG = []; CV_ISSUES = []; await waitVisible();
  await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 16px Sarabun`, 'ก ภาษาไทย ABC 123 ๑'))); await document.fonts.ready;
  const { a, p, meds, allMeds, prev } = R; const d = doctorById(a.doctor_id), h = hospitalById(a.hospital_id); const age = ageOf(p.birth_year);
  const { SC, W, H, X, TOP, HEAD, FOOT, BOT, GAP } = RC; const CW = W - 2 * X; const pcs = rcTint(p.color, .16);
  const mctx = document.createElement('canvas').getContext('2d'); const F = (w, px) => cvFont(w, px); const saved = CV_LOG; CV_LOG = null; // วัดขนาด (ไม่บันทึกลงรายการตรวจ)
  const blocks = [];
  // 1) แพ้ยา
  { const al = p.drug_allergies || [];
    if (al.length) { mctx.font = F(700, 22); const lw = 28 + mctx.measureText('แพ้ยา').width + 16; mctx.font = F(700, 20); const ls = cvWrap(mctx, al.join(' · '), CW - 28 - lw); const hh = Math.max(34, ls.length * 28) + 18;
      blocks.push({ h: hh, gap: GAP, draw: (c, y) => { cvRound(c, X, y, CW, hh, 12, '#FFF0EE', '#F2B8B2', 1.5); const cy = y + 9 + 14; c.save(); c.fillStyle = '#B3261E'; c.beginPath(); c.moveTo(X + 26, cy - 11); c.lineTo(X + 38, cy + 10); c.lineTo(X + 14, cy + 10); c.closePath(); c.fill(); c.restore(); cvText(c, '!', X + 26, cy + 3, F(700, 14), '#fff', 'center');
        cvText(c, 'แพ้ยา', X + 28 + 14, cy, F(700, 22), '#B3261E'); ls.forEach((l, i) => cvText(c, l, X + 14 + lw, y + 9 + 14 + i * 28, F(700, 20), '#8C1D18')); } }); }
    else blocks.push({ h: 36, gap: GAP, draw: (c, y) => { cvRound(c, X, y, CW, 36, 12, '#F7F8FF', '#D5D9F5', 1.5, true); cvText(c, 'ยังไม่ได้บันทึกว่าแพ้ยา', X + 14, y + 18, F(400, 13), '#454B7A'); } }); }
  // 2) ชื่อ + ตารางข้อมูลนัด
  { const nameH = 34; const colW = [23, 27, 22, 28].map((v) => (v / 100) * CW); const colX = [0, colW[0], colW[0] + colW[1], colW[0] + colW[1] + colW[2]].map((v) => X + v);
    const rows = [[['วันที่ไป', `${thDate(a.appt_date)} ${hhmm(a.appt_time)} น.`], ['แผนก', a.department || '–']], [['หมอ', d?.name || '–'], ['รพ.', h?.name || '–']], [['สาเหตุ', a.visit_reason || '–', true]]];
    const items = reportBodyItems(p); for (let i = 0; i < items.length; i += 2) rows.push(items[i + 1] ? [items[i], items[i + 1]] : [[items[i][0], items[i][1], true]]);
    const dis = p.chronic_diseases || []; if (dis.length) rows.push([['โรคประจำตัว', dis.join(', '), true]]);
    const lay = rows.map((r) => { const cells = r.map((cl, ci) => { const span = !!cl[2]; const wv = span ? colW[1] + colW[2] + colW[3] : colW[ci * 2 + 1]; mctx.font = F(400, 13); return { k: cl[0], v: cl[1], span, wv, ls: cvWrapPre(mctx, cl[1], wv - 16), ci }; }); const hh = Math.max(...cells.map((x) => x.ls.length)) * 17.5 + 8; return { cells, hh }; });
    const th = lay.reduce((s, r) => s + r.hh, 0); const hh = nameH + th;
    blocks.push({ h: hh, gap: GAP, draw: (c, y) => { cvText(c, p.name, X, y + 17, F(700, 24), '#161A4D'); if (age) { c.font = F(700, 24); cvText(c, `อายุ ${age} ปี`, X + c.measureText(p.name).width + 10, y + 19, F(400, 13), '#454B7A'); }
      let yy = y + nameH; lay.forEach((r) => { r.cells.forEach((cell) => { const kx = colX[cell.ci * 2]; const vx = cell.span ? colX[1] : colX[cell.ci * 2 + 1]; const kw = colW[cell.ci * 2];
        cvRect(c, kx, yy, kw, r.hh, '#F4F5FC', '#C3C9EE', 1.2); cvText(c, cell.k, kx + 8, yy + 4 + 8.5, F(600, 13), '#5A6080'); cvRect(c, vx, yy, cell.wv, r.hh, '#fff', '#C3C9EE', 1.2); cell.ls.forEach((l, i) => cvText(c, l, vx + 8, yy + 4 + 8.5 + i * 17.5, F(400, 13), '#161A4D')); }); yy += r.hh; }); } }); }
  // 3) ครั้งที่แล้วหมอแนะนำว่า
  if (prev) { mctx.font = F(400, 16); const ls = cvWrapPre(mctx, String(prev.visit_summary).trim(), CW - 28); const pdoc = `หมอ: ${reportPrevDoc(prev)}`; mctx.font = F(400, 13); const dl = cvWrap(mctx, pdoc, CW - 28); const hh = 9 + 22 + dl.length * 18 + ls.length * 24 + 9;
    blocks.push({ h: hh, gap: GAP, draw: (c, y) => { cvRound(c, X, y, CW, hh, 12, '#FFF9E5', '#F2D58B', 1.5); cvText(c, 'ครั้งที่แล้วหมอแนะนำว่า', X + 14, y + 20, F(700, 16), '#161A4D'); c.font = F(700, 16); cvText(c, `(${thDate(prev.appt_date)})`, X + 14 + c.measureText('ครั้งที่แล้วหมอแนะนำว่า').width + 8, y + 21, F(400, 13), '#454B7A'); dl.forEach((l, i) => cvText(c, l, X + 14, y + 9 + 22 + 6 + i * 18, F(400, 13), '#454B7A')); const oy = dl.length * 18; ls.forEach((l, i) => cvText(c, l, X + 14, y + 9 + 22 + 12 + oy + i * 24, F(400, 16), '#161A4D')); } }); }
  // 4) ตารางยา
  { const sub = meds.length < allMeds.length && a.department ? ` (แผนก${a.department})` : '';
    blocks.push({ h: 34, gap: GAP, keep: true, draw: (c, y) => { cvRound(c, X, y, CW, 34, 10, pcs, null); cvText(c, 'ยาที่เกี่ยวกับแผนกนี้', X + 12, y + 17, F(700, 19), p.color); if (sub) { c.font = F(700, 19); cvText(c, sub, X + 12 + c.measureText('ยาที่เกี่ยวกับแผนกนี้').width, y + 18, F(400, 14), '#454B7A'); } } });
    if (!meds.length) blocks.push({ h: 38, gap: GAP, draw: (c, y) => { cvRound(c, X, y, CW, 38, 12, '#fff', '#D5D9F5', 1.5); cvText(c, 'ยังไม่ได้เลือกยา', X + 14, y + 19, F(400, 16), '#161A4D'); } });
    else {
      const pc = [7, 27, 20, 13, 33]; const cwI = pc.map((v) => (v / 100) * CW); const cxI = []; cwI.reduce((s, v) => (cxI.push(X + s), s + v), 0);
      const head = { h: 30, gap: 0, keep: true, isHead: true, draw: (c, y) => { ['รหัส', 'ชื่อยา', 'ทานครั้งละ · เวลา', 'ยาเหลือ', 'บันทึกของยา'].forEach((t, i) => { cvRect(c, cxI[i], y, cwI[i], 30, p.color, p.color, 1.2); cvText(c, t, i === 0 ? cxI[i] + cwI[i] / 2 : cxI[i] + 8, y + 15, F(700, 13.5), '#fff', i === 0 ? 'center' : 'left'); }); } };
      blocks.push(head);
      meds.forEach((m) => { const left = tracksStock(m) ? `${qtyText(stockLeft(m))} ${unitOf(m)}` : '–'; const note = normTxt(m.note || '') ? String(m.note).trim().slice(0, 220) : ''; const extra = reportExtraNote(m, a.department);
        mctx.font = F(700, 16.5); const nm = cvWrap(mctx, m.name, cwI[1] - 16); mctx.font = F(400, 13); const pu = [...(medGeneric(m) ? cvWrap(mctx, medGeneric(m), cwI[1] - 16) : []), ...(m.purpose ? cvWrap(mctx, m.purpose, cwI[1] - 16) : []), ...cvWrap(mctx, `หมอ: ${reportMedDoc(m)}`, cwI[1] - 16), ...(reportStatusLine(m) ? cvWrap(mctx, reportStatusLine(m), cwI[1] - 16) : [])]; // + ชื่อหมอที่จ่ายยา (ไม่มี = -) + สถานะงด/หยุด (ถ้ามี)
        mctx.font = F(400, 14.5); const ds = cvWrap(mctx, m.as_needed ? 'เมื่อมีอาการ' : `${doseLabel(m.dose)} ${unitOf(m)}`, cwI[2] - 16); mctx.font = F(400, 13); const wh = cvWrap(mctx, medWhen(m), cwI[2] - 16);
        mctx.font = F(700, 14.5); const lf = cvWrap(mctx, left, cwI[3] - 16); mctx.font = F(400, 13.5); const nl = note ? cvWrapPre(mctx, note, cwI[4] - 16) : []; mctx.font = F(700, 13.5); const xl = extra ? cvWrapPre(mctx, extra, cwI[4] - 16) : [];
        const hh = Math.max(40, 12 + Math.max(nm.length * 22 + pu.length * 17, ds.length * 20 + wh.length * 17, lf.length * 20, (nl.length + xl.length) * 18.5 + (note && extra ? 2 : 0), 24));
        blocks.push({ h: hh, gap: 0, rowOf: head, draw: (c, y) => {
          for (let i = 0; i < 5; i++) cvRect(c, cxI[i], y, cwI[i], hh, i === 4 ? '#FFFCEF' : '#fff', '#C3C9EE', 1.2);
          const code = (m.as_needed ? '*' : '') + reportCode(m); c.font = F(700, 12); const pw = c.measureText(code).width + 14; cvRound(c, cxI[0] + cwI[0] / 2 - pw / 2, y + 7, pw, 20, 6, p.color, null); cvText(c, code, cxI[0] + cwI[0] / 2, y + 17, F(700, 12), '#fff', 'center');
          let yy = y + 6 + 11; nm.forEach((l) => { cvText(c, l, cxI[1] + 8, yy, F(700, 16.5), '#161A4D'); yy += 22; }); pu.forEach((l) => { cvText(c, l, cxI[1] + 8, yy - 3, F(400, 13), '#454B7A'); yy += 17; });
          yy = y + 6 + 10; ds.forEach((l) => { cvText(c, l, cxI[2] + 8, yy, F(400, 14.5), '#161A4D'); yy += 20; }); wh.forEach((l) => { cvText(c, l, cxI[2] + 8, yy - 2, F(400, 13), '#454B7A'); yy += 17; });
          yy = y + 6 + 10; lf.forEach((l) => { cvText(c, l, cxI[3] + 8, yy, F(700, 14.5), '#2C6E3F'); yy += 20; });
          yy = y + 6 + 9; nl.forEach((l) => { cvText(c, l, cxI[4] + 8, yy, F(400, 13.5), '#161A4D'); yy += 18.5; }); if (note && extra) yy += 2; xl.forEach((l) => { cvText(c, l, cxI[4] + 8, yy, F(700, 13.5), '#2D5F12'); yy += 18.5; }); } }); });
    } }
  CV_LOG = saved;
  // จัดลงหน้า
  const pages = []; const mk = () => { const cv = document.createElement('canvas'); cv.width = W * SC; cv.height = H * SC; cv.__sc = SC; const c = cv.getContext('2d'); c.scale(SC, SC); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); const pg = { cv, c }; pages.push(pg); return pg; };
  const y0 = TOP + HEAD + 8; const limit = H - BOT - FOOT - 8 + 0; let pg = mk(); let y = y0; let headDrawn = false; const placed = [];
  const put = (b, yy) => { b.draw(pg.c, yy); };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]; let need = b.h + b.gap;
    if (b.keep) { let j = i + 1; while (j < blocks.length && blocks[j - 1].keep) { need += blocks[j].h + blocks[j].gap; j++; if (!blocks[j - 1].keep) break; } }
    if (b.rowOf && !headDrawn) { /* แถวแรกของหน้า */ }
    if (y > y0 && y + need > limit) { pg = mk(); y = y0; headDrawn = false; }
    if (b.rowOf && !headDrawn) { put(b.rowOf, y); y += b.rowOf.h; headDrawn = true; } // หัวตารางซ้ำเมื่อขึ้นหน้าใหม่
    if (b.isHead) headDrawn = true;
    put(b, y); y += b.h + b.gap;
  }
  // หัวกระดาษ + ท้ายกระดาษ ทุกหน้า
  const foot = `${PDF_APP_NOTE} · สร้างไฟล์เมื่อ ${madeAt()} · © 2026 สุขใจ (Sookjai)`;
  pages.forEach((pp, i) => { const c = pp.c;
    cvText(c, 'สรุปก่อนพบหมอ', X, TOP + 16, F(700, 19), '#161A4D');
    cvText(c, `${p.name} · นัด ${thDate(a.appt_date)} ${hhmm(a.appt_time)} น.${a.department ? ` · ${a.department}` : ''}`, W - X, TOP + 18, F(400, 14), '#454B7A', 'right'); cvRect(c, X, TOP + HEAD - 6, CW, 3, p.color);
    cvRect(c, X, H - BOT - FOOT + 8, CW, 1.5, '#D5D9F5'); mctx.font = F(400, 10.5); cvWrap(mctx, foot, CW - 90).slice(0, 2).forEach((l, k) => cvText(c, l, X, H - BOT - FOOT + 8 + 12 + k * 14, F(400, 10.5), '#5A6080')); cvText(c, `หน้า ${i + 1}/${pages.length}`, W - X, H - BOT - FOOT + 8 + 12, F(700, 10.5), '#161A4D', 'right'); });
  const issues = [...cvAuditReport(R, CV_LOG), ...CV_ISSUES]; CV_LOG = null;
  if (!pages.length) issues.push('ไม่มีหน้าเลย');
  return { canvases: pages.map((x) => x.cv), pages: pages.length, issues };
}