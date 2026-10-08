/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — บันทึกความดันโลหิตและน้ำตาลในเลือด + กราฟแนวโน้ม
 * บันทึกเป็น "ตัวเลขที่วัดได้" เพื่อเอาไปให้แพทย์ดู — ไม่ตีความ ไม่บอกว่าปกติ/ผิดปกติ ไม่แนะนำการรักษา
 * Free: บันทึกได้ ดูย้อนหลัง FREE_LIMITS.healthDays วัน · Premium: กราฟ + ย้อนหลังทั้งหมด + ใส่ในสรุปก่อนพบแพทย์
 */
'use strict';

const HEALTH_KINDS = { bp: { label: 'ความดัน', icon: '🩸', unit: 'mmHg' }, glucose: { label: 'น้ำตาลในเลือด', icon: '🍬', unit: 'mg/dL' } };
const HEALTH_CTX = { fasting: 'ตื่นนอน / อดอาหาร', before_meal: 'ก่อนอาหาร', after_meal: 'หลังอาหาร 2 ชม.', bedtime: 'ก่อนนอน', other: 'อื่นๆ' };
const HEALTH_RANGES = [7, 30, 90];

const healthOf = (pid, kind) => (S.health_logs || []).filter((r) => r.profile_id === pid && r.kind === kind)
  .sort((a, b) => `${a.log_date} ${a.log_time || ''}`.localeCompare(`${b.log_date} ${b.log_time || ''}`));
const healthTs = (r) => new Date(`${r.log_date}T${String(r.log_time || '12:00').slice(0, 5)}:00`).getTime();
/** แถวที่ "ดูได้" ตามแพ็กเกจ: Free = N วันล่าสุด · Premium = ตามช่วงที่เลือก (วัน) หรือทั้งหมด */
function healthWindow(pid, kind, days) {
  const from = dk(addDays(new Date(), -(days - 1)));
  return healthOf(pid, kind).filter((r) => r.log_date >= from);
}
const healthDays = () => (isPremium() ? (HEALTH_RANGES.includes(ui.healthDays) ? ui.healthDays : 30) : FREE_LIMITS.healthDays);
const fmtVal = (r) => (r.kind === 'bp' ? `${r.sys}/${r.dia}` : `${r.glucose}`);
const statOf = (rows, key) => { const v = rows.map((r) => num(r[key], NaN)).filter(Number.isFinite); if (!v.length) return null; return { min: Math.min(...v), max: Math.max(...v), avg: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 }; };

// ---------- กราฟเส้น (SVG) ----------
function healthChart(rows, kind, days) {
  const W = 340, H = 200, ml = 38, mr = 12, mt = 14, mb = 30;
  const series = kind === 'bp' ? [{ k: 'sys', c: '#4D55F5', n: 'ตัวบน' }, { k: 'dia', c: '#CA7FFE', n: 'ตัวล่าง' }] : [{ k: 'glucose', c: '#4D55F5', n: 'น้ำตาล' }];
  const vals = rows.flatMap((r) => series.map((s) => num(r[s.k], NaN))).filter(Number.isFinite);
  if (!vals.length) return '';
  let lo = Math.min(...vals), hi = Math.max(...vals); const padv = Math.max(5, (hi - lo) * 0.15); lo = Math.floor((lo - padv) / 5) * 5; hi = Math.ceil((hi + padv) / 5) * 5;
  const t1 = healthTs({ log_date: todayKey(), log_time: '23:59' }), t0 = healthTs({ log_date: dk(addDays(new Date(), -(days - 1))), log_time: '00:00' });
  const X = (t) => ml + ((t - t0) / (t1 - t0 || 1)) * (W - ml - mr), Y = (v) => mt + (1 - (v - lo) / (hi - lo || 1)) * (H - mt - mb);
  const ticks = [0, 1, 2, 3].map((i) => Math.round(lo + ((hi - lo) * i) / 3));
  const grid = ticks.map((v) => `<line x1="${ml}" x2="${W - mr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#E4E6FA" stroke-width="1"/><text x="${ml - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#6B7099">${v}</text>`).join('');
  const lines = series.map((s) => {
    const pts = rows.map((r) => [X(healthTs(r)), Y(num(r[s.k]))]);
    const path = pts.length > 1 ? `<polyline fill="none" stroke="${s.c}" stroke-width="2.5" stroke-linejoin="round" points="${pts.map((p) => p.map((n) => Math.round(n * 10) / 10).join(',')).join(' ')}"/>` : '';
    return `${path}${pts.map((p) => `<circle cx="${Math.round(p[0] * 10) / 10}" cy="${Math.round(p[1] * 10) / 10}" r="3.8" fill="#fff" stroke="${s.c}" stroke-width="2.4"/>`).join('')}`;
  }).join('');
  const dl = (d) => { const x = new Date(d); return `${x.getDate()} ${MONTHS_S?.[x.getMonth()] || x.getMonth() + 1}`; };
  const xl = `<text x="${ml}" y="${H - 8}" font-size="11" fill="#6B7099">${dl(t0)}</text><text x="${W - mr}" y="${H - 8}" text-anchor="end" font-size="11" fill="#6B7099">${dl(t1)}</text>`;
  const legend = series.map((s) => `<span class="hl-key"><i style="background:${s.c}"></i>${s.n}</span>`).join('');
  return `<svg class="h-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟ${HEALTH_KINDS[kind].label} ${days} วันล่าสุด ${rows.length} ครั้ง">${grid}${xl}${lines}</svg><div class="h-legend">${legend}<span class="hl-key muted">หน่วย ${HEALTH_KINDS[kind].unit}</span></div>`;
}

