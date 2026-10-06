/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — รายงานก่อนพบแพทย์ (PDF A4 แนวตั้ง) · Premium
 * ใส่เฉพาะที่ใช้จริงในห้องตรวจ (แอพเป็นเครื่องช่วยจำ ไม่เก็บ/สรุปข้อมูลสุขภาพเกินจำเป็น):
 *   1) แพ้ยา  2) ใครไปหาหมอ + นัดครั้งนี้  3) ผลการพบแพทย์ครั้งก่อน (ที่ผู้ใช้จดไว้ในนัดครั้งก่อน ข้อ 10)  4) ยาที่เกี่ยวกับแผนกนี้ + บันทึก (หมายเหตุ) ของยาแต่ละตัว  5) เส้นให้เขียนสิ่งที่อยากถามหมอ
 * สั่งทำ PDF ได้เมื่อใกล้วันนัด (ภายใน REPORT_WINDOW_DAYS วันก่อนนัด) · สร้างจากข้อมูลปัจจุบันทุกครั้ง · ตรวจก่อนบันทึกไฟล์ (สร้างซ้ำ 2 รอบต้องเหมือนกัน + ข้อมูลครบ ไม่ล้นหน้า)
 */
'use strict';

const REPORT_WINDOW_DAYS = 7;
const RPT = { W: 794, H: 1123, padX: 40, padTop: 34, headH: 46, footH: 44, padBottom: 22, gap: 10 };

const reportState = (a) => { const n = daysUntil(a.appt_date); return { n, ok: n >= 0 && n <= REPORT_WINDOW_DAYS, opens: dk(addDays(parseDk(a.appt_date), -REPORT_WINDOW_DAYS)) }; };
/** ปุ่มในหน้ารายละเอียดนัด (แสดงเฉพาะนัดที่ยังไม่ถึง/วันนี้) */
function reportButtonHtml(a) {
  const st = reportState(a); if (st.n < 0) return '';
  // กรอบสรุป (สำคัญกว่า) อยู่ก่อน แล้วค่อยปุ่มโหลดไฟล์
  return `<div class="report-box">
    ${canUse('report') ? `<details class="rp-prev" data-appt="${a.id}"><summary><span class="mi rp-ic" style="--ic:url(assets/icons/report-notes.png)"></span>สรุปก่อนพบแพทย์</summary><div class="rp-prev-body small muted">กำลังเตรียมสรุป…</div></details>` : ''}
    <button type="button" class="btn block ghost rp-dl ${st.ok ? '' : 'rp-dl-off'}" data-act="appt-report" data-id="${a.id}">📄 โหลดไฟล์ PDF ⭐</button>
    ${st.ok ? '' : `<p class="small muted center" style="margin:4px 0 0">โหลดไฟล์ได้ตั้งแต่วันที่ ${thDate(st.opens)} (ภายใน ${REPORT_WINDOW_DAYS} วันก่อนวันนัด)</p>`}</div>`;
}
// ---------- เลือกยาที่เกี่ยวกับแผนก ----------
const reportDeptNorm = (s) => norm(String(s || '').replace(/^แผนก/, ''));
/** ยานี้เกี่ยวกับแผนกของนัดไหม — เทียบกับ "แผนกที่จ่ายยา" ในฟอร์มยา (ตรงทั้งคำหรือเป็นส่วนหนึ่งของกัน เช่น "อายุรกรรม" กับ "อายุรกรรมโรคหัวใจ") */
const reportMedMatches = (m, dept) => { const x = reportDeptNorm(m.prescribed_dept), y = reportDeptNorm(dept); return !!x && !!y && (x.includes(y) || y.includes(x)); };
/** ยาที่ติ๊กไว้ให้ตามแผนกของนัด (ถ้าไม่มียาไหนระบุแผนก = ทุกตัว) */
function reportDefaultMedIds(a) {
  const meds = medsOf(a.profile_id); const matched = a.department ? meds.filter((m) => reportMedMatches(m, a.department)) : [];
  return (matched.length ? matched : meds).map((m) => m.id);
}
/** ผลการพบแพทย์ครั้งก่อน: นัดที่ผ่านมาของคนนี้ที่จดผลไว้ — เลือกแผนกเดียวกันก่อน ถ้าไม่มีใช้ครั้งล่าสุดที่จดไว้ */
function reportPrevVisit(a) {
  const past = S.appointments.filter((x) => x.profile_id === a.profile_id && x.id !== a.id && x.appt_date < a.appt_date && normTxt(x.visit_summary || '')).sort((x, y) => y.appt_date.localeCompare(x.appt_date));
  return past.find((x) => reportDeptNorm(x.department) && reportDeptNorm(x.department) === reportDeptNorm(a.department)) || past[0] || null;
}

