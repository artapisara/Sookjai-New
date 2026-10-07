/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — ประวัติการรักษา + จำนวนยาที่เหลือ
 * ประวัติการรักษา (ดูอย่างเดียว) รวมจาก 3 แหล่ง: ใบนัดหมอที่ถึงวันแล้ว · บันทึกติดตามอาการที่ติ๊ก "ไป รพ." · บันทึกการเข้ารักษา (ผู้ใช้เพิ่มเอง ตาราง treatment_records)
 * จำนวนยาที่เหลือ = จำนวนคงเหลือที่กรอก − ปริมาณที่ควรทานตามตาราง นับตั้งแต่วันที่กรอก (stock_at) จนถึงวันนี้
 */
'use strict';

// ---------- จำนวนยาที่เหลือ ----------
const stockBase = (m) => m.stock_at || (m.updated_at ? dk(new Date(m.updated_at)) : todayKey());
function stockLeft(m, key = todayKey()) {
  const stock = num(m.stock);
  if (m.as_needed || !m.slots?.length) return stock; // ยาที่กินเมื่อมีอาการ หักให้อัตโนมัติไม่ได้
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
  if (!medsOf(p.id).length) return `${back}<h1>จำนวนยาที่เหลือ</h1>${visBtn}<div class="chips">${vis.map((x) => `<button class="chip ${x.id === p.id ? 'on' : ''}" data-act="stock-person" data-id="${x.id}" style="--pc:${x.color};--pt:${inkOn(x.color)}"><span class="av xs">${avatarSVG(x.avatar, x.color)}</span>${esc(x.name)}</button>`).join('')}</div><h2 class="ad-title">ยาของ${esc(p.name)}</h2><div class="card empty"><div class="e">💊</div>${esc(p.name)} ยังไม่มีข้อมูลยา</div>`;
  const meds = medsOf(p.id); const tracked = meds.filter(tracksStock); const other = meds.length - tracked.length;
  const qkey = (m) => norm(`${medNo(m)} ${m.name} ${m.purpose || ''} ${m.prescriber || ''} ${m.prescribed_dept || ''}`); const q = norm(ui.stockQ || ''); const hit = (m) => !q || qkey(m).includes(q);
  const rows = tracked.map((m) => {
    const left = stockLeft(m); const use = dailyUse(m); const dl = use ? Math.floor(left / use) : Infinity; const low = isLowStock(m);
    const doc = [m.prescriber, m.prescribed_dept].filter(Boolean).join(' · ');
    return `<tr class="stk-row ${low ? 'low' : ''}" data-q="${esc(qkey(m))}" ${hit(m) ? '' : 'hidden'}><td><b class="stk-no">${esc(medNo(m))}</b></td>
      <td><b>${esc(m.name)}</b>${doc ? `<small class="muted">👨‍⚕️ ${esc(doc)}</small>` : ''}</td>
      <td class="stk-pur">${esc(m.purpose || '-')}</td>
      <td class="${low ? 'red-t' : ''}">${use && !m.as_needed ? `${thDate(dk(addDays(new Date(), dl)))}<small>อีก ${dl} วัน</small>` : '-'}</td>
      <td class="stk-left"><b class="${low ? 'red-t' : ''}">${qtyText(left)}</b><small>${esc(unitOf(m))}</small></td></tr>`;
  }).join('');
  const lowOf = (pid) => medsOf(pid).filter((m) => m.status === 'active' && isLowStock(m)).length;
  const chips = `<div class="chips">${vis.map((x) => `<button class="chip ${x.id === p.id ? 'on' : ''}" data-act="stock-person" data-id="${x.id}" style="--pc:${x.color};--pt:${inkOn(x.color)}"><span class="av xs">${avatarSVG(x.avatar, x.color)}</span>${esc(x.name)}${lowOf(x.id) ? `<span class="low-badge sm"><i>!</i>${lowOf(x.id)}</span>` : ''}</button>`).join('')}</div>`;
  const lowList = tracked.filter((m) => m.status === 'active' && isLowStock(m));
  const lowBox = lowList.length ? `<div class="alert red low-box"><div class="ic"><svg class="ex-svg" viewBox="0 0 36 36" width="36" height="36" aria-hidden="true"><circle cx="18" cy="18" r="16" fill="#fff" stroke="#E5332A" stroke-width="3"/><rect x="16" y="8" width="4" height="13" rx="2" fill="#E5332A"/><circle cx="18" cy="26.5" r="2.5" fill="#E5332A"/></svg></div><div><b>ยาใกล้หมด ${lowList.length} ตัว</b><span class="low-sub">เหลือไม่เกิน ${lowStockQty()} เม็ด</span>
    <table class="low-t"><thead><tr><th>รหัส</th><th>ชื่อยา</th><th>ตอนนี้เหลือ</th></tr></thead><tbody>${lowList.map((m) => `<tr><td><b>${esc(medNo(m))}</b></td><td>${esc(medShort(m))}</td><td class="red-t"><b>${qtyText(stockLeft(m))}</b> ${esc(unitOf(m))}</td></tr>`).join('')}</tbody></table></div></div>` : '';
  return `${back}<h1>จำนวนยาที่เหลือ</h1>${visBtn}${chips}
    ${lowBox}
    <h2 class="ad-title">ยาของ${esc(p.name)} ณ วันที่ ${thDate(today)}</h2>
    ${rows ? `<input type="search" id="stkQ" class="stk-search" placeholder="🔍 ค้นหาชื่อยา / แพทย์ / แผนก / รหัส" value="${esc(ui.stockQ || '')}" autocomplete="off" aria-label="ค้นหาชื่อยาหรือชื่อแพทย์">
      <div class="card stk-card"><table class="stk-t"><thead><tr><th>รหัส</th><th>ชื่อยา</th><th>รักษา</th><th>หมดประมาณ</th><th>เหลือ</th></tr></thead><tbody>${rows}</tbody></table><p class="small muted center stk-none" ${tracked.some(hit) ? 'hidden' : ''}>ไม่พบยาที่ค้นหา</p></div>` : '<div class="card empty"><div class="e">📦</div>ยังไม่มียาที่นับจำนวนคงเหลือ<br><span class="small">กรอก "จำนวนคงเหลือ" ในฟอร์มยา แล้วจะคำนวณให้</span></div>'}
    <p class="small muted center">คำนวณจากจำนวนคงเหลือที่กรอกไว้ หักตามตารางกินยาทุกวัน นับตั้งแต่วันที่กรอก${other ? `<br>ยาหน่วยหยด/ครั้ง/ช้อนชา/มล. ${other} ตัว ไม่นับจำนวนคงเหลือ` : ''}<br>ถ้าตัวเลขไม่ตรงกับของจริง แก้ "จำนวนคงเหลือ" ในฟอร์มยา ระบบจะเริ่มนับใหม่จากวันนั้น</p>`;
}

