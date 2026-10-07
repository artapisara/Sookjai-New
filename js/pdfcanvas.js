/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — วาดหน้า PDF ด้วยโค้ดโดยตรง (Canvas 2D) แทนการให้ html2canvas เลียนแบบหน้าเว็บ
 * ข้อความทุกตัวถูกจัดและวาดด้วยตัวจัดภาษาไทยของเบราว์เซอร์เอง (ฟอนต์ Sarabun ที่ฝังในแอพ) จึงไม่เกิดอาการช่องไฟกระจาย/ตัวเล็กเพี้ยน
 * ตอนนี้ใช้กับ "ตารางกินยา 1 วัน" (ตารางรหัสยา + รายการยา) — ข้อมูลและหน้าตาเหมือน mpDoc() ใน pages.js
 */
'use strict';

const CVS = { S: 2, W: 1047, H: 718, FOOT: 40, INK: '#111', LINE: '#333', RED: '#C62828', GREY: '#555', PINK: '#B0407E' };
const cvFont = (w, px) => `${w} ${px}px Sarabun, 'TH Sarabun New', 'Leelawadee UI', sans-serif`;

/** ตัดบรรทัดตามคำภาษาไทย (Intl.Segmenter) ให้ไม่กว้างเกิน maxW — คำยาวเกินช่องจะตัดตามตัวอักษร */
function cvWrap(ctx, text, maxW) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim(); if (!t) return [];
  const toks = (typeof Intl !== 'undefined' && Intl.Segmenter) ? [...new Intl.Segmenter('th', { granularity: 'word' }).segment(t)].map((s) => s.segment) : t.split(/(?<= )/);
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
function cvText(ctx, str, x, y, font, color, align = 'left') { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y); }
function cvSnow(ctx, cx, cy, r = 6) { ctx.save(); ctx.strokeStyle = '#2A7FC9'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; for (let k = 0; k < 3; k++) { const a = (Math.PI / 3) * k; ctx.beginPath(); ctx.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); } ctx.restore(); }
function cvDot(ctx, x, y, r = 3.5, c = CVS.RED) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function cvRect(ctx, x, y, w, h, fill, stroke, lw = 1) { if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h); } }

/** ชิ้นส่วนที่ "วัดขนาดก่อน แล้ววาดทีหลัง": คืน { h, draw(ctx, x, y, w) } */
function cvBlock(h, draw) { return { h, draw }; }

/** เซลล์ตารางรหัสยา (1 ยา) */
function cvGridCell(ctx, m, w) {
  const parts = remarkParts(m); const warn = parts.filter((x) => x.kind === 'warn').map((x) => x.t); const hint = parts.filter((x) => x.kind === 'hint').map((x) => x.t);
  const pad = 8, inner = w - pad * 2; const fridge = hasFridge(parts); const dz = num(m.dose, 1) !== 1 ? `${doseLabel(m.dose)} ${unitOf(m)}` : '';
  const fCode = cvFont(700, 24), fDose = cvFont(700, 14), fStar = cvFont(700, 24), fName = cvFont(600, 16.7), fAs = cvFont(600, 12.7), fWarn = cvFont(600, 12.7), fHint = cvFont(400, 12);
  ctx.font = fCode; const code = medNo(m); const wCode = ctx.measureText(code).width;
  ctx.font = fStar; const wStar = m.as_needed ? ctx.measureText('*').width + 4 : 0;
  ctx.font = fDose; const wDose = dz ? ctx.measureText(dz).width + 6 : 0; const wSnow = fridge ? 18 : 0;
  const mainW = wStar + wCode + wDose + wSnow;
  ctx.font = fName; const nameLines = cvWrap(ctx, printName(medShort(m)), inner);
  ctx.font = fWarn; const warnLines = warn.map((t) => cvWrap(ctx, t, inner - 12));
  ctx.font = fHint; const hintLines = hint.map((t) => cvWrap(ctx, t, inner));
  const lhName = 21, lhSm = 16;
  const h = pad + 30 + 3 + nameLines.length * lhName + (m.as_needed ? lhSm + 1 : 0) + warnLines.reduce((a, l) => a + l.length * lhSm + 2, 0) + hintLines.reduce((a, l) => a + l.length * lhSm + 1, 0) + pad;
  const bg = m.as_needed ? '#FDE7F1' : warn.length ? '#FFF3B0' : '#fff';
  return { h, bg, draw(x, y) {
    const cx = x + w / 2; let cy = y + pad + 15; let px = cx - mainW / 2;
    if (m.as_needed) { cvText(ctx, '*', px, cy, fStar, CVS.PINK); px += wStar; }
    cvText(ctx, code, px, cy, fCode, '#000'); px += wCode;
    if (dz) { cvText(ctx, dz, px + 6, cy + 2, fDose, CVS.RED); px += wDose; }
    if (fridge) cvSnow(ctx, px + 10, cy, 6);
    let ty = y + pad + 30 + 3; // ขอบบนของบรรทัดถัดไป (จุดกลางบรรทัด = ty + ความสูงบรรทัด/2)
    for (const l of nameLines) { cvText(ctx, l, cx, ty + lhName / 2, fName, CVS.INK, 'center'); ty += lhName; }
    if (m.as_needed) { cvText(ctx, 'เมื่อมีอาการ', cx, ty + lhSm / 2, fAs, CVS.PINK, 'center'); ty += lhSm + 1; }
    for (const ls of warnLines) { ls.forEach((l, i) => { ctx.font = fWarn; const tw = ctx.measureText(l).width; const off = i === 0 ? 10 : 0; const sx = cx - (tw + off) / 2; if (i === 0) cvDot(ctx, sx + 3, ty + lhSm / 2, 3); cvText(ctx, l, sx + off, ty + lhSm / 2, fWarn, CVS.RED); ty += lhSm; }); ty += 2; }
    for (const ls of hintLines) { for (const l of ls) { cvText(ctx, l, cx, ty + lhSm / 2, fHint, CVS.GREY, 'center'); ty += lhSm; } ty += 1; }
  } };
}