// ---------- หน้าหลัก ----------
function viewHealth() {
  const back = backBar('ยาและการดูแล', 'meds-go', 'hub');
  if (!S.profiles.length) return `${back}<h1>ความดัน / น้ำตาล</h1><div class="card empty">ยังไม่มีสมาชิก</div>`;
  // ใช้การตั้งค่า "เลือกคนที่จะแสดง" ชุดเดียวกับหน้าวันนี้และหน้ายาที่ต้องทาน
  const vis = todayProfiles(); const nHidden = todayHidden().filter((id) => S.profiles.some((x) => x.id === id)).length;
  const visBtn = `<div class="tool-row"><button class="pill-btn" data-act="today-visibility">เลือกคนที่จะแสดง${nHidden ? ` (ซ่อน ${nHidden})` : ''}</button></div>`;
  if (!vis.length) return `${back}<h1>ความดัน / น้ำตาล</h1>${visBtn}<div class="card empty"><div class="e">👁️</div>ซ่อนทุกคนอยู่ — กด "เลือกคนที่จะแสดง" ด้านบน</div>`;
  if (!vis.some((x) => x.id === ui.healthPid)) ui.healthPid = (vis.find((x) => x.id === ui.medsPerson) || vis[0]).id;
  if (!HEALTH_KINDS[ui.healthKind]) ui.healthKind = 'bp';
  const p = profileById(ui.healthPid); const kind = ui.healthKind; const K = HEALTH_KINDS[kind]; const days = healthDays(); const prem = isPremium();
  const chips = `<div class="chips">${vis.map((x) => `<button class="chip ${x.id === p.id ? 'on' : ''}" data-act="health-person" data-id="${x.id}" style="--pc:${x.color};--pt:${inkOn(x.color)}"><span class="av xs">${avatarSVG(x.avatar, x.color)}</span>${esc(x.name)}</button>`).join('')}</div>`;
  const seg = `<div class="seg" role="tablist">${Object.entries(HEALTH_KINDS).map(([k, v]) => `<button type="button" role="tab" class="${k === kind ? 'on' : ''}" aria-selected="${k === kind}" data-act="health-kind" data-id="${k}">${v.icon} ${v.label}</button>`).join('')}</div>`;
  const rows = healthWindow(p.id, kind, days); const all = healthOf(p.id, kind);
  const last = all[all.length - 1];
  const range = `<div class="h-range"><span class="small muted">ช่วงที่ดู</span>${HEALTH_RANGES.map((d) => `<button type="button" class="${d === days ? 'on' : ''}" data-act="health-range" data-id="${d}">${d} วัน${prem || d === FREE_LIMITS.healthDays ? '' : ' ⭐'}</button>`).join('')}</div>`;
  const latest = last ? `<div class="card h-latest"><small class="muted">ค่าล่าสุด · ${thDate(last.log_date)}${last.log_time ? ` ${String(last.log_time).slice(0, 5)} น.` : ''}</small>
      <div class="h-big">${fmtVal(last)}<small> ${K.unit}</small></div>
      ${kind === 'bp' && last.pulse ? `<div class="small">ชีพจร ${last.pulse} ครั้ง/นาที</div>` : ''}${kind === 'glucose' && last.ctx ? `<div class="small">${esc(HEALTH_CTX[last.ctx] || '')}</div>` : ''}</div>` : '';
  const stats = (() => {
    if (!rows.length) return '';
    const cell = (t, s, u = '') => (s ? `<div><small class="muted">${t}</small><b>${s.min}–${s.max}</b><small>เฉลี่ย ${s.avg}${u}</small></div>` : '');
    return `<div class="card h-stats"><b>ช่วง ${days} วัน · ${rows.length} ครั้ง</b><div class="h-stat-row">${kind === 'bp' ? cell('ตัวบน', statOf(rows, 'sys')) + cell('ตัวล่าง', statOf(rows, 'dia')) : cell('น้ำตาล', statOf(rows, 'glucose'))}</div></div>`;
  })();
  const chart = prem
    ? (rows.length ? `<div class="card h-chart-card"><b>กราฟแนวโน้ม ${days} วันล่าสุด</b>${healthChart(rows, kind, days)}</div>` : '')
    : `<div class="card soft"><b>📈 กราฟแนวโน้ม</b><p class="small" style="margin:6px 0 10px">ดูกราฟและย้อนหลังทั้งหมดได้ใน Premium · Free ดูรายการ ${FREE_LIMITS.healthDays} วันล่าสุด</p><button class="btn block" data-act="premium-info" data-id="health">ดูรายละเอียด Premium</button></div>`;
  const list = rows.slice().reverse().map((r) => `<div class="card h-item"><div class="h-item-top"><b>${fmtVal(r)} <small class="muted">${HEALTH_KINDS[r.kind].unit}</small></b><span class="small muted">${thDate(r.log_date)}${r.log_time ? ` · ${String(r.log_time).slice(0, 5)} น.` : ''}</span></div>
      ${r.kind === 'bp' && r.pulse ? `<div class="small">ชีพจร ${r.pulse} ครั้ง/นาที</div>` : ''}${r.kind === 'glucose' && r.ctx ? `<div class="small"><span class="tag">${esc(HEALTH_CTX[r.ctx] || '')}</span></div>` : ''}${r.note ? `<div class="small">${esc(r.note)}</div>` : ''}
      ${canEditProfile(p.id) ? `<div class="row" style="margin-top:6px"><button class="btn ghost sm" data-act="health-edit" data-id="${r.id}">✏️ แก้ไข</button></div>` : ''}</div>`).join('');
  return `${back}<h1>ความดัน / น้ำตาล</h1>${visBtn}${chips}${seg}
    <h2 class="ad-title">${K.label}ของ${esc(p.name)}</h2>
    ${canEditProfile(p.id) ? `<button class="btn block" data-act="health-add" style="margin:4px 0 10px">+ บันทึกค่า${K.label}</button>` : ''}
    ${latest}${range}${stats}${chart}
    ${list || `<div class="card empty"><div class="e">${K.icon}</div>ยังไม่มีบันทึกใน ${days} วันล่าสุด</div>`}
    <p class="small muted center">บันทึกไว้เพื่อให้แพทย์ดูประกอบการรักษา แอพไม่ได้แปลผลหรือวินิจฉัย — ถ้ามีอาการผิดปกติ ให้ปรึกษาแพทย์/เภสัชกร</p>`;
}

