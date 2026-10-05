/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — ติดตามอาการ (เช่น แผล ผื่น อาการบวม)
 * care_plans : เรื่องที่ติดตาม ต่อคน — รอบการติดตาม (ทุกกี่วัน) + แนวทางการดูแล
 * care_logs  : บันทึกแต่ละครั้ง — รูปถ่าย, อาการเทียบครั้งก่อน, บันทึกเพิ่มเติม
 * วันครบกำหนด = วันที่บันทึกล่าสุด + จำนวนวันในรอบ (ยังไม่เคยบันทึก = วันเริ่มติดตาม)
 */
'use strict';

const CARE_INTERVALS = [1, 2, 3, 7];
const CARE_STATUS = { active: 'กำลังติดตาม', done: 'หายแล้ว / จบการติดตาม' };
const CARE_TRENDS = { better: { label: 'ดีขึ้น', icon: '😊' }, same: { label: 'เท่าเดิม', icon: '😐' }, worse: { label: 'แย่ลง', icon: '😟' } };
const CARE_REMIND_AT = '09:00';

// ---------- ตัวช่วยอ่านข้อมูล ----------
const intervalText = (n) => (Number(n) === 1 ? 'ทุกวัน' : `ทุก ${n} วัน`);
const careLogsOf = (planId) => S.care_logs.filter((l) => l.plan_id === planId)
  .sort((a, b) => b.log_date.localeCompare(a.log_date) || String(b.created_at).localeCompare(String(a.created_at)));
function careNext(c) {
  const last = careLogsOf(c.id)[0];
  const next = last ? dk(addDays(parseDk(last.log_date), num(c.interval_days, 1))) : c.started_on;
  return { last, next, n: daysUntil(next) };
}
const careDue = (ids) => S.care_plans.filter((c) => c.status === 'active' && ids.includes(c.profile_id) && careNext(c).n <= 0);

function careMessage(c) {
  const p = profileById(c.profile_id);
  return {
    title: `🩹 ${p.name} ถึงวันติดตามอาการ`,
    body: `${c.title} — ถ่ายรูป/บันทึกอาการวันนี้${c.care_steps?.length ? '\n' + c.care_steps.map((s) => '• ' + s).join('\n') : ''}`,
  };
}

// ---------- องค์ประกอบ UI ----------
function careBadge(n) {
  if (n < 0) return `<span class="countdown hot">เลยกำหนด ${-n} วัน</span>`;
  if (n === 0) return `<span class="countdown">ถึงกำหนดวันนี้</span>`;
  return `<span class="countdown calm">ครั้งถัดไป${whenText(n)}</span>`;
}
const careStepsList = (c) => `<ul class="steps">${c.care_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`;
const trendTag = (t) => (CARE_TRENDS[t] ? `<span class="tag trend-${t}">${CARE_TRENDS[t].icon} ${CARE_TRENDS[t].label}</span>` : '');

/** แถบเตือนหน้า "วันนี้" */
function careAlerts(ids) {
  return careDue(ids).map((c) => {
    const p = profileById(c.profile_id); const { n } = careNext(c);
    return `<button class="alert sun" data-act="care-log" data-id="${c.id}">
      ${avatarHtml(p, 'sm')}<div>
      <b>🩹 ${esc(p.name)}: ติดตาม${esc(c.title)}</b>
      <span class="small">${n < 0 ? `เลยกำหนด ${-n} วัน · ` : ''}ถ่ายรูป/บันทึกอาการวันนี้ (${intervalText(c.interval_days)})</span>
      ${c.care_steps?.length ? `<span class="small note">📋 ${c.care_steps.map(esc).join(' · ')}</span>` : ''}
    </div></button>`;
  }).join('');
}