/** ส่วนหัวของหน้า: ชื่อเรื่อง + กล่องข้อมูล 2 ช่อง + แถบสี — คืนตำแหน่ง y ที่เริ่มตาราง */
function cvHead(ctx, p, meds, kind) {
  const W = CVS.W; const fTitle = cvFont(700, 26.7), f14 = cvFont(400, 14), f14b = cvFont(700, 14), f12 = cvFont(600, 12);
  const title = kind === 'grid' ? `ตารางการกินยาใน 1 วัน (${p.name})` : `รายการยา (${p.name})`;
  const odd = meds.filter((m) => num(m.dose, 1) !== 1).map(medNo); const oral = meds.filter(isOralMed).length;
  const upd = `UPD: ${updDate(meds)}`;
  ctx.font = f14; const wUpd = ctx.measureText(upd).width + 24;
  let box1W, box1Draw; const boxH = 48;
  if (kind === 'grid') {
    const l1a = 'ทานครั้งละ 1 เม็ด ', l1b = odd.length ? `(ยกเว้นรหัส ${odd.join(' และ ')})` : '';
    ctx.font = f14; const wa = ctx.measureText(l1a).width; ctx.font = f14b; const wb = l1b ? ctx.measureText(l1b).width : 0;
    const leg = ['สัญลักษณ์: ', 'เหลือง = ข้อควรระวัง', ' ', 'ชมพู * = กินเฉพาะเมื่อมีอาการ']; ctx.font = f12; const wl = leg.reduce((a, s) => a + ctx.measureText(s).width, 0) + 2 * 14;
    box1W = Math.max(wa + wb, wl) + 24;
    box1Draw = (x, y) => { cvText(ctx, l1a, x + 12, y + 14, f14, CVS.INK); cvText(ctx, l1b, x + 12 + wa, y + 14, f14b, CVS.RED);
      let lx = x + 12; const ly = y + 34; cvText(ctx, leg[0], lx, ly, f12, '#333'); ctx.font = f12; lx += ctx.measureText(leg[0]).width;
      cvRect(ctx, lx, ly - 6, 12, 12, '#FFF3B0', '#777', .8); lx += 16; cvText(ctx, leg[1], lx, ly, f12, '#333'); ctx.font = f12; lx += ctx.measureText(leg[1]).width + 8;
      cvRect(ctx, lx, ly - 6, 12, 12, '#FDE7F1', '#777', .8); lx += 16; cvText(ctx, leg[3], lx, ly, f12, '#333'); };
  } else {
    const t1 = `${p.relation || ''}${ageOf(p.birth_year) ? ` · อายุ ${ageOf(p.birth_year)} ปี` : ''} · ยาทาน ${oral} ตัว · ยาอื่นๆ ${meds.length - oral} ตัว`.replace(/^ · /, ''); ctx.font = f14;
    box1W = ctx.measureText(t1).width + 24; box1Draw = (x, y) => cvText(ctx, t1, x + 12, y + boxH / 2, f14, CVS.INK);
  }
  const bx2 = W - wUpd, bx1 = bx2 - box1W; const by = 4;
  ctx.font = fTitle; const tLines = cvWrap(ctx, title, bx1 - 20); const tl = tLines.slice(0, 2);
  const th = tl.length * 34; const blockH = Math.max(boxH, th);
  cvRect(ctx, bx1, by + (blockH - boxH) / 2, box1W, boxH, '#fff', '#666'); cvRect(ctx, bx2, by + (blockH - boxH) / 2, wUpd, boxH, '#fff', '#666'); box1Draw(bx1, by + (blockH - boxH) / 2); cvText(ctx, upd, bx2 + 12, by + blockH / 2, f14, CVS.INK);
  tl.forEach((l, i) => cvText(ctx, l, 0, by + (blockH - th) / 2 + 17 + i * 34, fTitle, '#000'));
  const barY = by + blockH + 8; cvRect(ctx, 0, barY, W, 5, p.color); return barY + 5 + 10;
}