// ---------- ประวัติการรักษา ----------
const trList = (pid) => (S.treatment_records || []).filter((r) => r.profile_id === pid);
function historyItems(pid) {
  const today = todayKey(); const items = [];
  S.appointments.filter((a) => a.profile_id === pid && a.appt_date <= today).forEach((a) => items.push({ kind: 'appt', date: a.appt_date, sub: String(a.appt_time || '').slice(0, 5), a }));
  S.care_logs.filter((l) => l.hospital_visit).forEach((l) => { const c = S.care_plans.find((x) => x.id === l.plan_id); if (c && c.profile_id === pid) items.push({ kind: 'care', date: l.log_date, l, c }); });
  trList(pid).forEach((r) => items.push({ kind: 'rec', date: r.record_date, r }));
  return items.sort((a, b) => b.date.localeCompare(a.date));
}
function historyCard(it) {
  const line = (t) => (t ? `<div class="small">${t}</div>` : '');
  if (it.kind === 'appt') {
    const a = it.a; const h = hospitalById(a.hospital_id); const d = doctorById(a.doctor_id);
    return `<div class="card hist-item"><div class="hi-top"><span class="tag">📅 ตามใบนัดหมอ</span><span class="small muted">${thDate(it.date)}${it.sub ? ` · ${it.sub} น.` : ''}</span></div>
      <b>${esc(a.department || 'พบแพทย์')}</b>${line(h ? `🏥 ${esc(h.name)}` : '')}${line(d ? `👨‍⚕️ ${esc(d.name)}` : '')}${line(a.visit_reason ? `สาเหตุ: ${esc(a.visit_reason)}` : '')}${line(a.note ? esc(a.note) : '')}</div>`;
  }
  if (it.kind === 'care') {
    const l = it.l;
    return `<div class="card hist-item"><div class="hi-top"><span class="tag">🩹 จากติดตามอาการ · ไป รพ.</span><span class="small muted">${thDate(it.date)}</span></div>
      <b>${esc(it.c.title)}</b>${line(l.trend && CARE_TRENDS[l.trend] ? `อาการ: ${CARE_TRENDS[l.trend].icon} ${CARE_TRENDS[l.trend].label}` : '')}${line(l.note ? esc(l.note) : '')}</div>`;
  }
  const r = it.r; const can = canEditProfile(r.profile_id);
  return `<div class="card hist-item rec"><div class="hi-top"><span class="tag sun">🏥 บันทึกการเข้ารักษา</span><span class="small muted">${thDate(it.date)}</span></div>
    <b>${esc(r.reason)}</b>${line(r.hospital ? `🏥 ${esc(r.hospital)}` : '')}
    ${line(r.admitted ? `🛏️ นอนโรงพยาบาล ${num(r.nights)} คืน` : 'ไม่ได้นอนโรงพยาบาล')}${line(r.note ? esc(r.note) : '')}
    ${can ? `<div class="row" style="margin-top:8px"><button class="btn ghost sm" data-act="tr-edit" data-id="${r.id}">✏️ แก้ไข</button></div>` : ''}</div>`;
}
function viewHistory() {
  if (!canUse('history')) return premiumPage('ประวัติการรักษา', 'history');
  const back = backBar('ยาและการดูแล', 'meds-go', 'hub');
  if (!S.profiles.length) return `${back}<h1>ประวัติการรักษา</h1><div class="card empty">ยังไม่มีสมาชิก</div>`;
  if (!S.profiles.some((p) => p.id === ui.histPid)) ui.histPid = (S.profiles.find((p) => p.id === ui.medsPerson) || S.profiles[0]).id;
  const p = profileById(ui.histPid); const items = historyItems(p.id);
  const chips = `<div class="chips">${S.profiles.map((x) => `<button class="chip ${x.id === p.id ? 'on' : ''}" data-act="hist-person" data-id="${x.id}" style="--pc:${x.color};--pt:${inkOn(x.color)}"><span class="av xs">${avatarSVG(x.avatar, x.color)}</span>${esc(x.name)}</button>`).join('')}</div>`;
  return `${back}<h1>ประวัติการรักษา</h1>${ui.histOnly ? '' : chips}
    <h2 class="ad-title">การไปโรงพยาบาลของ${esc(p.name)}</h2>
    <p class="small muted" style="margin:4px 0 12px">สรุปจากใบนัดหมอ และบันทึกติดตามอาการที่เลือก "ไป รพ." — สามารถดูได้อย่างเดียว ถ้าจะเพิ่มหรือแก้ ให้ไปที่ > ติดตามอาการ</p>
    ${items.length ? items.map(historyCard).join('') : '<div class="card empty"><div class="e">🏥</div>ยังไม่มีประวัติการรักษา</div>'}`;
}

