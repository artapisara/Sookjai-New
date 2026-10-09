/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — ประวัติการรักษา + จำนวนยาที่เหลือ
 * ประวัติการไปหาหมอ (ดูอย่างเดียว) รวมจากใบนัดหมอที่ถึงวันแล้วเท่านั้น
 * จำนวนยาที่เหลือ = จำนวนคงเหลือที่กรอก − ปริมาณที่ควรทานตามตาราง นับตั้งแต่วันที่กรอก (stock_at) จนถึงวันนี้
 */
'use strict';

// ---------- จำนวนยาที่เหลือ ----------
const stockBase = (m) => m.stock_at || (m.updated_at ? dk(new Date(m.updated_at)) : todayKey());
/** จำนวนคงเหลือเป็นข้อความ: หมดแล้ว (0 หรือติดลบ) = 'ยาหมด' · ใช้ทุกที่ที่แสดงจำนวนเหลือ (การ์ดยา หน้าจำนวนยาที่เหลือ เตือน PDF) */
function stockText(m) { const l = stockLeft(m); return l <= 0 ? 'ยาหมด' : `${qtyText(l)} ${unitOf(m)}`; }
function stockLeft(m, key = todayKey()) {
  const stock = num(m.stock);
  if (m.as_needed || !m.slots?.length) return stock; // ยาที่กินเมื่อมีอาการ หักให้อัตโนมัติไม่ได้
  if (m.status !== 'active') { // งดชั่วคราว/หยุดแล้ว: หยุดนับลดตั้งแต่วันที่เปลี่ยนสถานะ (ไม่มีวันที่ = ไม่หักเพิ่ม)
    const sd = (m.status_history || []).slice().reverse().find((h) => h.status === m.status)?.date || stockBase(m);
    if (sd < key) key = sd;
  }
  const per = m.slots.length * num(m.dose, 1); let used = 0;
  for (let d = parseDk(stockBase(m)); dk(d) < key; d = addDays(d, 1)) if (dueOn(m, dk(d))) used += per;
  return Math.max(0, Math.round((stock - used) * 100) / 100);
}
const isLowStock = (m) => tracksStock(m) && !m.as_needed && stockLeft(m) <= lowStockQty(); // ใช้จำนวนเม็ดที่ผู้ใช้ตั้งเท่านั้น
const qtyText = (n) => String(Math.round(num(n) * 100) / 100);