/** วาดเป็นภาพรายหน้า — คืน { canvases, pages } */
async function renderMedsCanvases(p, meds) {
  await waitVisible();
  await Promise.all(['400', '600', '700'].map((w) => document.fonts.load(`${w} 16px Sarabun`, 'ก ภาษาไทย ABC 123 ๑'))); await document.fonts.ready;
  const { S, W, H, FOOT } = CVS; const pages = []; const mk = () => { const c = document.createElement('canvas'); c.width = W * S; c.height = H * S; const ctx = c.getContext('2d'); ctx.scale(S, S); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); const pg = { c, ctx }; pages.push(pg); return pg; };
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
    const f15 = cvFont(400, 15.3), fNm = cvFont(600, 16.7), fCode = cvFont(700, 24), fNote = cvFont(600, 15.3), fNoteG = cvFont(400, 15.3);
    for (const m of meds) {
      const parts = remarkParts(m); const lay = (ctx0) => {
        const out = { nm: (ctx0.font = fNm, cvWrap(ctx0, printName(m.name), cwOf(1) - 16)), pu: (ctx0.font = f15, cvWrap(ctx0, printName(m.purpose || ''), cwOf(2) - 16)), dz: (ctx0.font = f15, cvWrap(ctx0, `${doseLabel(m.dose)} ${unitOf(m)}`, cwOf(3) - 16)), wh: (ctx0.font = f15, cvWrap(ctx0, medWhen(m), cwOf(4) - 16)) };
        out.notes = parts.map((x) => { ctx0.font = x.kind === 'warn' ? fNote : fNoteG; return { x, ls: cvWrap(ctx0, x.t, cwOf(5) - 16 - (x.kind === 'warn' || /ตู้เย็น/.test(x.t) ? 14 : 0)) }; });
        const lh = 22; const nh = out.notes.reduce((a, n) => a + n.ls.length * lh + 2, 0);
        out.h = Math.max(46, 12 + Math.max(out.nm.length * lh, out.pu.length * lh, out.dz.length * lh, out.wh.length * lh, nh, 30)); return out; };
      const L = lay(measure);
      if (y + L.h > limitY && y > 90) { pg = mk(); y = cvHead(pg.ctx, p, meds, 'list'); drawHeader(); }
      const c = pg.ctx; for (let i = 0; i < 6; i++) cvRect(c, xs[i], y, cwOf(i), L.h, '#fff', CVS.LINE);
      cvText(c, medNo(m), xs[0] + cwOf(0) / 2, y + 12 + 15, fCode, '#000', 'center');
      const col = (lines, i, font, color, bold) => lines.forEach((l, k) => cvText(c, l, xs[i] + 8, y + 6 + 11 + k * 22, font, color));
      col(L.nm, 1, fNm, '#000'); col(L.pu, 2, f15, CVS.INK); col(L.dz, 3, f15, CVS.INK); col(L.wh, 4, f15, CVS.INK);
      let ny = y + 6 + 11;
      for (const { x, ls } of L.notes) { const warnK = x.kind === 'warn'; const snow = /ตู้เย็น/.test(x.t); ls.forEach((l, k) => { if (k === 0 && warnK) cvDot(c, xs[5] + 12, ny, 3.5); if (k === 0 && snow) cvSnow(c, xs[5] + 15, ny, 5.5); cvText(c, l, xs[5] + 8 + (warnK || snow ? 14 : 0), ny, warnK ? fNote : fNoteG, warnK ? CVS.RED : CVS.GREY); ny += 22; }); ny += 2; }
      y += L.h;
    }
  }
  // ---------- ท้ายกระดาษ ----------
  const foot = `สร้างไฟล์เมื่อ ${madeAt()} · ${PDF_APP_NOTE} · © 2026 สุขใจ (Sookjai)`;
  pages.forEach((pg, i) => { const c = pg.ctx; c.fillStyle = '#999'; c.fillRect(0, H - FOOT, W, 1); const fl = cvFont(400, 10.7); measure.font = fl; const ls = cvWrap(measure, foot, W - 110).slice(0, 2); ls.forEach((l, k) => cvText(c, l, 0, H - FOOT + 12 + k * 14, fl, '#444')); cvText(c, `หน้า ${i + 1}/${pages.length}`, W, H - FOOT + 14, cvFont(700, 13.3), '#000', 'right'); });
  return { canvases: pages.map((x) => x.c), pages: pages.length };
}