function careCard(c) {
  const p = profileById(c.profile_id); const logs = careLogsOf(c.id); const { n } = careNext(c);
  const photo = logs.find((l) => l.photos?.length)?.photos[0];
  const active = c.status === 'active';
  return `<div class="card care" style="--pc:${p.color}${active ? '' : ';opacity:.75'}">
    <div class="care-top" data-act="care-detail" data-id="${c.id}">
      ${avatarHtml(p, 'sm')}
      <div class="info"><b class="care-title">${esc(c.title)}</b>
        <div class="small muted">${esc(p.name)} · ${intervalText(c.interval_days)} · บันทึกแล้ว ${logs.length} ครั้ง</div>
        ${active ? careBadge(n) : `<span class="small muted">${CARE_STATUS[c.status] || ''}</span>`}
        ${shareTag(c.profile_id)}
      </div>
      ${photo ? `<div class="thumb sm"><img data-path="${esc(photo)}" alt="รูปล่าสุด"></div>` : ''}
    </div>
    ${active && c.care_steps?.length ? `<div class="steps-box"><b class="small">📋 แนวทางการดูแล</b>${careStepsList(c)}</div>` : ''}
    ${active && canEditProfile(c.profile_id) ? `<button class="btn block sm" data-act="care-log" data-id="${c.id}">📷 บันทึกอาการ${n <= 0 ? 'วันนี้' : ''}</button>` : ''}
  </div>`;
}

// ---------- หน้า: ติดตามอาการ ----------
function viewCare() {
  if (!S.profiles.length) return `<h1>ติดตามอาการ</h1><div class="card empty"><div class="e">👨‍👩‍👧</div>เพิ่มคนในครอบครัวก่อน<br><button class="btn sm" data-act="add-person" style="margin-top:12px">+ เพิ่มคน</button></div>`;
  if (ui.careFilter !== 'all' && !S.profiles.some((p) => p.id === ui.careFilter)) ui.careFilter = 'all';
  const ids = ui.careFilter === 'all' ? S.profiles.map((p) => p.id) : [ui.careFilter];
  const mine = S.care_plans.filter((c) => ids.includes(c.profile_id));
  const act = mine.filter((c) => c.status === 'active').sort((a, b) => careNext(a).n - careNext(b).n);
  const done = mine.filter((c) => c.status !== 'active');
  return `
    <h1>ติดตามอาการ</h1><p class="sub">ถ่ายรูป/บันทึกอาการตามรอบ เช่น แผล ผื่น อาการบวม — ย้อนดูได้ว่าดีขึ้นไหม</p>
    ${personChips(ui.careFilter, 'care-filter', false, true)}
    <h2>กำลังติดตาม <span class="small muted">${act.length} เรื่อง</span></h2>
    ${act.map(careCard).join('') || `<div class="card empty"><div class="e">🩹</div>ยังไม่มีอาการที่ติดตาม<br>
      <button class="btn sm" data-act="add-care" style="margin-top:12px">+ เพิ่มการติดตามอาการ</button></div>`}
    ${done.length ? `<h2>${CARE_STATUS.done} <span class="small muted">${done.length} เรื่อง</span></h2>${done.map(careCard).join('')}` : ''}
    <button class="fab" data-act="add-care" aria-label="เพิ่มการติดตามอาการ">+</button>
  `;
}