function viewStock() {
  const back = backBar('ยาและการดูแล', 'meds-go', 'hub');
  // แสดงเฉพาะของคนที่กดเข้ามาจากโปรไฟล์ (ไม่มีตัวเลือกคนอื่น และไม่สลับไปคนอื่นแม้คนนี้ยังไม่มียา)
  if (!S.profiles.length) return `${back}<h1>จำนวนยาที่เหลือ</h1><div class="card empty">ยังไม่มีสมาชิก</div>`;
  // ใช้การตั้งค่า "เลือกคนที่จะแสดง" ชุดเดียวกับหน้าวันนี้และหน้ายาที่ต้องทาน
  const vis = todayProfiles(); const nHidden = todayHidden().filter((id) => S.profiles.some((x) => x.id === id)).length;
  const visBtn = `<div class="tool-row"><button class="pill-btn" data-act="today-visibility">เลือกคนที่จะแสดง${nHidden ? ` (ซ่อน ${nHidden})` : ''}</button></div>`;
  if (!vis.length) return `${back}<h1>จำนวนยาที่เหลือ</h1>${visBtn}<div class="card empty"><div class="e">👁️</div>ซ่อนทุกคนอยู่ — กด "เลือกคนที่จะแสดง" ด้านบน</div>`;
  const p = vis.find((x) => x.id === ui.stockPid) || vis.find((x) => x.id === ui.medsPerson) || vis[0];
  ui.stockPid = p.id; const today = todayKey();
  if (!medsOf(p.id, 'any').length) return `${back}<h1>จำนวนยาที่เหลือ</h1>${visBtn}<div class="chips">${vis.map((x) => `<button class="chip ${x.id === p.id ? 'on' : ''}" data-act="stock-person" data-id="${x.id}" style="--pc:${x.color};--pt:${inkOn(x.color)}"><span class="av xs">${avatarSVG(x.avatar, x.color)}</span>${esc(x.name)}</button>`).join('')}</div><h2 class="ad-title">ยาของ${esc(p.name)}</h2><div class="card empty"><div class="e">💊</div>${esc(p.name)} ยังไม่มีข้อมูลยา</div>`;
  const meds = medsOf(p.id); const tracked = meds.filter(tracksStock); const other = meds.length - tracked.length;
  const qkey = (m) => norm(`${medNo(m)} ${m.name} ${medGeneric(m)} ${m.purpose || ''} ${m.prescriber || ''} ${m.prescribed_dept || ''}`); const q = norm(ui.stockQ || ''); const hit = (m) => !q || qkey(m).includes(q);
  const stkRow = (m) => {
    const off = m.status !== 'active'; // งดชั่วคราว/หยุดแล้ว: ไม่มีรหัส ไม่คำนวณวันหมด แสดงป้ายสถานะ และจำนวนที่ค้างไว้ ณ วันที่เปลี่ยนสถานะ
    const left = stockLeft(m); const use = dailyUse(m); const dl = use ? Math.floor(left / use) : Infinity; const low = !off && isLowStock(m);
    const doc = [m.prescriber, m.prescribed_dept].filter(Boolean).join(' · ');
    const tag = off ? `<small><span class="tag paused">${MED_STATUS[m.status]}</span></small>` : '';
    return `<tr class="stk-row ${low ? 'low' : ''} ${low && left <= 0 ? 'out' : ''}" data-q="${esc(qkey(m))}" ${hit(m) ? '' : 'hidden'}><td>${off ? '-' : `<b class="stk-no">${esc(medNo(m))}</b>`}</td>
      <td class="stk-pic-td">${m.photo ? `<img class="zoom stk-pic" data-path="${esc(m.photo)}" alt="รูป ${esc(m.name)}">` : ''}</td>
      <td><b class="stk-nm">${esc(m.name)}</b>${genHtml(m)}${tag}${doc ? `<small class="muted">👨‍⚕️ ${esc(doc)}</small>` : ''}</td>
      <td class="stk-pur">${esc(m.purpose || '-')}</td>
      <td class="${low ? 'red-t' : ''}">${!off && use && !m.as_needed ?`${thDate(dk(addDays(new Date(), dl)))}<small>อีก ${dl} วัน</small>` : '-'}</td>
      <td class="stk-left">${left <= 0 ? '<b class="red-t">ยาหมด</b>' : `<b class="${low ? 'red-t' : ''}">${qtyText(left)}</b><small>${esc(unitOf(m))}</small>`}</td></tr>`;
  };
  const rows = tracked.map(stkRow).join('');
  const offMeds = medsOf(p.id, 'any').filter((m) => m.status !== 'active' && tracksStock(m)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'en', { sensitivity: 'base' }));
  const offRows = offMeds.map(stkRow).join('');
  const lowOf = (pid) => medsOf(pid).filter((m) => m.status === 'active' && isLowStock(m)).length;
  const chips = `<div class="chips">${vis.map((x) => `<button class="chip ${x.id === p.id ? 'on' : ''}" data-act="stock-person" data-id="${x.id}" style="--pc:${x.color};--pt:${inkOn(x.color)}"><span class="av xs">${avatarSVG(x.avatar, x.color)}</span>${esc(x.name)}${lowOf(x.id) ? `<span class="low-badge sm"><i>!</i>${lowOf(x.id)}</span>` : ''}</button>`).join('')}</div>`;
  const lowList = tracked.filter((m) => m.status === 'active' && isLowStock(m));
  const lowBox = lowList.length ? `<div class="alert red low-box"><div class="ic"><svg class="ex-svg" viewBox="0 0 36 36" width="36" height="36" aria-hidden="true"><circle cx="18" cy="18" r="16" fill="#fff" stroke="#E5332A" stroke-width="3"/><rect x="16" y="8" width="4" height="13" rx="2" fill="#E5332A"/><circle cx="18" cy="26.5" r="2.5" fill="#E5332A"/></svg></div><div><b>ยาใกล้หมด ${lowList.length} ตัว</b><span class="low-sub">เหลือไม่เกิน ${lowStockQty()} เม็ด</span>
    <table class="low-t"><thead><tr><th>รหัส</th><th>ชื่อยา</th><th>ตอนนี้เหลือ</th></tr></thead><tbody>${lowList.map((m) => `<tr><td><b>${esc(medNo(m))}</b></td><td>${esc(medShort(m))}${genHtml(m)}</td><td class="red-t"><b>${esc(stockText(m))}</b></td></tr>`).join('')}</tbody></table></div></div>` : '';
  return `${back}<h1>จำนวนยาที่เหลือ</h1>${visBtn}${chips}
    ${lowBox}
    <h2 class="ad-title">ยาของ${esc(p.name)} ณ วันที่ ${thDate(today)}</h2>
    ${rows || offRows ? `<input type="search" id="stkQ" class="stk-search" placeholder="🔍 ค้นหายา / หมอ / แผนก" value="${esc(ui.stockQ || '')}" autocomplete="off" aria-label="ค้นหายา ชื่อทางการแพทย์ ชื่อหมอ แผนก หรือรหัส">
      <div class="card stk-card"><table class="stk-t"><thead><tr><th>รหัส</th><th>รูป</th><th>ชื่อยา</th><th>รักษา</th><th>หมดประมาณ</th><th>เหลือ</th></tr></thead><tbody>${rows}</tbody></table><p class="small muted center stk-none" ${[...tracked, ...offMeds].some(hit) ? 'hidden' : ''}>ไม่พบยาที่ค้นหา</p></div>
      ${offRows ? `<h2 class="ad-title">ยาที่ไม่ได้ทาน (งดชั่วคราว)</h2><div class="card stk-card stk-off"><table class="stk-t"><thead><tr><th>รหัส</th><th>รูป</th><th>ชื่อยา</th><th>รักษา</th><th>หมดประมาณ</th><th>เหลือ</th></tr></thead><tbody>${offRows}</tbody></table></div><p class="small muted center">ยาที่งดหรือหยุดจะไม่ถูกหักจำนวนตามตารางกินยา<br>แสดงจำนวนที่เหลือ ณ วันที่เปลี่ยนสถานะ</p>` : ''}` : '<div class="card empty"><div class="e">📦</div>ยังไม่มียาที่นับจำนวนคงเหลือ<br><span class="small">กรอก "จำนวนคงเหลือ" ในฟอร์มยา แล้วจะคำนวณให้</span></div>'}`;
}