function treatmentForm(pid, r) {
  const p = profileById(pid); const e = r || { record_date: todayKey(), admitted: false, nights: 1 };
  const sheet = openSheet(`<h3>${r ? 'แก้ไขบันทึกการเข้ารักษา' : 'บันทึกการเข้ารักษา'}</h3>
    <div class="detail-head">${avatarHtml(p, 'sm')}<div><b>${esc(p.name)}</b></div></div>
    <form id="f">
      <label class="f"><span>วันที่ไปโรงพยาบาล</span><input type="date" name="record_date" required max="${todayKey()}" value="${e.record_date}"></label>
      <label class="f"><span>ป่วยเป็นอะไร / ไปเพราะอะไร</span><input type="text" name="reason" required maxlength="200" value="${esc(e.reason)}" placeholder="เช่น ปอดอักเสบ, ความดันสูง, ล้ม"></label>
      <label class="f"><span>โรงพยาบาล</span><input type="text" name="hospital" list="trHos" maxlength="120" value="${esc(e.hospital)}" placeholder="ชื่อโรงพยาบาล"><datalist id="trHos">${S.hospitals.map((h) => `<option value="${esc(h.name)}">`).join('')}</datalist></label>
      <label class="switch-row"><span>นอนโรงพยาบาลหรือไม่</span><span class="switch"><input type="checkbox" name="admitted" id="trAdm" ${e.admitted ? 'checked' : ''}><i></i></span></label>
      <label class="f ${e.admitted ? '' : 'hidden'}" id="trNightsBox"><span>นอนกี่คืน</span><input type="number" name="nights" min="1" max="3650" step="1" inputmode="numeric" value="${num(e.nights, 1)}"></label>
      <label class="f"><span>หมายเหตุ</span><textarea name="note" placeholder="เช่น หมอให้ยาเพิ่ม / นัดติดตามผล">${esc(e.note)}</textarea></label>
      <div class="row sticky-actions">
        ${r ? `<button type="button" class="btn danger" data-act="tr-del" data-id="${r.id}">ลบ</button>` : ''}
        <button type="button" class="btn ghost" data-act="close">ยกเลิก</button>
        <button class="btn" type="submit">บันทึก</button>
      </div>
    </form>`);
  const f = $('#f', sheet);
  $('#trAdm', f).addEventListener('change', (ev) => $('#trNightsBox', f).classList.toggle('hidden', !ev.target.checked));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f); const admitted = !!fd.get('admitted');
    const data = { record_date: fd.get('record_date'), reason: fd.get('reason').trim(), hospital: fd.get('hospital').trim(), admitted,
      nights: admitted ? Math.max(1, Math.round(num(fd.get('nights'), 1))) : 0, note: fd.get('note').trim() };
    if (!data.reason) return toast('ใส่ว่าป่วยเป็นอะไร หรือไปเพราะอะไร');
    if (r && !(await askConfirm('ต้องการ <b>แก้ไขบันทึกการเข้ารักษานี้</b> ใช่หรือไม่?<br><small class="muted">กด "ใช่ แก้ไข" เพื่อบันทึกการเปลี่ยนแปลง</small>', 'ใช่ แก้ไข'))) return;
    S.treatment_records = S.treatment_records || [];
    if (r) { Object.assign(r, data); closeSheet(); render(); if (await dbDo(DB.update('treatment_records', r.id, data))) toast('บันทึกแล้ว'); }
    else { const row = { id: uuid(), profile_id: pid, created_at: new Date().toISOString(), ...data }; S.treatment_records.push(row); closeSheet(); render(); if (await dbDo(DB.insert('treatment_records', row))) toast('เพิ่มบันทึกแล้ว'); }
  };
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || !S) return;
  const { act, id } = el.dataset;
  switch (act) {
    case 'hist-person': ui.histPid = id; render(); break;
    case 'stock-person': ui.stockPid = id; render(); break;
    case 'member-history': ui.tab = 'meds'; ui.medsPage = 'history'; ui.histPid = id; ui.histOnly = true; render(); window.scrollTo(0, 0); break;
    case 'member-stock': ui.tab = 'meds'; ui.medsPage = 'stock'; ui.stockPid = id; render(); window.scrollTo(0, 0); break;
    case 'tr-add': if (canEditProfile(ui.histPid)) treatmentForm(ui.histPid); break;
    case 'tr-edit': { const r = (S.treatment_records || []).find((x) => x.id === id); if (r && canEditProfile(r.profile_id)) treatmentForm(r.profile_id, r); break; }
    case 'tr-del': {
      const r = (S.treatment_records || []).find((x) => x.id === id); if (!r) break;
      if (!(await askConfirm(`ต้องการ <b>ลบบันทึกการเข้ารักษา "${esc(r.reason)}"</b> ใช่หรือไม่?<br><small class="muted">ลบแล้วกู้คืนไม่ได้</small>`, 'ใช่ ลบ'))) break;
      S.treatment_records = S.treatment_records.filter((x) => x.id !== id); closeSheet(); render();
      await dbDo(DB.remove('treatment_records', id)); toast('ลบแล้ว'); break;
    }
  }
});

// ช่องค้นหาในหน้าจำนวนยาที่เหลือ: กรองทันทีที่พิมพ์ (ไม่วาดหน้าใหม่ เพื่อไม่ให้เคอร์เซอร์หลุด)
document.addEventListener('input', (ev) => {
  const el = ev.target; if (!el || el.id !== 'stkQ') return;
  ui.stockQ = el.value; const q = norm(el.value); let n = 0;
  $$('.stk-row').forEach((r) => { const show = !q || (r.dataset.q || '').includes(q); r.hidden = !show; if (show) n++; });
  const none = $('.stk-none'); if (none) none.hidden = n > 0;
});