// ---------- รายละเอียด ----------
function careDetail(c) {
  if (!c) return;
  const p = profileById(c.profile_id); const logs = careLogsOf(c.id); const { n } = careNext(c);
  const active = c.status === 'active';
  const canEdit = canEditProfile(c.profile_id); const canDel = canEdit && canDeleteRow(c, c.profile_id);
  const withPhoto = logs.filter((l) => l.photos?.length);
  const first = withPhoto[withPhoto.length - 1]; const latest = withPhoto[0];
  const row = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const fig = (l, cap) => `<figure><img class="zoom" data-path="${esc(l.photos[0])}" alt="รูป${cap}"><figcaption>${cap} · ${thDate(l.log_date)}</figcaption></figure>`;
  const sheet = openSheet(`
    <div class="detail-head" style="--pc:${p.color}">${avatarHtml(p, 'lg')}<div>
      <div class="small muted">ติดตามอาการของ ${esc(p.name)}</div><h3 style="margin:0">${esc(c.title)}</h3>
      ${active ? careBadge(n) : `<span class="small muted">${CARE_STATUS[c.status] || ''}</span>`}</div></div>
    <div class="card flat">
      ${row('รอบการติดตาม', intervalText(c.interval_days))}
      ${row('เริ่มติดตาม', thDate(c.started_on))}
      ${row('บันทึกแล้ว', `${logs.length} ครั้ง`)}
      ${row('แจ้งเตือน', c.remind !== false ? `🔔 ${CARE_REMIND_AT} น. วันที่ถึงกำหนด` : '🔕 ปิด')}
    </div>
    ${c.care_steps?.length ? `<div class="alert sun"><div class="ic">📋</div><div><b>แนวทางการดูแล</b>${careStepsList(c)}</div></div>` : ''}
    ${c.note ? `<div class="alert sun"><div class="ic">📝</div><div><b>หมายเหตุ</b><span>${esc(c.note)}</span></div></div>` : ''}
    ${first && latest && first !== latest ? `<h4>เทียบรูปแรกกับล่าสุด</h4><div class="compare">${fig(first, 'แรก')}${fig(latest, 'ล่าสุด')}</div>` : ''}
    <h4>บันทึกอาการ</h4>
    ${logs.map((l) => `<div class="log">
      <div class="log-head"><b>${thDate(l.log_date)}</b>${trendTag(l.trend)}${canEdit ? `<button class="btn ghost sm mini" data-act="care-log-edit" data-id="${l.id}">แก้ไข</button>` : ''}${canEdit && canDeleteRow(l, c.profile_id) ? `<button class="btn ghost sm mini danger" data-act="del-care-log" data-id="${l.id}">ลบ</button>` : ''}</div>
      ${l.note ? `<div class="small">${esc(l.note)}</div>` : ''}
      ${l.photos?.length ? `<div class="thumbs">${l.photos.map((ph) => `<div class="thumb"><img class="zoom" data-path="${esc(ph)}" alt="รูปติดตามอาการ"></div>`).join('')}</div>` : ''}
    </div>`).join('') || '<div class="card flat empty small">ยังไม่มีบันทึก</div>'}
    <div class="row sticky-actions">
      <button class="btn ghost" data-act="close">ปิด</button>
      ${canEdit ? `<button class="btn ghost" data-act="edit-care" data-id="${c.id}">✏️ แก้ไข</button>` : ''}
      ${canDel ? `<button class="btn ghost danger" data-act="del-care" data-id="${c.id}">🗑️ ลบ</button>` : ''}
      ${active && canEdit ? `<button class="btn" data-act="care-log" data-id="${c.id}">📷 บันทึก</button>` : ''}
    </div>
  `);
  hydrateImgs(sheet);
}