// ---------- ประวัติการรักษา ----------
function historyItems(pid) {
  const today = todayKey(); const items = [];
  S.appointments.filter((a) => a.profile_id === pid && a.appt_date <= today).forEach((a) => items.push({ kind: 'appt', date: a.appt_date, sub: String(a.appt_time || '').slice(0, 5), a }));
  return items.sort((a, b) => b.date.localeCompare(a.date));
}
function historyCard(it) {
  const line = (t) => (t ? `<div class="small">${t}</div>` : '');
  if (it.kind === 'appt') {
    const a = it.a; const h = hospitalById(a.hospital_id); const d = doctorById(a.doctor_id);
    return `<div class="card hist-item"><div class="hi-top"><span class="tag">📅 ตามใบนัดหมอ</span><span class="small muted">${thDate(it.date)}${it.sub ? ` · ${it.sub} น.` : ''}</span></div>
      <b>${esc(a.department || 'พบหมอ')}</b>${line(h ? `🏥 ${esc(h.name)}` : '')}${line(d ? `👨‍⚕️ ${esc(d.name)}` : '')}${line(a.visit_reason ? `สาเหตุ: ${esc(a.visit_reason)}` : '')}${line(a.note ? esc(a.note) : '')}</div>`;
  }
}
function viewHistory() {
  if (!canUse('history')) return premiumPage('บันทึกการไปหาหมอ', 'history');
  const back = backBar('ยาและการดูแล', 'meds-go', 'hub');
  if (!S.profiles.length) return `${back}<h1>บันทึกการไปหาหมอ</h1><div class="card empty">ยังไม่มีสมาชิก</div>`;
  if (!S.profiles.some((p) => p.id === ui.histPid)) ui.histPid = (S.profiles.find((p) => p.id === ui.medsPerson) || S.profiles[0]).id;
  const p = profileById(ui.histPid); const items = historyItems(p.id);
  const chips = `<div class="chips">${S.profiles.map((x) => `<button class="chip ${x.id === p.id ? 'on' : ''}" data-act="hist-person" data-id="${x.id}" style="--pc:${x.color};--pt:${inkOn(x.color)}"><span class="av xs">${avatarSVG(x.avatar, x.color)}</span>${esc(x.name)}</button>`).join('')}</div>`;
  return `${back}<h1>บันทึกการไปหาหมอ</h1>${ui.histOnly ? '' : chips}
    <h2 class="ad-title">ครั้งที่ ${esc(p.name)} ไปหาหมอ</h2>
    <p class="small muted" style="margin:4px 0 12px">รวมจากใบนัดหมอที่ถึงกำหนดแล้ว ดูได้อย่างเดียว ถ้าจะเพิ่มหรือแก้ ให้ไปที่ "หมอนัด"</p>
    ${items.length ? items.map(historyCard).join('') : '<div class="card empty"><div class="e">🏥</div>ยังไม่มีบันทึกการไปหาหมอ</div>'}`;
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || !S) return;
  const { act, id } = el.dataset;
  switch (act) {
    case 'hist-person': ui.histPid = id; render(); break;
    case 'stock-person': ui.stockPid = id; render(); break;
    case 'member-history': ui.tab = 'meds'; ui.medsPage = 'history'; ui.histPid = id; ui.histOnly = true; render(); window.scrollTo(0, 0); break;
    case 'member-stock': ui.tab = 'meds'; ui.medsPage = 'stock'; ui.stockPid = id; render(); window.scrollTo(0, 0); break;
  }
});

// ช่องค้นหาในหน้าจำนวนยาที่เหลือ: กรองทันทีที่พิมพ์ (ไม่วาดหน้าใหม่ เพื่อไม่ให้เคอร์เซอร์หลุด)
document.addEventListener('input', (ev) => {
  const el = ev.target; if (!el || el.id !== 'stkQ') return;
  ui.stockQ = el.value; const q = norm(el.value); let n = 0;
  $$('.stk-row').forEach((r) => { const show = !q || (r.dataset.q || '').includes(q); r.hidden = !show; if (show) n++; });
  const none = $('.stk-none'); if (none) none.hidden = n > 0;
});