/** รวมข้อมูลที่จะใส่ในรายงาน (ดึงจากข้อมูลปัจจุบันทุกครั้ง) */
function reportData(a, opt = {}) {
  const p = profileById(a.profile_id); const allMeds = medsOf(p.id); const meds = opt.medIds ? allMeds.filter((m) => opt.medIds.includes(m.id)) : allMeds;
  return { a, p, meds, allMeds, prev: reportPrevVisit(a) };
}

/** ข้อมูลร่างกายของคนไข้ (น้ำหนัก ส่วนสูง รอบเอว กรุ๊ปเลือด โรคประจำตัว) — ใส่เฉพาะรายการที่มีข้อมูล · ค่าที่ใช้ตรวจใน auditReport ด้วย */
function reportBodyItems(p) {
  return [
    ['น้ำหนัก', p.weight_kg ? `${num(p.weight_kg)} กก.` : ''],
    ['ส่วนสูง', p.height_cm ? `${num(p.height_cm)} ซม.` : ''],
    ['รอบเอว', p.waist_cm ? `${num(p.waist_cm)} ซม.` : ''],
    ['กรุ๊ปเลือด', p.blood_type || ''],
  ].filter((x) => x[1]);
}
function reportBodyRows(p, cell) {
  const e = esc; const it = reportBodyItems(p); let html = '';
  for (let i = 0; i < it.length; i += 2) {
    html += it[i + 1] ? `<tr>${cell(it[i][0], e(it[i][1]))}${cell(it[i + 1][0], e(it[i + 1][1]))}</tr>` : `<tr>${cell(it[i][0], e(it[i][1])).replace('<td>', '<td colspan="3">')}</tr>`;
  }
  const dis = p.chronic_diseases || [];
  if (dis.length) html += `<tr>${cell('โรคประจำตัว', `<span class="rp-wide">${dis.map(e).join(', ')}</span>`).replace('<td>', '<td colspan="3">')}</tr>`;
  return html;
}

/** สร้างรายการ "บล็อก" ของเนื้อหา — ใช้ชุดเดียวกันทั้ง "สรุป" ที่เปิดดูในแอพและไฟล์ PDF · หัวข้อ/แถวตารางที่ไม่มีข้อมูลจะไม่แสดง
 *  title = หัวข้อ (ต้องอยู่หน้าเดียวกับบล็อกถัดไป) · hdrKey/rowKey = หัวตาราง/แถวของตารางเดียวกัน (ขึ้นหน้าใหม่แล้วใส่หัวตารางซ้ำ) · tight = ไม่เว้นช่องว่างใต้บล็อก (แถวต่อกันเป็นตาราง) */