// ---------- ฟอร์มบันทึกค่า ----------
function healthForm(pid, kind, r) {
  const p = profileById(pid); const e = r || { kind, log_date: todayKey(), log_time: nowHM() }; kind = e.kind;
  const sheet = openSheet(`<h3>${r ? 'แก้ไขบันทึก' : 'บันทึกค่า'}${HEALTH_KINDS[kind].label}</h3>
    <div class="detail-head">${avatarHtml(p, 'sm')}<div><b>${esc(p.name)}</b></div></div>
    <form id="f">
      <div class="two-btn"><label class="f"><span>วันที่</span><input type="date" name="log_date" required max="${todayKey()}" value="${e.log_date}"></label>
        <label class="f"><span>เวลา</span><input type="time" name="log_time" required value="${String(e.log_time || nowHM()).slice(0, 5)}"></label></div>
      ${kind === 'bp' ? `<div class="two-btn"><label class="f"><span>ตัวบน (SYS)</span><input type="number" name="sys" required min="50" max="300" step="1" inputmode="numeric" value="${e.sys ?? ''}" placeholder="เช่น 120"></label>
          <label class="f"><span>ตัวล่าง (DIA)</span><input type="number" name="dia" required min="30" max="200" step="1" inputmode="numeric" value="${e.dia ?? ''}" placeholder="เช่น 80"></label></div>
        <label class="f"><span>ชีพจร (ครั้ง/นาที) — ไม่บังคับ</span><input type="number" name="pulse" min="20" max="250" step="1" inputmode="numeric" value="${e.pulse ?? ''}"></label>`
      : `<label class="f"><span>น้ำตาลในเลือด (mg/dL)</span><input type="number" name="glucose" required min="10" max="800" step="1" inputmode="numeric" value="${e.glucose ?? ''}" placeholder="เช่น 110"></label>
        <label class="f"><span>วัดตอนไหน</span><select name="ctx">${Object.entries(HEALTH_CTX).map(([k, v]) => `<option value="${k}" ${(e.ctx || 'fasting') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`}
      <label class="f"><span>หมายเหตุ — ไม่บังคับ</span><textarea name="note" maxlength="300" placeholder="เช่น หลังออกกำลังกาย / กินยาแล้ว">${esc(e.note)}</textarea></label>
      <div class="row sticky-actions">
        ${r ? `<button type="button" class="btn danger" data-act="health-del" data-id="${r.id}">ลบ</button>` : ''}
        <button type="button" class="btn ghost" data-act="close">ยกเลิก</button>
        <button class="btn" type="submit">บันทึก</button>
      </div>
    </form>`);
  const f = $('#f', sheet);
  f.onsubmit = async (ev) => {
    ev.preventDefault(); const fd = new FormData(f);
    const data = { log_date: fd.get('log_date'), log_time: fd.get('log_time'), note: String(fd.get('note') || '').trim() || null };
    if (kind === 'bp') {
      Object.assign(data, { sys: Math.round(num(fd.get('sys'))), dia: Math.round(num(fd.get('dia'))), pulse: fd.get('pulse') ? Math.round(num(fd.get('pulse'))) : null, glucose: null, ctx: null });
      if (data.sys <= data.dia) return toast('ตัวบนต้องมากกว่าตัวล่าง ตรวจตัวเลขอีกครั้งนะ');
    } else Object.assign(data, { glucose: Math.round(num(fd.get('glucose'))), ctx: fd.get('ctx') || 'other', sys: null, dia: null, pulse: null });
    if (r && !(await askConfirm('ต้องการ <b>แก้ไขบันทึกนี้</b> ใช่หรือไม่?<br><small class="muted">กด "ใช่ แก้ไข" เพื่อบันทึกการเปลี่ยนแปลง</small>', 'ใช่ แก้ไข'))) return;
    S.health_logs = S.health_logs || [];
    if (r) { Object.assign(r, data); closeSheet(); render(); if (await dbDo(DB.update('health_logs', r.id, data))) toast('บันทึกแล้ว'); }
    else { const row = { id: uuid(), profile_id: pid, kind, created_at: new Date().toISOString(), ...data }; S.health_logs.push(row); closeSheet(); render(); if (await dbDo(DB.insert('health_logs', row))) toast('เพิ่มบันทึกแล้ว'); }
  };
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || !S) return;
  const { act, id } = el.dataset;
  switch (act) {
    case 'health-person': ui.healthPid = id; render(); break;
    case 'health-kind': ui.healthKind = id; render(); break;
    case 'health-range': { const d = +id; if (!isPremium() && d !== FREE_LIMITS.healthDays) { premiumSheet('health'); break; } ui.healthDays = d; render(); break; }
    case 'health-add': if (canEditProfile(ui.healthPid)) healthForm(ui.healthPid, ui.healthKind); break;
    case 'health-edit': { const r = (S.health_logs || []).find((x) => x.id === id); if (r && canEditProfile(r.profile_id)) healthForm(r.profile_id, r.kind, r); break; }
    case 'health-del': {
      const r = (S.health_logs || []).find((x) => x.id === id); if (!r) break;
      if (!(await askConfirm(`ต้องการ <b>ลบบันทึก ${fmtVal(r)} ${HEALTH_KINDS[r.kind].unit}</b> ของวันที่ ${thDate(r.log_date)} ใช่หรือไม่?<br><small class="muted">ลบแล้วกู้คืนไม่ได้</small>`, 'ใช่ ลบ'))) break;
      S.health_logs = S.health_logs.filter((x) => x.id !== id); closeSheet(); render();
      await dbDo(DB.remove('health_logs', id)); toast('ลบแล้ว'); break;
    }
  }
});