// ---------- ฟอร์มเรื่องที่ติดตาม ----------
function careForm(c) {
  if (!S.profiles.length) { toast('เพิ่มคนในครอบครัวก่อนนะ'); return go('family'); }
  if (c ? !canEditProfile(c.profile_id) : !S.profiles.some((p) => canEditProfile(p.id))) return toast('สิทธิ์ของคุณดูอย่างเดียว แก้ไขไม่ได้');
  const e = c || { profile_id: ui.careFilter !== 'all' && canEditProfile(ui.careFilter) ? ui.careFilter : null, started_on: todayKey(), interval_days: 1, care_steps: [], remind: true, status: 'active' };
  const sheet = openSheet(`<h3>${c ? 'แก้ไขการติดตามอาการ' : 'เพิ่มการติดตามอาการ'}</h3>
    <form id="f">
      <label class="f"><span>ติดตามอาการของใคร</span>${profileRadio(e.profile_id)}</label>
      <label class="f"><span>อาการ/สิ่งที่ติดตาม</span><input type="text" name="title" required value="${esc(e.title)}" placeholder="เช่น แผลที่ขาซ้าย, แผลกดทับ, ผื่นที่แขน"></label>
      <label class="f"><span>เริ่มติดตามวันที่</span><input type="date" name="started_on" required value="${e.started_on}"></label>
      <div class="f"><span class="lbl">ถ่ายรูป/บันทึกอาการทุกกี่วัน</span>
        <div class="pick">${CARE_INTERVALS.map((d) => `<label><input type="radio" name="iv" value="${d}" ${d === num(e.interval_days) ? 'checked' : ''}><span class="opt">${intervalText(d)}</span></label>`).join('')}
          <label class="opt iv-custom">ทุก <input type="number" name="interval_days" min="1" max="365" inputmode="numeric" required value="${num(e.interval_days, 1)}"> วัน</label>
        </div></div>
      <label class="f"><span>แนวทางการดูแล <small>(บรรทัดละ 1 ข้อ)</small></span><textarea name="care_steps" rows="4" placeholder="เช่น&#10;ล้างแผลด้วยน้ำเกลือ เปลี่ยนผ้าก๊อซ เช้า-เย็น&#10;ทายาฆ่าเชื้อ เช้า-เย็น&#10;ระวังอย่าให้แผลโดนน้ำ">${esc((e.care_steps || []).join('\n'))}</textarea></label>
      <label class="f"><span>หมายเหตุ / สิ่งที่หมอสั่ง</span><textarea name="note" placeholder="เช่น ถ้าแผลบวมแดงหรือมีหนองให้กลับไปพบแพทย์">${esc(e.note)}</textarea></label>
      <label class="switch-row card flat"><span>🔔 เตือนวันที่ถึงกำหนด (${CARE_REMIND_AT} น.)</span><span class="switch"><input type="checkbox" name="remind" ${e.remind !== false ? 'checked' : ''}><i></i></span></label>
      ${c ? `<div class="f"><span class="lbl">สถานะ</span><div class="seg">${Object.entries(CARE_STATUS).map(([k, v]) => `<label><input type="radio" name="status" value="${k}" ${c.status === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div></div>` : ''}
      <div class="row sticky-actions">
        ${c ? `<button type="button" class="btn danger" data-act="del-care" data-id="${c.id}">ลบ</button>` : ''}
        <button type="button" class="btn ghost" data-act="close">ยกเลิก</button>
        <button class="btn" type="submit">บันทึก</button>
      </div>
    </form>`);
  const f = $('#f', sheet);
  const ivIn = $('input[name=interval_days]', f);
  $$('input[name=iv]', f).forEach((r) => r.addEventListener('change', () => (ivIn.value = r.value)));
  ivIn.addEventListener('input', () => $$('input[name=iv]', f).forEach((r) => (r.checked = r.value === ivIn.value)));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    if (c && !(await askConfirm(`ต้องการ <b>แก้ไขเรื่องที่ติดตามนี้</b> ใช่หรือไม่?<br><small class="muted">กด "ใช่ แก้ไข" เพื่อบันทึกการเปลี่ยนแปลง</small>`, 'ใช่ แก้ไข'))) return;
    const fd = new FormData(f);
    const data = {
      profile_id: fd.get('profile_id'), title: fd.get('title').trim(), started_on: fd.get('started_on'),
      interval_days: Math.min(365, Math.max(1, Math.round(num(fd.get('interval_days'), 1)))),
      care_steps: String(fd.get('care_steps')).split('\n').map((s) => s.trim()).filter(Boolean),
      note: fd.get('note').trim(), remind: !!fd.get('remind'),
    };
    if (c) {
      data.status = fd.get('status') || c.status;
      Object.assign(c, data); closeSheet(); render();
      if (await dbDo(DB.update('care_plans', c.id, data))) toast('บันทึกแล้ว');
    } else {
      const row = { id: uuid(), status: 'active', created_at: new Date().toISOString(), ...data };
      S.care_plans.push(row); ui.tab = 'meds'; ui.medsPage = 'care'; closeSheet(); render();
      if (await dbDo(DB.insert('care_plans', row))) toast('เพิ่มการติดตามอาการแล้ว');
    }
  };
}

// ---------- ช่องแนบรูป (ถ่ายรูป / เลือกจากคลัง) ----------
function photoField(root, existing) {
  const st = { keep: [...(existing || [])], removed: [], pending: [] };
  const box = $('[data-photos]', root);
  const draw = () => {
    box.innerHTML = st.keep.map((p, i) => `<div class="thumb"><img data-path="${esc(p)}" alt=""><button type="button" data-rm-keep="${i}" aria-label="ลบรูป">×</button></div>`).join('')
      + st.pending.map((x, i) => `<div class="thumb new"><img src="${x.url}" alt=""><button type="button" data-rm-new="${i}" aria-label="ลบรูป">×</button></div>`).join('');
    hydrateImgs(box);
  };
  box.addEventListener('click', (ev) => {
    const k = ev.target.dataset.rmKeep, n = ev.target.dataset.rmNew;
    if (k !== undefined) { st.removed.push(st.keep[k]); st.keep.splice(k, 1); draw(); }
    if (n !== undefined) { URL.revokeObjectURL(st.pending[n].url); st.pending.splice(n, 1); draw(); }
  });
  $$('input[type=file]', root).forEach((inp) => inp.addEventListener('change', () => {
    [...inp.files].forEach((file) => st.pending.push({ file, url: URL.createObjectURL(file) })); inp.value = ''; draw();
  }));
  st.count = () => st.keep.length + st.pending.length;
  st.save = async (folder) => { const out = []; for (const x of st.pending) out.push(await DB.upload(x.file, folder)); return [...st.keep, ...out]; };
  draw();
  return st;
}

// ---------- ฟอร์มบันทึกอาการ ----------
function careLogForm(c, log) {
  if (!c) return;
  if (!canEditProfile(c.profile_id)) return toast('สิทธิ์ของคุณดูอย่างเดียว บันทึกอาการไม่ได้');
  const p = profileById(c.profile_id);
  const prev = careLogsOf(c.id).find((l) => l !== log && l.photos?.length);
  const e = log || { log_date: todayKey(), photos: [] };
  const sheet = openSheet(`<h3>${log ? 'แก้ไขบันทึกอาการ' : 'บันทึกอาการ'}</h3>
    <div class="detail-head">${avatarHtml(p, 'sm')}<div><b>${esc(c.title)}</b><div class="small muted">${esc(p.name)} · ${intervalText(c.interval_days)}</div></div></div>
    ${c.care_steps?.length ? `<div class="alert sun"><div class="ic">📋</div><div><b>แนวทางการดูแล</b>${careStepsList(c)}</div></div>` : ''}
    <form id="f">
      <label class="f"><span>วันที่</span><input type="date" name="log_date" required max="${todayKey()}" value="${e.log_date}"></label>
      <div class="f"><span class="lbl">รูปถ่าย</span>
        ${prev ? `<div class="prev-photo"><div class="thumb sm"><img class="zoom" data-path="${esc(prev.photos[0])}" alt="รูปครั้งก่อน"></div>
          <span class="small muted">ครั้งก่อน ${thDate(prev.log_date)}<br>ถ่ายมุมเดิม ระยะเดิม จะเทียบได้ง่าย</span></div>` : ''}
        <div class="thumbs" data-photos></div>
        <div class="row">
          <label class="btn ghost filebtn">📷 ถ่ายรูป<input type="file" accept="image/*" capture="environment" hidden></label>
          <label class="btn ghost filebtn">🖼️ เลือกรูป<input type="file" accept="image/*" multiple hidden></label>
        </div>
        <p class="small muted" style="margin:6px 0 0">เพิ่มได้หลายรูป · รูปติดตามอาการเก็บไว้ตลอด จนกว่าคุณจะลบเอง</p>
      </div>
      <div class="f"><span class="lbl">อาการเทียบกับครั้งก่อน</span>
        <div class="trend-pick">${Object.entries(CARE_TRENDS).map(([k, v]) => `<label class="trend-opt t-${k}"><input type="radio" name="trend" value="${k}" ${e.trend === k ? 'checked' : ''}><span class="t-card"><i class="t-ic">${v.icon}</i><b>${v.label}</b></span></label>`).join('')}</div>
        <p class="small red-t ${e.trend === 'worse' ? '' : 'hidden'}" id="worseTip">⚠️ ถ้าบวมแดง ร้อน มีหนอง มีกลิ่น หรือมีไข้ ควรพาไปพบแพทย์</p>
      </div>
      <label class="f"><span>บันทึกเพิ่มเติม</span><textarea name="note" placeholder="เช่น แผลแห้งขึ้น ไม่มีหนอง / ขอบแผลแดงขึ้น">${esc(e.note)}</textarea></label>
      <label class="switch-row"><span>ไปโรงพยาบาลหรือไม่<small class="small muted" style="display:block">ติ๊กถ้าครั้งนี้ไป รพ. จะขึ้นในประวัติการรักษา</small></span><span class="switch"><input type="checkbox" name="hospital_visit" ${e.hospital_visit ? 'checked' : ''}><i></i></span></label>
      <div class="row sticky-actions">
        ${log ? `<button type="button" class="btn danger" data-act="del-care-log" data-id="${log.id}">ลบ</button>` : ''}
        <button type="button" class="btn ghost" data-act="close">ยกเลิก</button>
        <button class="btn" type="submit">บันทึก</button>
      </div>
    </form>`);
  hydrateImgs(sheet);
  const f = $('#f', sheet);
  const photos = photoField(f, e.photos);
  $$('input[name=trend]', f).forEach((r) => r.addEventListener('change', () => $('#worseTip', f).classList.toggle('hidden', r.value !== 'worse')));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    const note = fd.get('note').trim(); const trend = fd.get('trend') || null;
    if (!photos.count() && !note && !trend) return toast('ใส่รูป อาการ หรือบันทึก อย่างน้อย 1 อย่าง');
    if (log && !(await askConfirm(`ต้องการ <b>แก้ไขบันทึกอาการนี้</b> ใช่หรือไม่?<br><small class="muted">กด "ใช่ แก้ไข" เพื่อบันทึกการเปลี่ยนแปลง</small>`, 'ใช่ แก้ไข'))) return;
    const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      const hv = !!fd.get('hospital_visit');
      const data = { log_date: fd.get('log_date'), trend, note, photos: await photos.save(c.id), ...(hv || log?.hospital_visit ? { hospital_visit: hv } : {}) }; // ไม่ส่งคอลัมน์ถ้าไม่ได้ใช้ (ยังไม่รัน SQL ก็บันทึกปกติได้)
      if (log) { await DB.update('care_logs', log.id, data); Object.assign(log, data); }
      else { const row = { id: uuid(), plan_id: c.id, created_at: new Date().toISOString(), ...data }; await DB.insert('care_logs', row); S.care_logs.push(row); }
      if (photos.removed.length) DB.removeFiles(photos.removed).catch(() => {});
      closeSheet(); render(); toast('บันทึกอาการแล้ว');
    } catch (e2) {
      console.error(e2); toast('บันทึกไม่สำเร็จ: ' + e2.message); btn.disabled = false; btn.textContent = 'บันทึก';
    }
  };
}

// ---------- การกระทำ ----------
document.addEventListener('click', (ev) => {
  const img = ev.target.closest('img.zoom');
  if (img && img.src) return viewImage(img.src);
  const el = ev.target.closest('[data-act]');
  if (!el || !S) return;
  const { act, id } = el.dataset;
  const plan = () => S.care_plans.find((c) => c.id === id);
  switch (act) {
    case 'care-filter': ui.careFilter = id; render(); break;
    case 'care-of': ui.careFilter = id; go('care'); break;
    case 'add-care': if (!canUse('care')) { premiumSheet('care'); break; } careForm(); break;
    case 'edit-care': careForm(plan()); break;
    case 'care-detail': careDetail(plan()); break;
    case 'care-log': careLogForm(plan()); break;
    case 'care-log-edit': { const l = S.care_logs.find((x) => x.id === id); if (l) careLogForm(S.care_plans.find((c) => c.id === l.plan_id), l); break; }
    case 'del-care': confirmSheet('ลบการติดตามอาการนี้ พร้อมบันทึกและรูปทั้งหมด?<br><small class="muted">ถ้าหายแล้ว แนะนำเปลี่ยนสถานะเป็น "หายแล้ว" เพื่อเก็บประวัติ</small>', async () => {
      const files = S.care_logs.filter((l) => l.plan_id === id).flatMap((l) => l.photos || []);
      S.care_plans = S.care_plans.filter((c) => c.id !== id); S.care_logs = S.care_logs.filter((l) => l.plan_id !== id);
      if (await dbDo(DB.remove('care_plans', id))) DB.removeFiles(files).catch(() => {});
    }, 'ลบ'); break;
    case 'del-care-log': confirmSheet('ลบบันทึกนี้?', async () => {
      const l = S.care_logs.find((x) => x.id === id); S.care_logs = S.care_logs.filter((x) => x.id !== id);
      if (await dbDo(DB.remove('care_logs', id))) DB.removeFiles(l?.photos || []).catch(() => {});
    }, 'ลบ'); break;
  }
});