function reportBlocks(R) {
  const { a, p, meds, allMeds, prev } = R; const B = []; const e = esc;
  const T = (t) => B.push({ html: `<h2 class="rp-h">${t}</h2>`, title: true });
  const C = (html, cls = '') => B.push({ html: `<div class="rp-card ${cls}">${html}</div>`, cls });
  const d = doctorById(a.doctor_id), h = hospitalById(a.hospital_id); const age = ageOf(p.birth_year);
  // 1) แพ้ยา — บนสุด
  if (p.drug_allergies?.length) C(`<div class="rp-allergy"><b>⚠️ แพ้ยา</b><span>${p.drug_allergies.map(e).join(' · ')}</span></div>`, 'rp-red');
  else C('<span class="s">ยังไม่ได้บันทึกว่าแพ้ยา</span>', 'rp-note');
  // 2) ใครไปหาหมอ — ตารางข้อมูลนัด (ตัวเล็ก)
  // (ไม่มีหัวข้อ "ใครไปหาหมอ" — แสดงชื่อและตารางข้อมูลนัดต่อจากกรอบแพ้ยาเลย)
  const cell = (k, v) => `<th>${k}</th><td>${v}</td>`;
  B.push({ html: `<div class="rp-name">${e(p.name)}${age ? ` <span class="s">อายุ ${age} ปี</span>` : ''}</div>
    <table class="rp-t rp-info-t"><colgroup><col style="width:15%"><col style="width:38%"><col style="width:15%"><col style="width:32%"></colgroup>
      <tr>${cell('วันที่ไป', `${thDate(a.appt_date)} ${hhmm(a.appt_time)} น.`)}${cell('แผนก', e(a.department || '–'))}</tr>
      <tr>${cell('หมอ', e(d?.name || '–'))}${cell('โรงพยาบาล', e(h?.name || '–'))}</tr>
      <tr>${cell('ไปเพราะ', `<span class="rp-wide">${e(a.visit_reason || '–')}</span>`).replace('<td>', '<td colspan="3">')}</tr>${reportBodyRows(p, cell)}</table>`, info: true });
  if (a.note) C(`<b class="rp-nt">📝 หมายเหตุ</b><div class="rp-notetext">${e(a.note)}</div>`, 'rp-notebox'); // หมายเหตุแยกกรอบ
  // 3) ผลการพบแพทย์ครั้งก่อน
  if (prev) {
    T('🏥 ครั้งก่อนหมอบอกว่า');
    B.push({ html: `<table class="rp-t rp-prev-t"><colgroup><col style="width:22%"><col style="width:78%"></colgroup><tr><th>${thDate(prev.appt_date)}${prev.department ? `<br><span class="s">${e(prev.department)}</span>` : ''}</th><td class="rp-say">${e(String(prev.visit_summary).trim())}</td></tr></table>`, prevVisit: true });
  }
  // 4) ตารางยาที่เกี่ยวกับแผนกนี้
  T(`💊 ยาที่เกี่ยวกับแผนกนี้${meds.length < allMeds.length && a.department ? ` <span class="rp-sub">(แผนก${e(a.department)})</span>` : ''}`);
  if (!meds.length) C('ยังไม่ได้เลือกยา');
  else {
    const cols = '<colgroup><col style="width:7%"><col style="width:27%"><col style="width:20%"><col style="width:13%"><col style="width:33%"></colgroup>';
    B.push({ html: `<table class="rp-t rp-head-t">${cols}<tr><th>รหัส</th><th>ชื่อยา</th><th>ทานครั้งละ · เวลา</th><th>ยาเหลือ</th><th>บันทึกของยา</th></tr></table>`, title: true, hdrKey: 'meds', tight: true });
    meds.forEach((m) => {
      const left = tracksStock(m) ? `${e(qtyText(stockLeft(m)))} ${e(unitOf(m))}` : '–';
      B.push({ html: `<table class="rp-t rp-med">${cols}<tr><td class="rp-no"><b>${m.as_needed ? '*' : ''}${e(medNo(m))}</b></td>
        <td><b class="rp-mn">${e(m.name)}</b>${m.purpose ? `<div class="s">${e(m.purpose)}</div>` : ''}</td>
        <td data-label="ทานครั้งละ">${m.as_needed ? 'เมื่อมีอาการ' : `${doseLabel(m.dose)} ${e(unitOf(m))}`}<div class="s">${e(medWhen(m))}</div></td>
        <td class="rp-left" data-label="ยาเหลือ">${left}</td>
        <td class="rp-mnote" data-label="บันทึก">${normTxt(m.note || '') ? e(String(m.note).trim().slice(0, 220)) : '<span class="s">–</span>'}</td></tr></table>`, med: true, rowKey: 'meds', tight: true });
    });
  }
  // 5) สิ่งที่อยากถามหมอ
  C('<b>✍️ สิ่งที่อยากถามหมอ</b><div class="rp-lines"><i></i><i></i><i></i></div>', 'rp-ask');
  return B;
}
const RPT_CSS = `.rp-wrap{position:fixed;left:-12000px;top:0;background:#fff;font-family:Sarabun,Prompt,sans-serif;color:#161A4D}
.rp-page{box-sizing:border-box;width:${RPT.W}px;height:${RPT.H}px;padding:${RPT.padTop}px ${RPT.padX}px ${RPT.padBottom}px;background:#fff;position:relative;overflow:hidden;--pc:#4D55F5;--pcs:#EEF0FF}
.rp-top{height:${RPT.headH}px;display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:3px solid var(--pc);padding-bottom:6px;margin-bottom:8px}
.rp-top b{font:700 19px Prompt,Sarabun,sans-serif}.rp-top span{font-size:14px;color:#454B7A;text-align:right}
.rp-body{position:relative}.rp-b{margin-bottom:${RPT.gap}px}.rp-b.tight{margin-bottom:0}
.rp-h{margin:4px 0 0;font:700 19px Prompt,Sarabun,sans-serif;color:var(--pc);background:var(--pcs);padding:6px 12px;border-radius:10px}.rp-sub{font:500 14px Sarabun,sans-serif;color:#454B7A}
.rp-card{border:1.5px solid #D5D9F5;border-radius:12px;padding:9px 14px;font-size:16px;line-height:1.5;background:#fff}
.rp-card .s,.rp-note .s,.rp-t .s{font-size:13px;color:#454B7A}
.rp-red{background:#FFF0EE;border-color:#F2B8B2;color:#8C1D18}.rp-note{background:#F7F8FF;border-style:dashed}
.rp-allergy{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.rp-allergy b{font:800 22px Prompt,Sarabun,sans-serif;color:#B3261E}.rp-allergy span{font:700 20px Prompt,Sarabun,sans-serif}
.rp-name{font:800 24px Prompt,Sarabun,sans-serif;margin:2px 0 4px}
.rp-notebox{background:#FFF9E5;border-color:#F2D58B}.rp-nt{font-size:16px}.rp-notetext{font-size:16px;white-space:pre-line;overflow-wrap:anywhere;margin-top:2px}
.rp-t{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14.5px;line-height:1.4}
.rp-t th,.rp-t td{border:1.2px solid #C3C9EE;padding:6px 8px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
.rp-t th{background:var(--pcs);font-weight:700}
.rp-info-t th,.rp-info-t td{font-size:13px;padding:3px 8px}.rp-info-t th{background:#F4F5FC;color:#5A6080;font-weight:600}
.rp-prev-t td.rp-say{font-size:16.5px;line-height:1.55;white-space:pre-line}.rp-prev-t th{font-size:14px}
.rp-head-t th{background:var(--pc);color:#fff;border-color:var(--pc);font-size:13.5px;padding:5px 8px}
.rp-med{margin-top:-1.2px}.rp-med td{background:#fff}.rp-no{text-align:center}.rp-no b{display:inline-block;background:var(--pc);color:#fff;border-radius:6px;padding:1px 6px;font:700 12px Prompt,Sarabun,sans-serif}
.rp-mn{font:700 16.5px Prompt,Sarabun,sans-serif}.rp-left{font-weight:700;color:#2C6E3F}.rp-mnote{background:#FFFCEF!important;white-space:pre-line;font-size:13.5px}
.rp-lines i{display:block;height:30px;border-bottom:1.2px solid #9BA2CC}.rp-ask .rp-lines{margin-top:2px}
.rp-foot{position:absolute;left:${RPT.padX}px;right:${RPT.padX}px;bottom:${RPT.padBottom}px;height:${RPT.footH - 8}px;border-top:1.5px solid #D5D9F5;padding-top:4px;font-size:10.5px;line-height:1.35;color:#5A6080;display:flex;justify-content:space-between;gap:12px}
.rp-foot .pg{flex:none;font-weight:700;color:#161A4D}`;
/** สรุปที่เปิดดูในแอพบนจอแคบ (มือถือ): ยังเป็นตารางเหมือนไฟล์ PDF แต่ย่อตัวอักษร/ช่องไฟให้พอดีหน้าจอ — ไม่มีผลกับไฟล์ PDF (ใช้เฉพาะภายใน .rp-view) */
const RPT_NARROW = `@media (max-width:640px){
.rp-view .rp-t{font-size:11.5px;line-height:1.3}
.rp-view .rp-t th,.rp-view .rp-t td{padding:3px 4px}
.rp-view .rp-head-t th{font-size:11px;padding:4px 3px}
.rp-view .rp-no b{font-size:10.5px;padding:1px 4px}
.rp-view .rp-mn{font-size:13px}
.rp-view .rp-info-t th,.rp-view .rp-info-t td{font-size:11.5px;padding:2px 4px}
.rp-view .rp-prev-t td.rp-say{font-size:13.5px}.rp-view .rp-prev-t th{font-size:11.5px}
.rp-view .rp-mnote{font-size:11.5px}
.rp-view .rp-t .s{font-size:10.5px}
.rp-view .rp-med col:nth-child(1),.rp-view .rp-head-t col:nth-child(1){width:12%!important}.rp-view .rp-med col:nth-child(2),.rp-view .rp-head-t col:nth-child(2){width:25%!important}.rp-view .rp-med col:nth-child(3),.rp-view .rp-head-t col:nth-child(3){width:19%!important}.rp-view .rp-med col:nth-child(4),.rp-view .rp-head-t col:nth-child(4){width:14%!important}.rp-view .rp-med col:nth-child(5),.rp-view .rp-head-t col:nth-child(5){width:30%!important}
.rp-view .rp-no b,.rp-view .rp-head-t th:first-child{white-space:nowrap}
.rp-view .rp-med{margin-top:-1.2px}
}`;
/** จัดบล็อกลงหน้า A4 (วัดความสูงจริง แล้วเรียงต่อกัน หัวข้อไม่ถูกทิ้งไว้ท้ายหน้า) */
function reportPaginate(wrap, blocks) {
  const meas = document.createElement('div'); meas.style.cssText = `position:absolute;visibility:hidden;left:0;top:0;width:${RPT.W - 2 * RPT.padX}px`;
  meas.innerHTML = blocks.map((b) => `<div class="rp-b ${b.tight ? 'tight' : ''}">${b.html}</div>`).join(''); wrap.appendChild(meas);
  const hs = [...meas.children].map((c, i) => Math.ceil(c.getBoundingClientRect().height) + (blocks[i].tight ? 0 : RPT.gap)); meas.remove();
  const hdrIdx = {}; blocks.forEach((b, i) => { if (b.hdrKey) hdrIdx[b.hdrKey] = i; });
  const avail = RPT.H - RPT.padTop - RPT.padBottom - RPT.headH - 8 - RPT.footH; const pages = []; let cur = [], used = 0;
  blocks.forEach((b, i) => {
    if (cur.length && used + hs[i] > avail) {
      const moved = []; while (cur.length && cur[cur.length - 1].b.title) moved.unshift(cur.pop()); // หัวข้อ/หัวตารางที่ค้างท้ายหน้า ย้ายไปหน้าถัดไปด้วย
      pages.push(cur); cur = moved; used = moved.reduce((x, y) => x + y.h, 0);
    }
    // แถวของตารางที่ขึ้นหน้าใหม่โดยไม่มีหัวตาราง → ใส่หัวตารางซ้ำ
    if (b.rowKey && hdrIdx[b.rowKey] !== undefined && !cur.some((x) => x.b.hdrKey === b.rowKey || (x.b.rowKey === b.rowKey))) {
      const hi = hdrIdx[b.rowKey]; cur.push({ b: { ...blocks[hi], repeated: true }, h: hs[hi] }); used += hs[hi];
    }
    cur.push({ b, h: hs[i] }); used += hs[i];
  });
  if (cur.length) pages.push(cur);
  return pages;
}function reportPagesHtml(R, blocks, wrap) {
  const pages = reportPaginate(wrap, blocks); const { a, p } = R;
  return pages.map((pg, i) => `<section class="rp-page" style="--pc:${p.color};--pcs:${tint(p.color, .16)}" data-i="${i + 1}">
    <div class="rp-top"><b>รายงานก่อนพบแพทย์</b><span>${esc(p.name)} · นัด ${thDate(a.appt_date)} ${hhmm(a.appt_time)} น.${a.department ? ` · ${esc(a.department)}` : ''}</span></div>
    <div class="rp-body">${pg.map((x) => `<div class="rp-b ${x.b.tight ? 'tight' : ''}">${x.b.html}</div>`).join('')}</div>
    <div class="rp-foot"><span>แอพสุขใจเป็นเครื่องช่วยจำ ไม่ใช่เอกสารทางการแพทย์ · สร้างไฟล์เมื่อ ${madeAt()} · © 2026 สุขใจ (Sookjai)</span><span class="pg">หน้า ${i + 1}/${pages.length}</span></div></section>`).join('');
}

/** ตรวจรายงานที่สร้างแล้ว — คืนรายการปัญหา (ว่าง = ผ่าน) */
function auditReport(wrap, R) {
  const issues = []; const pages = [...wrap.querySelectorAll('.rp-page')]; const nz = normTxt; const { p, meds, prev } = R;
  if (!pages.length) issues.push('ไม่มีหน้าเลย');
  const text = nz(pages.map((x) => x.textContent).join(' '));
  pages.forEach((pg, i) => {
    const t = `หน้า ${i + 1}`; const r = pg.getBoundingClientRect(); const body = pg.querySelector('.rp-body').getBoundingClientRect(); const foot = pg.querySelector('.rp-foot').getBoundingClientRect();
    if (Math.abs(r.width - RPT.W) > 1 || Math.abs(r.height - RPT.H) > 1) issues.push(`${t}: ขนาด ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (body.bottom > foot.top + 1) issues.push(`${t}: เนื้อหาชนท้ายกระดาษ (${Math.round(body.bottom - foot.top)}px)`);
    if (!nz(pg.querySelector('.rp-top').textContent).includes(p.name)) issues.push(`${t}: หัวกระดาษไม่มีชื่อ`);
    if (nz(pg.querySelector('.pg').textContent) !== `หน้า ${i + 1}/${pages.length}`) issues.push(`${t}: เลขหน้าไม่ตรง`);
    if (!nz(pg.querySelector('.rp-foot').textContent).includes('© 2026 สุขใจ (Sookjai)')) issues.push(`${t}: ไม่มีข้อความลิขสิทธิ์`);
    const last = pg.querySelector('.rp-body').lastElementChild; if (last && last.querySelector('.rp-h') && last.children.length === 1) issues.push(`${t}: หัวข้อค้างท้ายหน้า`);
    pg.querySelectorAll('.rp-card, .rp-t').forEach((c) => { if (c.scrollWidth > c.clientWidth + 1) issues.push(`${t}: ข้อความล้นกรอบ "${nz(c.textContent).slice(0, 24)}"`); });
  });
  const medCards = [...wrap.querySelectorAll('.rp-med')]; if (medCards.length !== meds.length) issues.push(`รายการยา: ในแอพ ${meds.length} แต่ในรายงาน ${medCards.length}`);
  meds.forEach((m, i) => { const c = medCards[i]; if (!c) return; const tx = nz(c.textContent);
    if (!tx.includes(nz(m.name)) || !tx.includes(medNo(m))) issues.push(`ยา ${medNo(m)} ${m.name}: ข้อมูลไม่ตรง`);
    if (!tx.includes(nz(medWhen(m)))) issues.push(`ยา ${medNo(m)}: เวลากินไม่ตรง`);
    const note = nz(m.note || ''); if (note && !tx.includes(note.slice(0, 40))) issues.push(`ยา ${medNo(m)}: บันทึกของยาไม่ครบ`);
    if (tracksStock(m) && !tx.includes(`${qtyText(stockLeft(m))} ${nz(unitOf(m))}`)) issues.push(`ยา ${medNo(m)}: จำนวนยาที่เหลือไม่ตรง`); });
  const headRows = wrap.querySelectorAll('.rp-head-t').length; const pagesWithMeds = pages.filter((pg) => pg.querySelector('.rp-med')).length; if (meds.length && headRows < pagesWithMeds) issues.push('ตารางยาบางหน้าไม่มีหัวตาราง');
  if (R.a.note && !text.includes(nz(R.a.note).slice(0, 40))) issues.push('ไม่มีหมายเหตุของนัด');
  if (prev && !text.includes(nz(prev.visit_summary).slice(0, 40))) issues.push('ไม่มีผลการพบแพทย์ครั้งก่อน');
  if (R.p.drug_allergies?.length && !R.p.drug_allergies.every((x) => text.includes(nz(x)))) issues.push('ข้อมูลแพ้ยาไม่ครบ');
  if (!text.includes(`${thDate(R.a.appt_date)} ${hhmm(R.a.appt_time)}`)) issues.push('ไม่มีวันนัด');
  reportBodyItems(R.p).forEach(([k, v]) => { if (!text.includes(nz(k)) || !text.includes(nz(v))) issues.push(`ไม่มีข้อมูล${k}`); });
  if ((R.p.chronic_diseases || []).length && !R.p.chronic_diseases.every((x) => text.includes(nz(x)))) issues.push('โรคประจำตัวไม่ครบ');
  return issues;
}
const reportSig = (wrap) => [...wrap.querySelectorAll('.rp-page')].map((x) => x.outerHTML.replace(/สร้างไฟล์เมื่อ[^<]*/g, '')).join('\n');

async function buildReportFrame(apptId, opt = {}) {
  const a = S.appointments.find((x) => x.id === apptId); if (!a) throw new Error('NO_APPT');
  const R = reportData(a, opt); const wrap = document.createElement('div'); wrap.className = 'rp-wrap';
  wrap.innerHTML = `<style>${RPT_CSS}</style><div class="rp-stage"></div>`; document.body.appendChild(wrap);
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]);
  const stage = wrap.querySelector('.rp-stage'); stage.innerHTML = reportPagesHtml(R, reportBlocks(R), wrap);
  return { wrap, R };
}
async function makeReportPdf(apptId, opt = {}) {
  await refreshForPdf();
  const jsPDF = await loadPdfLibs();
  const f1 = await buildReportFrame(apptId, opt);
  try {
    const i1 = auditReport(f1.wrap, f1.R); if (i1.length) throw new PdfAuditError(i1.map((x) => '[รอบ 1] ' + x));
    const f2 = await buildReportFrame(apptId, opt);
    try { const i2 = auditReport(f2.wrap, f2.R); const same = reportSig(f1.wrap) === reportSig(f2.wrap); if (i2.length || !same) throw new PdfAuditError([...i2.map((x) => '[รอบ 2] ' + x), ...(same ? [] : ['[รอบ 2] สร้างซ้ำแล้วได้ผลไม่เหมือนรอบแรก'])]); }
    finally { f2.wrap.remove(); }
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); const pages = [...f1.wrap.querySelectorAll('.rp-page')]; const i3 = [];
    for (let i = 0; i < pages.length; i++) {
      const cv = await window.html2canvas(pages[i], { scale: 3, backgroundColor: '#fff', useCORS: true, windowWidth: RPT.W });
      if (cv.width !== RPT.W * 3 || cv.height !== RPT.H * 3) i3.push(`[รอบ 3] หน้า ${i + 1}: ภาพ ${cv.width}×${cv.height}`);
      const t = document.createElement('canvas'); t.width = 120; t.height = 170; const tc = t.getContext('2d'); tc.drawImage(cv, 0, 0, 120, 170); const d = tc.getImageData(0, 0, 120, 170).data; let ink = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 690) ink++;
      if (ink / (120 * 170) < 0.004) i3.push(`[รอบ 3] หน้า ${i + 1}: ภาพแทบว่าง`);
      if (i) pdf.addPage('a4', 'portrait');
      pdf.addImage(cv.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
    }
    if (i3.length) throw new PdfAuditError(i3);
    const a = f1.R.a; return { pdf, pages: pages.length, name: `รายงานก่อนพบแพทย์-${f1.R.p.name}-${a.appt_date}.pdf` };
  } finally { f1.wrap.remove(); }
}

/** สรุปรายงานที่ซ่อนไว้ในหน้ารายละเอียดนัด: กดเปิดดูได้ทันทีโดยไม่ต้องดาวน์โหลด (แสดงใน Shadow DOM จึงไม่ปนกับสไตล์ของแอพ) */
function renderReportPreview(det) {
  const a = S.appointments.find((x) => x.id === det.dataset.appt); const box = det.querySelector('.rp-prev-body'); if (!a || !box) return;
  try {
    const R = reportData(a, { medIds: reportDefaultMedIds(a) }); const blocks = reportBlocks(R);
    box.className = 'rp-prev-body'; box.innerHTML = '';
    const root = box.attachShadow ? box.attachShadow({ mode: 'open' }) : box;
    root.innerHTML = `<style>${RPT_CSS}${RPT_NARROW}.rp-view{--pc:${R.p.color};--pcs:${tint(R.p.color, .16)};font-family:Sarabun,Prompt,sans-serif;color:#161A4D}.rp-view .rp-b{margin-bottom:10px}</style>
      <div class="rp-view">${blocks.map((b) => `<div class="rp-b">${b.html}</div>`).join('')}<p style="font-size:12px;color:#5A6080;margin:4px 0 0">นี่คือสรุปที่จะอยู่ในไฟล์ PDF — กด "รายงานก่อนพบแพทย์ (PDF)" เพื่อเลือกยาและดาวน์โหลด</p></div>`;
    det.dataset.ready = '1';
  } catch (e) { console.error(e); box.textContent = 'แสดงสรุปไม่สำเร็จ ลองใหม่อีกครั้ง'; }
}
document.addEventListener('toggle', (ev) => {
  const det = ev.target; if (!det.classList?.contains('rp-prev') || !det.open || det.dataset.ready === '1') return;
  renderReportPreview(det);
}, true);

/** เลือกยาที่จะใส่ในรายงาน: ติ๊กไว้ให้ตามแผนกของนัด (ถ้าไม่มียาไหนระบุแผนกเลย จะติ๊กทุกตัวให้ แล้วให้เลือกเอง) */
function reportPickSheet(a) {
  const p = profileById(a.profile_id); const meds = medsOf(p.id);
  const matched = a.department ? meds.filter((m) => reportMedMatches(m, a.department)) : [];
  const useAll = !matched.length; const on = new Set((useAll ? meds : matched).map((m) => m.id));
  const sh = openSheet(`<h3>📄 เลือกยาที่จะใส่ในรายงาน</h3>
    <p class="small muted">นัด${a.department ? `แผนก <b>${esc(a.department)}</b>` : ''} ของ ${esc(p.name)} · ${thDate(a.appt_date)}</p>
    ${useAll ? `<div class="alert sun"><div class="ic">💡</div><div><b>ยังไม่มียาที่ระบุว่าเป็นของแผนกนี้</b><span class="small">เลยติ๊กทุกตัวไว้ให้ก่อน — เลือกเฉพาะยาที่เกี่ยวข้องได้ และถ้ากรอก "แผนกที่จ่ายยา" ในฟอร์มยา ครั้งหน้าระบบจะเลือกให้เอง</span></div></div>` : `<p class="small">ติ๊กยาที่ตรงกับแผนกนี้ไว้ให้แล้ว (${matched.length} จาก ${meds.length} รายการ) ปรับเพิ่ม/ลดได้</p>`}
    <div class="row" style="margin:6px 0"><button type="button" class="btn ghost sm" id="rpAll">เลือกทั้งหมด</button><button type="button" class="btn ghost sm" id="rpNone">ไม่เลือกเลย</button></div>
    <div class="rp-pick">${meds.map((m) => `<label class="card flat rp-pick-row"><input type="checkbox" name="rpmed" value="${m.id}" ${on.has(m.id) ? 'checked' : ''}><b class="rp-pick-no">${esc(medNo(m))}</b><span class="rp-pick-nm">${esc(m.name)}<small class="muted">${esc([m.purpose, m.prescribed_dept && `แผนก${m.prescribed_dept}`].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</div>
    <div class="row sticky-actions"><button class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" id="rpGo">สร้างรายงาน</button></div>`);
  const boxes = () => [...sh.querySelectorAll('input[name=rpmed]')];
  $('#rpAll', sh).onclick = () => boxes().forEach((c) => { c.checked = true; });
  $('#rpNone', sh).onclick = () => boxes().forEach((c) => { c.checked = false; });
  $('#rpGo', sh).onclick = async () => {
    const medIds = boxes().filter((c) => c.checked).map((c) => c.value);
    if (!medIds.length && meds.length && !(await askConfirm('ยังไม่ได้เลือกยาเลย ต้องการสร้างรายงานที่ไม่มีรายการยาใช่หรือไม่?', 'ใช่ สร้างเลย'))) return;
    closeSheet(); await runReport(a.id, { medIds });
  };
}
async function runReport(apptId, opt) {
  toast('กำลังสร้างและตรวจสอบรายงาน…');
  try { const { pdf, name, pages } = await makeReportPdf(apptId, opt); pdf.save(name); toast(`✓ ตรวจสอบแล้ว ดาวน์โหลดรายงาน ${pages} หน้า`); }
  catch (e) { pdfFail(e, () => toast('สร้างรายงานไม่สำเร็จ ลองใหม่อีกครั้ง')); }
}
async function downloadReport(apptId) {
  const a = S.appointments.find((x) => x.id === apptId); if (!a) return;
  if (!canUse('report')) return premiumSheet('report');
  const st = reportState(a); if (!st.ok) return toast(st.n < 0 ? 'นัดนี้ผ่านมาแล้ว' : `สั่งทำรายงานได้ตั้งแต่วันที่ ${thDate(st.opens)} (ภายใน ${REPORT_WINDOW_DAYS} วันก่อนวันนัด)`);
  await refreshForPdf();
  if (!medsOf(a.profile_id).length) return runReport(apptId, {});
  closeSheet(); reportPickSheet(a);
}
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act="appt-report"]'); if (!el || !S) return;
  downloadReport(el.dataset.id);
});
