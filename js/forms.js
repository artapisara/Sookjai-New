/* สุขใจ — ฟอร์ม (ยา / นัดหมอ / โปรไฟล์) และการกระทำต่าง ๆ */
'use strict';

// ---------- Bottom sheet ----------
function openSheet(html, cls = '') {
  const m = $('#modal'); m.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="grip"></div>${html}</div>`;
  m.classList.remove('hidden'); document.body.classList.add('noscroll');
  return $('.sheet', m);
}
function closeSheet() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; document.body.classList.remove('noscroll'); }

function confirmSheet(msg, onYes, yesLabel = 'ยืนยัน') {
  openSheet(`<h3>${msg}</h3><div class="row"><button class="btn ghost" data-act="close">ยกเลิก</button><button class="btn danger" id="yes">${yesLabel}</button></div>`);
  $('#yes').onclick = async () => { closeSheet(); await onYes(); render(); };
}

// ---------- ส่วนประกอบฟอร์ม ----------
function profileRadio(sel) {
  return `<div class="pick">${S.profiles.filter((p) => canEditProfile(p.id) || p.id === sel).map((p, i) => `<label>
    <input type="radio" name="profile_id" value="${p.id}" ${(sel ? sel === p.id : i === 0) ? 'checked' : ''} required>
    <span class="opt"><span class="av xs">${avatarSVG(p.avatar, p.color)}</span>${esc(p.name)}</span></label>`).join('')}</div>`;
}

/** select + ช่อง "อื่นๆ (พิมพ์เอง)" */
function selectOther(name, options, value, placeholder) {
  const isOther = value && !options.includes(value);
  return `<select name="${name}" data-other="${name}">
      <option value="">— ${placeholder} —</option>
      ${options.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      <option value="__other" ${isOther ? 'selected' : ''}>อื่นๆ (ระบุเอง)</option>
    </select>
    <input type="text" name="${name}_other" class="other ${isOther ? '' : 'hidden'}" value="${isOther ? esc(value) : ''}" placeholder="ระบุ…">`;
}
const readSelectOther = (fd, name) => (fd.get(name) === '__other' ? String(fd.get(`${name}_other`) || '').trim() : fd.get(name) || '');
function bindSelectOther(root) {
  $$('select[data-other]', root).forEach((s) => s.addEventListener('change', () => {
    const o = $(`input[name="${s.dataset.other}_other"]`, root); o.classList.toggle('hidden', s.value !== '__other'); if (s.value === '__other') o.focus();
  }));
}

/** ช่องกรอกแบบแท็ก (พิมพ์ได้หลายรายการ) */
function tagBox(name, values, placeholder, cls = '') {
  return `<div class="tagbox ${cls}" data-tagbox="${name}">
    ${(values || []).map((v) => `<span class="tg" data-v="${esc(v)}">${cls === 'allergy' ? '⚠️ ' : ''}${esc(v)}<button type="button" data-rm aria-label="ลบ">×</button></span>`).join('')}
    <input type="text" placeholder="${placeholder}" enterkeyhint="done"><button type="button" class="tg-add">เพิ่ม</button></div>`;
}
function bindTagBoxes(root) {
  $$('.tagbox', root).forEach((box) => {
    const input = $('input', box);
    const add = () => {
      input.value.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => {
        if ($$('.tg', box).some((t) => t.dataset.v === v)) return;
        const t = document.createElement('span'); t.className = 'tg'; t.dataset.v = v;
        t.innerHTML = `${box.classList.contains('allergy') ? '⚠️ ' : ''}${esc(v)}<button type="button" data-rm aria-label="ลบ">×</button>`;
        box.insertBefore(t, input);
      });
      input.value = '';
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } });
    input.addEventListener('blur', add);
    $('.tg-add', box).addEventListener('click', add);
    box.addEventListener('click', (e) => { if (e.target.matches('[data-rm]')) e.target.parentElement.remove(); });
  });
}
const readTagBox = (root, name) => { const box = $(`[data-tagbox="${name}"]`, root); const pending = $('input', box).value.trim(); return [...$$('.tg', box).map((t) => t.dataset.v), ...(pending ? pending.split(',').map((s) => s.trim()).filter(Boolean) : [])]; };

/** Autocomplete จากรายชื่อที่เคยกรอก */
function bindAutocomplete(input, source, onPick) {
  const wrap = input.parentElement; const list = $('.ac-list', wrap);
  const show = () => {
    const q = norm(input.value);
    const items = source().filter((it) => !q || norm(it.label).includes(q)).slice(0, 6);
    if (!items.length || (items.length === 1 && norm(items[0].label) === q)) { list.classList.add('hidden'); return; }
    list.innerHTML = items.map((it, i) => `<button type="button" data-i="${i}"><b>${esc(it.label)}</b>${it.sub ? `<span>${esc(it.sub)}</span>` : ''}</button>`).join('');
    list.classList.remove('hidden');
    $$('button', list).forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); const it = items[b.dataset.i]; input.value = it.label; list.classList.add('hidden'); onPick && onPick(it);
    }));
  };
  input.addEventListener('input', show); input.addEventListener('focus', show);
  input.addEventListener('blur', () => setTimeout(() => list.classList.add('hidden'), 120));
}
const acField = (name, value, placeholder) => `<div class="ac"><input type="text" name="${name}" value="${esc(value)}" placeholder="${placeholder}" autocomplete="off"><div class="ac-list hidden"></div></div>`;

// ---------- ฟอร์มยา ----------
function allergyNote(pid) {
  const p = profileById(pid);
  return p.drug_allergies?.length ? `<div class="alert red"><div class="ic">⚠️</div><div><b>${esc(p.name)} แพ้ยา</b><div class="tags">${tagList(p.drug_allergies, 'allergy')}</div></div></div>` : '';
}

function medForm(m) {
  if (!S.profiles.length) { toast('เพิ่มคนในครอบครัวก่อนนะ'); return go('family'); }
  const e = m || { profile_id: ui.tab === 'meds' ? ui.medsPerson : (ui.filter !== 'all' ? ui.filter : null), slots: ['after_breakfast'], slot_reminders: {}, dose: 1, stock: 30, status: 'active' };
  if (!m && e.profile_id && !canEditProfile(e.profile_id)) e.profile_id = null;
  const pid0 = e.profile_id || (S.profiles.find((p) => canEditProfile(p.id)) || S.profiles[0]).id;
  e.profile_id = pid0;
  const sheet = openSheet(`<h3>${m ? 'แก้ไขยา' : 'เพิ่มยา'}</h3>
    <form id="f">
      <label class="f"><span>ยาของใคร</span>${profileRadio(e.profile_id)}</label>
      <div id="allergyBox">${allergyNote(pid0)}</div>
      <label class="f"><span>ชื่อยา</span><input type="text" name="name" required value="${esc(e.name)}" placeholder="เช่น Amlodipine 5 mg"></label>
      <label class="f"><span>รักษาโรคอะไร</span><input type="text" name="purpose" value="${esc(e.purpose)}" placeholder="เช่น ความดันโลหิตสูง"></label>
      <label class="f"><span>เลขลำดับยา <small>(เรียงต่อเนื่องของคนนี้ · อักษรนำ "<b id="noPrefix">${esc(medPrefix(pid0))}</b>")</small></span>
        <input type="number" name="sort_order" min="1" step="1" inputmode="numeric" required value="${e.sort_order || nextNoFor(pid0)}"></label>
      <div class="two">
        <label class="f"><span>จำนวนต่อครั้ง</span><input type="number" name="dose" min="0" step="0.25" inputmode="decimal" value="${num(e.dose, 1)}"></label>
        <div class="f"><span class="lbl">หน่วย</span>${selectOther('unit', UNITS, unitOf(e), 'เลือกหน่วย')}</div>
      </div>
      <label class="f"><span>จำนวนคงเหลือ <small>(นับวันยาหมดให้อัตโนมัติ)</small></span><input type="number" name="stock" min="0" step="0.25" inputmode="decimal" value="${num(e.stock)}">
        <small class="small muted" id="runout"></small></label>
      <div class="f"><span class="lbl">ช่วงเวลาทานยา <small>(เลือกได้หลายช่วง · 🔔 = เตือนช่วงนั้น)</small></span>
        <div class="slot-pick">${SLOTS.map((s) => {
          const on = e.slots.includes(s.key);
          return `<div class="slot-row ${on ? 'on' : ''}">
            <label class="slot-main"><input type="checkbox" name="slots" value="${s.key}" ${on ? 'checked' : ''}><span class="si">${s.icon}</span><span>${s.label}<small>${slotTime(s.key)} น.</small></span></label>
            <label class="switch sm" title="แจ้งเตือน"><input type="checkbox" name="remind_${s.key}" ${on && e.slot_reminders?.[s.key] !== false ? 'checked' : ''} ${on ? '' : 'disabled'}><i></i></label>
          </div>`;
        }).join('')}</div>
      </div>
      ${m ? `<div class="f"><span class="lbl">สถานะ</span>
        <div class="seg">${Object.entries(MED_STATUS).map(([k, v]) => `<label><input type="radio" name="status" value="${k}" ${m.status === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>
        <input type="text" name="status_reason" class="${m.status === 'active' ? 'hidden' : ''}" style="margin-top:8px" value="${esc(m.status_reason)}" placeholder="เหตุผล เช่น หมอสั่งงด, แพ้ยา, หายแล้ว">
        ${(m.status_history || []).length ? `<div class="hist">${m.status_history.slice().reverse().map((h) => `${thDate(h.date)} · ${MED_STATUS[h.status] || h.status}${h.reason ? ' — ' + esc(h.reason) : ''}`).join('<br>')}</div>` : ''}
      </div>` : ''}
      <label class="f"><span>หมายเหตุ</span><textarea name="note" placeholder="เช่น ห้ามทานพร้อมนม">${esc(e.note)}</textarea></label>
      <div class="sep"><b>แสดงในตารางหน้า "วันนี้"</b></div>
      <label class="f"><span>คำกำกับใต้เลข (สั้น ๆ)</span><input type="text" name="table_hint" value="${esc(e.table_hint)}" placeholder="เช่น ขับลม (เคี้ยว) / หลังอาหารทันที"></label>
      <label class="f"><span>ข้อควรระวัง (ถ้ามี จะขึ้น ⚠️)</span><input type="text" name="warning" value="${esc(e.warning)}" placeholder="เช่น พบแพทย์หากคลื่นไส้หรือหอบเหนื่อย"></label>
      <label class="switch-row"><span>กินเฉพาะเมื่อมีอาการ</span><span class="switch"><input type="checkbox" name="as_needed" ${e.as_needed ? 'checked' : ''}><i></i></span></label>
      ${m ? `<p class="small muted">อัปเดตล่าสุด ${thDate(String(m.updated_at).slice(0, 10))} (อัตโนมัติ)</p>` : ''}
      <div class="row sticky-actions">
        ${m ? `<button type="button" class="btn danger" data-act="del-med" data-id="${m.id}">ลบ</button>` : ''}
        <button type="button" class="btn ghost" data-act="close">ยกเลิก</button>
        <button class="btn" type="submit">บันทึก</button>
      </div>
    </form>`);
  const f = $('#f', sheet);
  bindSelectOther(f);
  const noIn = $('input[name=sort_order]', f); let noTouched = !!m;
  noIn.addEventListener('input', () => { noTouched = true; });
  $$('input[name=profile_id]', f).forEach((r) => r.addEventListener('change', () => {
    $('#allergyBox', f).innerHTML = allergyNote(r.value);
    $('#noPrefix', f).textContent = medPrefix(r.value);
    if (!noTouched) noIn.value = m && m.profile_id === r.value ? m.sort_order : nextNoFor(r.value);
  }));
  // คำนวณวันยาหมดจากจำนวนคงเหลือ ÷ (จำนวนต่อครั้ง × จำนวนช่วงที่กิน)
  const syncRunout = () => {
    const fd = new FormData(f); const unit = readSelectOther(fd, 'unit') || 'เม็ด';
    const perDay = fd.getAll('slots').length * num(fd.get('dose'), 1); const stock = num(fd.get('stock'));
    const el = $('#runout', f);
    if (!STOCK_UNITS.includes(unit)) { el.textContent = `หน่วย "${unit}" ไม่นับวันยาหมด`; return; }
    if (fd.get('as_needed') || !perDay) { el.textContent = 'ไม่ได้กินประจำวัน จึงไม่คำนวณวันยาหมด'; return; }
    const d = Math.floor(stock / perDay);
    el.textContent = `กินวันละ ${num(perDay)} ${unit} → พอใช้อีก ${d} วัน (หมดประมาณ ${thDate(dk(addDays(new Date(), d)))})`;
    el.classList.toggle('red-t', d <= LOW_STOCK_DAYS);
  };
  f.addEventListener('input', syncRunout); f.addEventListener('change', syncRunout); syncRunout();
  $$('input[name=slots]', f).forEach((c) => c.addEventListener('change', () => {
    const sw = $(`input[name=remind_${c.value}]`, f); sw.disabled = !c.checked; sw.checked = c.checked; c.closest('.slot-row').classList.toggle('on', c.checked);
  }));
  $$('input[name=status]', f).forEach((r) => r.addEventListener('change', () => $('input[name=status_reason]', f).classList.toggle('hidden', r.value === 'active')));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    const slots = fd.getAll('slots');
    if (!slots.length) return toast('เลือกช่วงเวลาทานยาอย่างน้อย 1 ช่วง');
    const pid = fd.get('profile_id');
    const sortNo = Math.max(1, Math.round(num(fd.get('sort_order'), 1)));
    const clash = S.medications.find((x) => x.id !== m?.id && x.profile_id === pid && x.sort_order === sortNo);
    if (clash) return toast(`เลข ${medPrefix(pid)}${sortNo} เป็นของยา ${clash.name} แล้ว — ใช้เลขอื่น หรือกด "จัดลำดับยา" ในหน้ายา`);
    const unit = String(readSelectOther(fd, 'unit') || 'เม็ด').trim().slice(0, 20) || 'เม็ด';
    const data = {
      profile_id: pid, sort_order: sortNo, no_pending: false, name: fd.get('name').trim(), purpose: fd.get('purpose').trim(),
      dose: num(fd.get('dose'), 1), unit, stock: num(fd.get('stock')), slots: SLOTS.map((s) => s.key).filter((k) => slots.includes(k)),
      slot_reminders: Object.fromEntries(slots.map((k) => [k, !!fd.get(`remind_${k}`)])),
      note: fd.get('note').trim(), updated_at: new Date().toISOString(),
      table_hint: String(fd.get('table_hint') || '').trim(), warning: String(fd.get('warning') || '').trim(), as_needed: !!fd.get('as_needed'),
    };
    if (m) {
      const status = fd.get('status'); const reason = String(fd.get('status_reason') || '').trim();
      if (status !== m.status || (status !== 'active' && reason !== (m.status_reason || ''))) {
        data.status = status; data.status_reason = status === 'active' ? '' : reason;
        data.status_history = [...(m.status_history || []), { date: todayKey(), status, reason }];
      }
      Object.assign(m, data); closeSheet(); render();
      if (await dbDo(DB.update('medications', m.id, data))) toast('บันทึกแล้ว');
    } else {
      const row = { id: uuid(), status: 'active', status_reason: '', status_history: [{ date: todayKey(), status: 'active', reason: 'เริ่มทานยา' }], ...data };
      S.medications.push(row); ui.medsPerson = pid; closeSheet(); render();
      if (await dbDo(DB.insert('medications', row))) toast('เพิ่มยาแล้ว');
    }
  };
}

// ---------- ฟอร์มนัดหมอ (ฟอร์มเดียวของทั้งแอพ) ----------
async function resolveHospital(name, phone) {
  name = String(name || '').trim(); phone = String(phone || '').trim();
  if (!name) return null;
  const h = S.hospitals.find((x) => norm(x.name) === norm(name));
  if (h) { if (phone && phone !== h.phone) { h.phone = phone; await DB.update('hospitals', h.id, { phone }); } return h.id; }
  const row = { id: uuid(), name, phone }; await DB.insert('hospitals', row); S.hospitals.push(row); return row.id;
}
async function resolveDoctor(name, department, hospital_id) {
  name = String(name || '').trim();
  if (!name) return null;
  const d = S.doctors.find((x) => norm(x.name) === norm(name));
  if (d) {
    const patch = {}; if (department && department !== d.department) patch.department = department; if (hospital_id && hospital_id !== d.hospital_id) patch.hospital_id = hospital_id;
    if (Object.keys(patch).length) { Object.assign(d, patch); await DB.update('doctors', d.id, patch); }
    return d.id;
  }
  const row = { id: uuid(), name, department, hospital_id }; await DB.insert('doctors', row); S.doctors.push(row); return row.id;
}

function apptForm(a, date, pid) {
  if (!S.profiles.length) { toast('เพิ่มคนในครอบครัวก่อนนะ'); return go('family'); }
  const e = a || { appt_date: date || todayKey(), appt_time: '09:00', attachments: [], profile_id: pid || (ui.calPeople?.size === 1 ? [...ui.calPeople][0] : null) };
  const h0 = hospitalById(e.hospital_id); const d0 = doctorById(e.doctor_id);
  let keep = [...(e.attachments || [])]; const removed = []; const pending = [];
  const sheet = openSheet(`<h3>${a ? 'แก้ไขนัดหมอ' : 'เพิ่มนัดหมอ'}</h3>
    <form id="f">
      <label class="f"><span>1. นัดของใคร</span>${profileRadio(e.profile_id)}</label>
      <label class="f"><span>2. แผนกที่นัด</span>${selectOther('department', DEPARTMENTS, e.department, 'เลือกแผนก')}</label>
      <div class="two">
        <label class="f"><span>3. วันที่นัด</span><input type="date" name="appt_date" required value="${e.appt_date}"></label>
        <label class="f"><span>เวลานัด</span><input type="time" name="appt_time" required value="${hhmm(e.appt_time)}"></label>
      </div>
      <label class="f"><span>4. ชื่อหมอ</span>${acField('doctor_name', d0?.name, 'พิมพ์เพื่อค้นหาชื่อที่เคยกรอก')}</label>
      <label class="f"><span>5. โรงพยาบาล</span>${acField('hospital_name', h0?.name, 'พิมพ์เพื่อค้นหาชื่อที่เคยกรอก')}</label>
      <label class="f"><span>เบอร์โทรโรงพยาบาล</span><div class="phone-row"><input type="tel" name="hospital_phone" inputmode="tel" value="${esc(h0?.phone)}" placeholder="เช่น 02-419-7000">
        <a class="btn call ${h0?.phone ? '' : 'disabled'}" id="callBtn" href="${h0?.phone ? telHref(h0.phone) : '#'}">📞 โทร</a></div></label>
      <label class="f"><span>6. ตึก/ชั้นที่ตรวจ</span><input type="text" name="building" value="${esc(e.building)}" placeholder="เช่น ตึกผู้ป่วยนอก ชั้น 3"></label>
      <label class="f"><span>7. สาเหตุที่มาพบแพทย์</span>${selectOther('visit_reason', VISIT_REASONS, e.visit_reason, 'เลือกสาเหตุ')}</label>
      <label class="f"><span>8. หมายเหตุ</span><textarea name="note" placeholder="เช่น เจาะเลือดต้องงดอาหาร">${esc(e.note)}</textarea></label>
      <div class="f"><span class="lbl">9. แนบรูปภาพ (ใบนัด/เอกสาร)</span>
        <div class="thumbs" id="thumbs"></div>
        <label class="btn ghost block filebtn">📎 เลือกรูป / ถ่ายรูป<input type="file" accept="image/*" multiple id="fileIn" hidden></label>
        <p class="small muted" id="photoNote" style="margin:6px 0 0"></p>
      </div>
      <p class="small muted">🔔 ระบบจะเตือนล่วงหน้า 5, 2 และ 1 วัน พร้อมหมายเหตุ</p>
      <div class="row sticky-actions">
        ${a ? `<button type="button" class="btn danger" data-act="del-appt" data-id="${a.id}">ลบ</button>` : ''}
        <button type="button" class="btn ghost" data-act="close">ยกเลิก</button>
        <button class="btn" type="submit">บันทึก</button>
      </div>
    </form>`);
  const f = $('#f', sheet);
  bindSelectOther(f);
  const phoneIn = $('input[name=hospital_phone]', f); const callBtn = $('#callBtn', f);
  const syncCall = () => { const ok = phoneIn.value.trim(); callBtn.classList.toggle('disabled', !ok); callBtn.href = ok ? telHref(ok) : '#'; };
  phoneIn.addEventListener('input', syncCall);
  callBtn.addEventListener('click', (ev) => { if (callBtn.classList.contains('disabled')) ev.preventDefault(); });
  const hosIn = $('input[name=hospital_name]', f); const docIn = $('input[name=doctor_name]', f); const depSel = $('select[name=department]', f);

  bindAutocomplete(hosIn, () => S.hospitals.map((h) => ({ label: h.name, sub: h.phone ? '📞 ' + h.phone : '', h })), (it) => { phoneIn.value = it.h.phone || ''; syncCall(); });
  hosIn.addEventListener('change', () => { const h = S.hospitals.find((x) => norm(x.name) === norm(hosIn.value)); if (h && !phoneIn.value) { phoneIn.value = h.phone || ''; syncCall(); } });
  bindAutocomplete(docIn, () => S.doctors.map((d) => ({ label: d.name, sub: [d.department, hospitalById(d.hospital_id)?.name].filter(Boolean).join(' · '), d })), (it) => {
    if (!depSel.value && it.d.department) {
      if (DEPARTMENTS.includes(it.d.department)) depSel.value = it.d.department;
      else { depSel.value = '__other'; const o = $('input[name=department_other]', f); o.value = it.d.department; o.classList.remove('hidden'); }
    }
    const h = hospitalById(it.d.hospital_id);
    if (h && !hosIn.value) { hosIn.value = h.name; phoneIn.value = h.phone || ''; syncCall(); }
  });

  const thumbs = $('#thumbs', f);
  const drawThumbs = async () => {
    const urls = await Promise.all(keep.map((p) => DB.fileUrl(p).catch(() => '')));
    thumbs.innerHTML = keep.map((p, i) => `<div class="thumb"><img src="${urls[i]}" alt=""><button type="button" data-rm-keep="${i}">×</button></div>`).join('')
      + pending.map((file, i) => `<div class="thumb new"><img src="${file.url}" alt=""><button type="button" data-rm-new="${i}">×</button></div>`).join('');
  };
  thumbs.addEventListener('click', (ev) => {
    const k = ev.target.dataset.rmKeep, n = ev.target.dataset.rmNew;
    if (k !== undefined) { removed.push(keep[k]); keep.splice(k, 1); drawThumbs(); }
    if (n !== undefined) { URL.revokeObjectURL(pending[n].url); pending.splice(n, 1); drawThumbs(); }
  });
  const photoNote = $('#photoNote', f);
  const syncPhotoNote = () => { const n = keep.length + pending.length; photoNote.textContent = `แนบได้สูงสุด ${MAX_APPT_PHOTOS} ภาพต่อ 1 นัด (ตอนนี้ ${n}/${MAX_APPT_PHOTOS})`; photoNote.classList.toggle('red-t', n >= MAX_APPT_PHOTOS); };
  $('#fileIn', f).addEventListener('change', (ev) => {
    const room = Math.max(0, MAX_APPT_PHOTOS - keep.length - pending.length);
    const files = [...ev.target.files];
    files.slice(0, room).forEach((file) => pending.push({ file, url: URL.createObjectURL(file) }));
    if (files.length > room) toast(`แนบได้สูงสุด ${MAX_APPT_PHOTOS} ภาพต่อ 1 นัด — ลบรูปเดิมก่อนถ้าอยากเปลี่ยน`);
    ev.target.value = ''; drawThumbs(); syncPhotoNote();
  });
  thumbs.addEventListener('click', syncPhotoNote);
  syncPhotoNote();
  drawThumbs();

  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      const department = readSelectOther(fd, 'department');
      const hospital_id = await resolveHospital(fd.get('hospital_name'), fd.get('hospital_phone'));
      const doctor_id = await resolveDoctor(fd.get('doctor_name'), department, hospital_id);
      const id = a ? a.id : uuid();
      const uploaded = [];
      for (const p of pending) uploaded.push(await DB.upload(p.file, id));
      const data = {
        profile_id: fd.get('profile_id'), department, appt_date: fd.get('appt_date'), appt_time: fd.get('appt_time'),
        doctor_id, hospital_id, building: fd.get('building').trim(), visit_reason: readSelectOther(fd, 'visit_reason'),
        note: fd.get('note').trim(), attachments: [...keep, ...uploaded],
      };
      if (a) { await DB.update('appointments', id, data); Object.assign(a, data); }
      else { await DB.insert('appointments', { id, ...data }); S.appointments.push({ id, ...data }); }
      if (removed.length) DB.removeFiles(removed).catch(() => {});
      ui.calSel = data.appt_date; const d = parseDk(data.appt_date); ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      closeSheet(); render(); toast('บันทึกนัดแล้ว');
    } catch (e) {
      console.error(e); toast('บันทึกไม่สำเร็จ: ' + e.message); btn.disabled = false; btn.textContent = 'บันทึก';
    }
  };
}

/** รายละเอียดนัด — อ่านจากข้อมูลชุดเดียวกับปฏิทินและการแจ้งเตือน */
function apptMessage(a, n) {
  const p = profileById(a.profile_id); const d = doctorById(a.doctor_id); const h = hospitalById(a.hospital_id);
  return {
    title: `🩺 ${p.name} นัดหมอ${whenText(n)}`,
    body: `${thDate(a.appt_date)} ${hhmm(a.appt_time)} น. · ${a.department || ''}${d ? ' · ' + d.name : ''}${h ? ' · ' + h.name : ''}${a.building ? ' (' + a.building + ')' : ''}${a.note ? '\n📝 ' + a.note : ''}`,
  };
}

async function apptDetail(a) {
  const p = profileById(a.profile_id); const d = doctorById(a.doctor_id); const h = hospitalById(a.hospital_id); const n = daysUntil(a.appt_date);
  const row = (k, v) => (v ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : '');
  const sheet = openSheet(`
    <div class="detail-head" style="--pc:${p.color}">${avatarHtml(p, 'lg')}<div>
      <div class="small muted">นัดของ</div><h3 style="margin:0">${esc(p.name)}</h3>
      ${n >= 0 ? `<span class="countdown ${n <= 1 ? 'hot' : ''}">${whenText(n)}</span>` : '<span class="small muted">ผ่านมาแล้ว</span>'}</div></div>
    <div class="big-when"><b>${thDate(a.appt_date, 'long')}</b><span>เวลา ${hhmm(a.appt_time)} น.</span></div>
    <div class="card flat">
      ${row('แผนก', esc(a.department))}
      ${row('หมอ', esc(d?.name))}
      ${row('โรงพยาบาล', esc(h?.name))}
      ${row('ตึก/ชั้น', esc(a.building))}
      ${row('สาเหตุ', esc(a.visit_reason))}
    </div>
    ${h?.phone ? `<a class="btn block call" href="${telHref(h.phone)}">📞 โทรหา${esc(h.name)} (${esc(h.phone)})</a>` : ''}
    ${a.note ? `<div class="alert sun" style="margin-top:12px"><div class="ic">📝</div><div><b>หมายเหตุ</b><span>${esc(a.note)}</span></div></div>` : ''}
    ${p.drug_allergies?.length ? `<div class="alert red"><div class="ic">⚠️</div><div><b>แพ้ยา</b><div class="tags">${tagList(p.drug_allergies, 'allergy')}</div></div></div>` : ''}
    ${(a.attachments || []).length ? `<h4>รูปที่แนบ</h4><div class="thumbs" id="dThumbs">${a.attachments.map(() => '<div class="thumb loading"></div>').join('')}</div>` : ''}
    <h4>กำหนดการแจ้งเตือน</h4>
    <div class="card flat small">${REMIND_DAYS.map((k) => {
      const day = dk(addDays(parseDk(a.appt_date), -k)); const passed = day < todayKey();
      return `<div class="kv"><span>${k} วันก่อน</span><b class="${passed ? 'muted' : ''}">${thDate(day)} ${passed ? '(ผ่านแล้ว)' : '🔔'}</b></div>`;
    }).join('')}
      <div class="preview"><b>${esc(apptMessage(a, Math.max(1, Math.min(n, 5))).title)}</b><br>${esc(apptMessage(a, 1).body).replace(/\n/g, '<br>')}</div>
    </div>
    <div class="row sticky-actions"><button class="btn ghost" data-act="close">ปิด</button><button class="btn" data-act="edit-appt" data-id="${a.id}">✏️ แก้ไข</button></div>
  `);
  if ((a.attachments || []).length) {
    const urls = await Promise.all(a.attachments.map((x) => DB.fileUrl(x).catch(() => '')));
    const box = $('#dThumbs', sheet); if (!box) return;
    box.innerHTML = urls.map((u) => `<button class="thumb" data-view="${esc(u)}"><img src="${esc(u)}" alt="ใบนัด"></button>`).join('');
    box.addEventListener('click', (ev) => { const b = ev.target.closest('[data-view]'); if (b) viewImage(b.dataset.view); });
  }
}
/** รูปใบนัดทั้งหมดของคนหนึ่งคน — รวมจากนัดหมอ (รูปยังเก็บไว้กับนัดแต่ละนัดเหมือนเดิม) */
function slipsSheet(pid) {
  const p = profileById(pid);
  const mine = S.appointments.filter((a) => a.profile_id === pid);
  const list = [ // นัดที่กำลังจะถึง (ใกล้สุดก่อน) แล้วตามด้วยนัดที่ผ่านมาแล้ว (ล่าสุดก่อน)
    ...mine.filter((a) => daysUntil(a.appt_date) >= 0).sort((a, b) => a.appt_date.localeCompare(b.appt_date)),
    ...mine.filter((a) => daysUntil(a.appt_date) < 0).sort((a, b) => b.appt_date.localeCompare(a.appt_date)),
  ];
  const sheet = openSheet(`
    <div class="detail-head" style="--pc:${p.color}">${avatarHtml(p, 'lg')}<div><div class="small muted">ใบนัด/เอกสารของ</div><h3 style="margin:0">${esc(p.name)}</h3></div></div>
    <button class="btn block" data-act="add-appt" data-pid="${pid}">📷 เพิ่มนัดใหม่พร้อมรูปใบนัด</button>
    ${list.map((a) => { const h = hospitalById(a.hospital_id); const n = daysUntil(a.appt_date);
      return `<div class="slip">
        <button class="slip-head" data-act="appt-detail" data-id="${a.id}">
          <b>${thDate(a.appt_date)} · ${hhmm(a.appt_time)} น.</b>${n >= 0 ? `<span class="countdown ${n <= 1 ? 'hot' : ''}">${whenText(n)}</span>` : ''}
          <span class="small muted">${esc(departmentOf(a))}${h ? ' · ' + esc(h.name) : ''}</span></button>
        ${a.attachments?.length
          ? `<div class="thumbs">${a.attachments.map((x) => `<div class="thumb"><img class="zoom" data-path="${esc(x)}" alt="ใบนัด"></div>`).join('')}</div>`
          : `<button class="btn ghost sm" data-act="edit-appt" data-id="${a.id}">📎 แนบรูปใบนัด</button>`}
      </div>`; }).join('') || '<div class="card flat empty small">ยังไม่มีนัดหมอ</div>'}
    <div class="row sticky-actions"><button class="btn ghost" data-act="close">ปิด</button></div>`);
  hydrateImgs(sheet);
}

function viewImage(src) {
  const lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = `<img src="${esc(src)}" alt=""><button aria-label="ปิด">×</button>`;
  lb.onclick = () => lb.remove(); document.body.appendChild(lb);
}

// ---------- ฟอร์มโปรไฟล์ ----------
function avatarPicker(sel, color) {
  return AV_AGES.map(([age, ageL]) => `<div class="av-group"><small>${ageL}</small><div class="pick av-pick">
    ${AV_GENDERS.flatMap(([g]) => AV_POSES.map(([pose, poseL]) => { const id = `${g}-${age}-${pose}`;
      return `<label title="${poseL}"><input type="radio" name="avatar" value="${id}" ${id === sel ? 'checked' : ''}><span class="opt av-opt">${avatarSVG(id, color)}</span></label>`; })).join('')}
  </div></div>`).join('');
}

function personForm(p, preset = {}) {
  const e = p || { color: PRESET_COLORS[S.profiles.length % PRESET_COLORS.length], avatar: 'f-elder-smile', reminder_enabled: true, chronic_diseases: [], drug_allergies: [], ...preset };
  const relOther = e.relation && !RELATIONS.includes(e.relation);
  let avatarTouched = !!p;
  const sheet = openSheet(`<h3>${p ? 'แก้ไขโปรไฟล์' : 'เพิ่มคนในครอบครัว'}</h3>
    <form id="f">
      <div class="detail-head" id="pvHead">${avatarHtml(e, 'lg')}<div><b id="pvName">${esc(e.name || 'ชื่อเรียก')}</b><div class="small muted" id="pvRel">${esc(e.relation || '')}</div></div></div>
      <label class="f"><span>ชื่อเล่น/ชื่อเรียก</span><input type="text" name="name" required value="${esc(e.name)}" placeholder="เช่น ย่าปลา, ปู่เค็ม"></label>
      <label class="f"><span>สถานะ/ความสัมพันธ์</span>${selectOther('relation', RELATIONS, relOther ? e.relation : e.relation, 'เลือกความสัมพันธ์')}</label>
      <div class="two">
        <label class="f"><span>ปีเกิด (พ.ศ. หรือ ค.ศ.)</span><input type="number" name="birth_year" inputmode="numeric" min="1900" max="2700" value="${e.birth_year ? e.birth_year + 543 : ''}" placeholder="เช่น 2490"></label>
        <div class="f"><span class="lbl">กรุ๊ปเลือด</span><div class="pick">${BLOOD_TYPES.map((b) => `<label><input type="radio" name="blood_type" value="${b}" ${e.blood_type === b ? 'checked' : ''}><span class="opt blood">${b}</span></label>`).join('')}</div></div>
      </div>
      <div class="f"><span class="lbl">สีประจำตัว (ใช้ในหน้าหมอนัด)</span><div class="pick colors">
        ${PRESET_COLORS.map((c) => `<label><input type="radio" name="color_p" value="${c}" ${c === e.color ? 'checked' : ''}><span class="opt sw" style="background:${c}"></span></label>`).join('')}
        <label class="custom-color" title="เลือกสีเอง"><input type="color" name="color" value="${e.color}"><span>🎨 เลือกเอง</span></label>
      </div></div>
      <div class="f"><span class="lbl">ไอคอน</span><div id="avPick">${avatarPicker(e.avatar, e.color)}</div></div>
      <div class="three">
        <label class="f"><span>น้ำหนัก (กก.)</span><input type="number" name="weight_kg" min="0" max="400" step="0.1" inputmode="decimal" value="${e.weight_kg ?? ''}" placeholder="เช่น 58"></label>
        <label class="f"><span>ส่วนสูง (ซม.)</span><input type="number" name="height_cm" min="0" max="250" step="0.1" inputmode="decimal" value="${e.height_cm ?? ''}" placeholder="เช่น 160"></label>
        <label class="f"><span>รอบเอว (ซม.)</span><input type="number" name="waist_cm" min="0" max="250" step="0.1" inputmode="decimal" value="${e.waist_cm ?? ''}" placeholder="เช่น 80"></label>
      </div>
      <label class="f"><span>อักษรนำเลขลำดับยา <small>(เช่น "ป" → ป1 ป2 ป3 · เว้นว่าง = ใช้ตัวแรกของชื่อ)</small></span><input type="text" name="med_prefix" maxlength="3" value="${esc(e.med_prefix ?? '')}" placeholder="${esc(defaultPrefix(e.name) || 'ป')}"></label>
      <div class="f"><span class="lbl">โรคประจำตัว</span>${tagBox('chronic_diseases', e.chronic_diseases, 'พิมพ์แล้วกด เพิ่ม')}</div>
      <div class="f"><span class="lbl red-t">⚠️ แพ้ยา</span>${tagBox('drug_allergies', e.drug_allergies, 'เช่น Penicillin', 'allergy')}</div>
      <label class="switch-row card flat"><span>🔔 แจ้งเตือนกินยาของคนนี้</span><span class="switch"><input type="checkbox" name="reminder_enabled" ${e.reminder_enabled ? 'checked' : ''}><i></i></span></label>
      <div class="row sticky-actions">
        ${p ? `<button type="button" class="btn danger" data-act="del-person" data-id="${p.id}">ลบ</button>` : ''}
        <button type="button" class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" type="submit">บันทึก</button>
      </div>
    </form>`);
  const f = $('#f', sheet);
  bindSelectOther(f); bindTagBoxes(f);
  const colorIn = $('input[name=color]', f);
  const curAvatar = () => $('input[name=avatar]:checked', f)?.value || e.avatar;
  const refresh = () => {
    const c = colorIn.value; const id = curAvatar();
    $('#avPick', f).innerHTML = avatarPicker(id, c);
    $('#pvHead .av', f).innerHTML = avatarSVG(id, c);
  };
  $$('input[name=color_p]', f).forEach((r) => r.addEventListener('change', () => { colorIn.value = r.value; refresh(); }));
  colorIn.addEventListener('input', () => { $$('input[name=color_p]', f).forEach((r) => (r.checked = r.value.toLowerCase() === colorIn.value.toLowerCase())); refresh(); });
  $('#avPick', f).addEventListener('change', () => { avatarTouched = true; $('#pvHead .av', f).innerHTML = avatarSVG(curAvatar(), colorIn.value); });
  $('input[name=name]', f).addEventListener('input', (ev) => ($('#pvName', f).textContent = ev.target.value || 'ชื่อเรียก'));
  $('select[name=relation]', f).addEventListener('change', (ev) => {
    $('#pvRel', f).textContent = ev.target.value === '__other' ? '' : ev.target.value;
    const guess = avatarForRelation(ev.target.value);
    if (!avatarTouched && guess) { const r = $(`input[name=avatar][value="${guess}"]`, f); if (r) { r.checked = true; refresh(); } }
  });
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    let by = parseInt(fd.get('birth_year'), 10); if (by > 2400) by -= 543; // แปลง พ.ศ. → ค.ศ.
    const data = {
      name: fd.get('name').trim(), relation: readSelectOther(fd, 'relation'), birth_year: Number.isFinite(by) ? by : null,
      blood_type: fd.get('blood_type') || null, color: colorIn.value, avatar: curAvatar(),
      chronic_diseases: readTagBox(f, 'chronic_diseases'), drug_allergies: readTagBox(f, 'drug_allergies'),
      reminder_enabled: !!fd.get('reminder_enabled'),
      weight_kg: numOrNull(fd.get('weight_kg')), height_cm: numOrNull(fd.get('height_cm')), waist_cm: numOrNull(fd.get('waist_cm')),
      med_prefix: String(fd.get('med_prefix') || '').trim() || null,
    };
    if (p) { Object.assign(p, data); closeSheet(); render(); if (await dbDo(DB.update('profiles', p.id, data))) toast('บันทึกแล้ว'); }
    else { const row = { id: uuid(), ...data }; S.profiles.push(row); closeSheet(); render(); if (await dbDo(DB.insert('profiles', row))) toast('เพิ่มแล้ว'); }
  };
}

// ---------- การกระทำ ----------
async function toggleTake(medId, slot) {
  const m = S.medications.find((x) => x.id === medId); if (!m) return;
  const log = takenLog(medId, slot);
  if (log) {
    S.med_logs = S.med_logs.filter((l) => l !== log); m.stock = num(m.stock) + num(m.dose, 1); render();
    await dbDo(Promise.all([DB.remove('med_logs', log.id), DB.update('medications', m.id, { stock: m.stock })]));
  } else {
    const row = { id: uuid(), medication_id: medId, log_date: todayKey(), slot, taken_at: new Date().toISOString() };
    S.med_logs.push(row); m.stock = Math.max(0, num(m.stock) - num(m.dose, 1)); render();
    toast(`✓ ${profileById(m.profile_id).name} ทาน ${m.name} แล้ว`);
    await dbDo(Promise.all([DB.insert('med_logs', row), DB.update('medications', m.id, { stock: m.stock })]));
  }
}

document.addEventListener('click', async (ev) => {
  if (ev.target.id === 'modal') return closeSheet();
  const el = ev.target.closest('[data-act], [data-tab]');
  if (!el || !S) return;
  if (el.dataset.tab) return go(el.dataset.tab);
  const { act, id } = el.dataset;
  const appt = () => S.appointments.find((a) => a.id === id);
  switch (act) {
    case 'filter': ui.filter = id; render(); break;
    case 'meds-person': ui.medsPerson = id; render(); break;
    case 'cal-person': {
      if (id === 'all') ui.calPeople = null;
      else {
        const s = ui.calPeople ? new Set(ui.calPeople) : new Set();
        s.has(id) ? s.delete(id) : s.add(id);
        ui.calPeople = s.size === 0 || s.size === S.profiles.length ? null : s;
      }
      render(); break;
    }
    case 'take': toggleTake(id, el.dataset.slot); break;
    case 'add-med': medForm(); break;
    case 'edit-med': medForm(S.medications.find((m) => m.id === id)); break;
    case 'del-med': confirmSheet('ลบยานี้ถาวร?<br><small class="muted">ถ้าแค่เลิกทาน แนะนำเปลี่ยนสถานะเป็น "หยุดแล้ว" เพื่อเก็บประวัติ</small>', async () => {
      S.medications = S.medications.filter((m) => m.id !== id); S.med_logs = S.med_logs.filter((l) => l.medication_id !== id); await dbDo(DB.remove('medications', id));
    }, 'ลบ'); break;
    case 'add-appt': apptForm(null, id, el.dataset.pid); break;
    case 'slips': slipsSheet(id); break;
    case 'appt-detail': apptDetail(appt()); break;
    case 'edit-appt': apptForm(appt()); break;
    case 'del-appt': confirmSheet('ลบนัดนี้?', async () => {
      const a = appt(); S.appointments = S.appointments.filter((x) => x.id !== id);
      if (await dbDo(DB.remove('appointments', id))) DB.removeFiles(a.attachments || []).catch(() => {});
    }, 'ลบ'); break;
    case 'sel-day': ui.calSel = id; render(); break;
    case 'cal-prev': ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() - 1, 1); render(); break;
    case 'cal-next': ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + 1, 1); render(); break;
    case 'cal-today': { const d = new Date(); ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); ui.calSel = todayKey(); render(); break; }
    case 'add-person': personForm(); break;
    case 'edit-person': if (!ownsProfile(id)) { toast('ข้อมูลส่วนตัวนี้แก้ได้เฉพาะเจ้าของ — คุณดูยา นัด และการติดตามอาการได้จากปุ่มด้านล่าง'); break; } personForm(S.profiles.find((p) => p.id === id)); break;
    case 'new-circle': circleForm(); break;
    case 'manage-circle': { const c = S.circles.find((x) => x.id === id); if (c && c.user_id === DB.user.id) circleForm(c); break; }
    case 'del-circle': confirmSheet('ลบกลุ่มผู้ดูแลนี้?<br><small class="muted">สมาชิกทุกคนจะไม่เห็นข้อมูลที่แชร์อีก (ข้อมูลของคุณไม่ถูกลบ)</small>', async () => {
      S.circles = S.circles.filter((x) => x.id !== id);
      S.circle_members = S.circle_members.filter((m) => m.circle_id !== id);
      S.circle_care_for = S.circle_care_for.filter((ccf) => ccf.circle_id !== id);
      if (await dbDo(DB.remove('circles', id))) render();
    }, 'ลบ'); break;
    case 'leave-circle': confirmSheet('ออกจากกลุ่มนี้?<br><small class="muted">คุณจะไม่เห็นข้อมูลที่กลุ่มนี้แชร์อีก</small>', async () => {
      const m = S.circle_members.find((cm) => cm.circle_id === id && cm.user_id === DB.user.id);
      if (m && await dbDo(DB.remove('circle_members', m.id))) await reload();
    }, 'ออกจากกลุ่ม'); break;
    case 'rm-member': {
      const m = S.circle_members.find((x) => x.id === id); if (!m) break;
      const c = S.circles.find((x) => x.id === m.circle_id);
      confirmSheet(`ลบ ${esc(m.email || 'สมาชิกคนนี้')} ออกจากกลุ่ม?<br><small class="muted">เขาจะไม่เห็นข้อมูลที่กลุ่มนี้แชร์อีก · เชิญกลับได้ภายหลัง</small>`, async () => {
        S.circle_members = S.circle_members.filter((x) => x.id !== id);
        if (await dbDo(DB.remove('circle_members', id))) { toast('ลบสมาชิกแล้ว'); if (c) setTimeout(() => circleForm(c), 0); }
      }, 'ลบสมาชิก');
      break;
    }
    case 'locked-tick': toast('ช่วงนี้กินครบแล้ว ล็อกไว้กันกดพลาด — แตะ 🔒 ที่หัวตารางเพื่อปลดล็อก'); break;
    case 'unlock-slot': {
      const p = profileById(id); const s = slotOf(el.dataset.slot);
      confirmSheet(`ปลดล็อกช่วง "${esc(s.label)}" ของ${esc(p.name)}?<br><small class="muted">ใช้เมื่อติ๊กผิดและต้องการแก้ไข</small>`, async () => { ui.unlocked[`${id}:${s.key}:${todayKey()}`] = true; }, 'ปลดล็อก');
      break;
    }
    case 'reorder-meds': reorderMedsSheet(id); break;
    case 'reorder-people': reorderPeopleSheet(); break;
    case 'mfa-settings': mfaSettingsSheet(); break;
    case 'privacy': privacySheet(); break;
    case 'today-visibility': openSheet(`<h3>แสดงตารางของใครบ้าง</h3>
      <p class="small muted">เลือกเฉพาะคนที่อยากเห็นในหน้า "วันนี้" ตั้งได้เฉพาะบัญชีของคุณ ไม่กระทบคนอื่นในกลุ่ม</p>
      ${S.profiles.map((p) => `<label class="switch-row card"><span class="vis-who">${avatarHtml(p, 'xs')}<b>${esc(p.name)}</b></span>
        <span class="switch"><input type="checkbox" data-today-toggle="${p.id}" ${todayHidden().includes(p.id) ? '' : 'checked'}><i></i></span></label>`).join('')}
      <div class="row"><button class="btn" data-act="close">เสร็จแล้ว</button></div>`); break;
    case 'slot-name': toast(el.dataset.label); break;
    case 'change-password': passwordForm(false); break;
    case 'add-contact': contactForm(); break;
    case 'del-contact': confirmSheet('ลบเบอร์นี้?', async () => {
      S.emergency_contacts = S.emergency_contacts.filter((x) => x.id !== id);
      await dbDo(DB.remove('emergency_contacts', id));
    }, 'ลบ'); break;
    case 'rm-invite': {
      const inv = S.circle_invites.find((i) => i.id === id);
      S.circle_invites = S.circle_invites.filter((i) => i.id !== id);
      await dbDo(DB.remove('circle_invites', id));
      const c = inv && S.circles.find((x) => x.id === inv.circle_id);
      closeSheet(); if (c) circleForm(c); render(); break;
    }
    case 'decline-invite': {
      S.circle_invites = S.circle_invites.filter((i) => i.id !== id);
      if (await dbDo(DB.remove('circle_invites', id))) render(); break;
    }
    case 'accept-invite': {
      const inv = S.circle_invites.find((i) => i.id === id); if (!inv) break;
      const ok = await dbDo(DB.insert('circle_members', { id: uuid(), circle_id: inv.circle_id, user_id: DB.user.id, role: inv.role, email: DB.user.email || inv.email }));
      if (ok) { await dbDo(DB.remove('circle_invites', id)); toast('เข้าร่วมกลุ่มแล้ว'); await reload(); }
      break;
    }
    case 'del-person': confirmSheet('ลบคนนี้ พร้อมยา นัด และการติดตามอาการทั้งหมด?', async () => {
      const planIds = S.care_plans.filter((c) => c.profile_id === id).map((c) => c.id);
      const files = [...S.appointments.filter((a) => a.profile_id === id).flatMap((a) => a.attachments || []),
        ...S.care_logs.filter((l) => planIds.includes(l.plan_id)).flatMap((l) => l.photos || [])];
      S.care_plans = S.care_plans.filter((c) => c.profile_id !== id); S.care_logs = S.care_logs.filter((l) => !planIds.includes(l.plan_id));
      if (ui.careFilter === id) ui.careFilter = 'all';
      S.profiles = S.profiles.filter((p) => p.id !== id);
      const medIds = S.medications.filter((m) => m.profile_id === id).map((m) => m.id);
      S.medications = S.medications.filter((m) => m.profile_id !== id); S.med_logs = S.med_logs.filter((l) => !medIds.includes(l.medication_id));
      S.appointments = S.appointments.filter((a) => a.profile_id !== id);
      if (ui.filter === id) ui.filter = 'all';
      if (await dbDo(DB.remove('profiles', id))) DB.removeFiles(files).catch(() => {});
    }, 'ลบ'); break;
    case 'close': closeSheet(); break;
    case 'enable-push': Notifier.enable(); break;
    case 'test-push': Notifier.test(); break;
    case 'logout': confirmSheet('ออกจากระบบ?', async () => { closeSheet(); Notifier.stop(); await DB.signOut(); location.reload(); }, 'ออกจากระบบ'); break;
    case 'demo': confirmSheet('แทนที่ข้อมูลในเครื่องด้วยข้อมูลตัวอย่าง?', async () => { DB.reset(true); S = await DB.loadAll(); ui.filter = 'all'; }); break;
    case 'wipe': confirmSheet('ล้างข้อมูลทั้งหมดในเครื่องนี้? ย้อนกลับไม่ได้', async () => { DB.reset(false); S = await DB.loadAll(); ui.filter = 'all'; }, 'ล้างข้อมูล'); break;
  }
});

// ---------- เปลี่ยนรหัสผ่าน (ตอนล็อกอินอยู่ หรือหลังกดลิงก์ "ลืมรหัสผ่าน" จากอีเมล) ----------
function passwordForm(recovery) {
  const sheet = openSheet(`<h3>${recovery ? 'ตั้งรหัสผ่านใหม่' : 'เปลี่ยนรหัสผ่าน'}</h3>
    ${recovery ? '<p class="small muted">ยืนยันตัวตนด้วยลิงก์ในอีเมลแล้ว ตั้งรหัสผ่านใหม่ได้เลย</p>' : ''}
    <form id="f">
      <label class="f"><span>รหัสผ่านใหม่ <small>(อย่างน้อย 6 ตัวอักษร)</small></span><input type="password" name="pw1" required minlength="6" autocomplete="new-password"></label>
      <label class="f"><span>พิมพ์รหัสผ่านใหม่อีกครั้ง</span><input type="password" name="pw2" required minlength="6" autocomplete="new-password"></label>
      <p class="small red-t hidden" id="pwErr"></p>
      <div class="row"><button type="button" class="btn ghost" data-act="close">${recovery ? 'ไว้ก่อน' : 'ยกเลิก'}</button><button class="btn" type="submit">บันทึกรหัสผ่านใหม่</button></div>
    </form>`);
  const f = $('#f', sheet); const err = $('#pwErr', f);
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f); const pw = String(fd.get('pw1'));
    const fail = (m) => { err.textContent = m; err.classList.remove('hidden'); };
    if (pw.length < 6) return fail('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    if (pw !== fd.get('pw2')) return fail('รหัสผ่านสองช่องไม่ตรงกัน');
    const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try { await DB.updatePassword(pw); closeSheet(); toast('✓ เปลี่ยนรหัสผ่านแล้ว'); }
    catch (e) { btn.disabled = false; btn.textContent = 'บันทึกรหัสผ่านใหม่'; fail(/same|different/i.test(e.message) ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม' : e.message); }
  };
}

// ---------- นำเข้าข้อมูล (ไฟล์ .json ของสุขใจ: โปรไฟล์ + ยา) เข้าบัญชีที่ล็อกอินอยู่ ----------
async function importFile(file) {
  let data; try { data = JSON.parse(await file.text()); } catch { return toast('อ่านไฟล์ไม่ได้ — ต้องเป็นไฟล์ .json'); }
  if (data?.app !== 'sukjai-import' || !Array.isArray(data.profiles) || !Array.isArray(data.medications)) return toast('นี่ไม่ใช่ไฟล์นำเข้าของสุขใจ');
  const have = new Set(S.profiles.map((p) => p.name.trim()));
  const dups = data.profiles.filter((p) => have.has(String(p.name).trim())).map((p) => p.name);
  const sheet = openSheet(`<h3>นำเข้าข้อมูล</h3>
    <div class="card flat">${data.profiles.map((p) => `<div class="kv"><span>${esc(p.name)}</span><b>${data.medications.filter((m) => m.profile_key === p.key).length} ยา</b></div>`).join('')}</div>
    ${dups.length ? `<div class="alert sun"><div class="ic">⚠️</div><div><b>มีชื่อนี้อยู่แล้วในบัญชี</b><span class="small">${dups.map(esc).join(', ')} — ถ้านำเข้าจะได้คนซ้ำ ควรยกเลิกหรือลบของเดิมก่อน</span></div></div>` : ''}
    <p class="small muted">จะสร้างโปรไฟล์และรายการยาใหม่ในบัญชีของคุณ (ไม่ลบหรือแก้ข้อมูลเดิม)</p>
    <div class="row"><button class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" id="doImport">นำเข้า</button></div>`);
  $('#doImport', sheet).onclick = async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'กำลังนำเข้า…';
    const now = new Date().toISOString(); const ids = {}; let nm = 0;
    const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
    try {
      for (const p of data.profiles) {
        ids[p.key] = uuid();
        const row = { id: ids[p.key], chronic_diseases: [], drug_allergies: [], reminder_enabled: false, ...pick(p, ['name', 'relation', 'birth_year', 'blood_type', 'color', 'avatar']) };
        await DB.insert('profiles', row); S.profiles.push(row);
      }
      for (const m of data.medications) {
        if (!ids[m.profile_key]) continue;
        const row = { id: uuid(), profile_id: ids[m.profile_key], status: 'active', status_reason: '', status_history: [], updated_at: now,
          ...pick(m, ['name', 'purpose', 'slots', 'slot_reminders', 'dose', 'unit', 'stock', 'sort_order', 'status', 'status_reason', 'status_history', 'note', 'table_hint', 'warning', 'as_needed', 'no_pending']) };
        await DB.insert('medications', row); S.medications.push(row); nm++;
      }
      closeSheet(); render(); toast(`✓ นำเข้า ${data.profiles.length} คน ${nm} ยาแล้ว`);
    } catch (e) { console.error(e); closeSheet(); await reload(); toast('นำเข้าไม่สำเร็จ: ' + e.message); }
  };
}

// ---------- เบอร์โทรฉุกเฉิน (เพิ่มเอง) ----------
function contactForm() {
  const sheet = openSheet(`<h3>เพิ่มเบอร์โรงพยาบาล</h3>
    <form id="f">
      <label class="f"><span>ชื่อ</span><input type="text" name="name" required placeholder="เช่น โรงพยาบาลศิริราช (ห้องฉุกเฉิน)"></label>
      <label class="f"><span>เบอร์โทร</span><input type="tel" name="phone" required inputmode="tel" placeholder="เช่น 02-419-7000"></label>
      <div class="row"><button type="button" class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" type="submit">บันทึก</button></div>
    </form>`);
  $('#f', sheet).onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const phone = String(fd.get('phone')).trim();
    if (!/\d{3,}/.test(phone.replace(/\D/g, ''))) return toast('เบอร์โทรไม่ถูกต้อง');
    const row = { id: uuid(), name: String(fd.get('name')).trim(), phone, created_at: new Date().toISOString() };
    S.emergency_contacts = S.emergency_contacts || [];
    S.emergency_contacts.push(row); closeSheet(); render();
    if (await dbDo(DB.insert('emergency_contacts', row))) toast('เพิ่มเบอร์แล้ว');
  };
}

// ---------- ฟอร์มกลุ่มผู้ดูแล (Circles) ----------
const roleLabel = (r) => (r === 'owner' ? 'เจ้าของกลุ่ม' : r === 'viewer' ? 'ดูอย่างเดียว' : 'แก้ไขได้');
function circleForm(c) {
  const e = c || { name: '', description: '' };
  const isNew = !c;
  const careFor = S.circle_care_for?.filter((cf) => cf.circle_id === c?.id) || [];
  const members = isNew ? [] : S.circle_members.filter((m) => m.circle_id === c.id)
    .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : String(a.joined_at).localeCompare(String(b.joined_at))));
  const mine = S.profiles.filter((p) => ownsProfile(p.id));
  const sheet = openSheet(`<h3>${isNew ? 'สร้างกลุ่มผู้ดูแล' : 'จัดการกลุ่มผู้ดูแล'}</h3>
    <form id="f">
      <label class="f"><span>ชื่อกลุ่ม</span><input type="text" name="name" required value="${esc(e.name)}" placeholder="เช่น กลุ่มดูแลปู่ย่า"></label>
      <label class="f"><span>คำอธิบาย (เพิ่มเติม)</span><textarea name="description" placeholder="เช่น ลูกหลานที่ช่วยกันดูแลปู่ย่า">${esc(e.description)}</textarea></label>

      <div class="sep"><b>คนที่จะแชร์ข้อมูลในกลุ่มนี้</b></div>
      <div class="care-for-select">
        ${mine.map((p) => {
          const isSelected = careFor.some((cf) => cf.profile_id === p.id);
          return `<label class="care-for-item"><input type="checkbox" name="care_for" value="${p.id}" ${isSelected ? 'checked' : ''}><span class="av">${avatarSVG(p.avatar, p.color)}</span><span>${esc(p.name)}</span></label>`;
        }).join('') || '<p class="small muted">ยังไม่มีคนในครอบครัวที่เป็นของคุณ</p>'}
      </div>

      <div class="sep"><b>เชิญสมาชิกเข้ากลุ่ม</b></div>
      <label class="f"><span>อีเมลของคนที่จะเชิญ</span><input type="email" name="member_email" placeholder="yourname@example.com" autocomplete="off"></label>
      <label class="f"><span>สิทธิ์</span><select name="member_role"><option value="member">แก้ไขข้อมูลได้</option><option value="viewer">ดูอย่างเดียว</option></select></label>
      <p class="small muted">คนที่ถูกเชิญต้องสมัครและเข้าสู่ระบบด้วยอีเมลนี้ แล้วกด "รับคำเชิญ" ในหน้าครอบครัว</p>
      ${isNew ? '' : `<div class="sep"><b>คำเชิญที่รอตอบรับ</b></div>
        ${(S.circle_invites || []).filter((i) => i.circle_id === c.id).map((i) => `<div class="member-item"><span class="inv-mail">${esc(i.email)}</span><span class="inv-right"><span class="role">${roleLabel(i.role)}</span><button type="button" class="inv-cancel" data-act="rm-invite" data-id="${i.id}">ยกเลิก</button></span></div>`).join('') || '<p class="small muted">ไม่มีคำเชิญที่ค้างอยู่</p>'}
        <div class="sep"><b>สมาชิกในกลุ่ม (${members.length} คน)</b></div>
        <div class="members-list">${members.map((m) => {
          const who = m.user_id === DB.user.id ? 'ฉัน' : (m.email || 'สมาชิก (ไม่ทราบอีเมล)');
          if (m.role === 'owner') return `<div class="member-item"><span class="inv-mail">${esc(who)}</span><span class="role">${roleLabel(m.role)}</span></div>`;
          return `<div class="member-item"><span class="inv-mail">${esc(who)}</span><span class="inv-right">
            <select data-member-role="${m.id}" aria-label="สิทธิ์ของ ${esc(who)}"><option value="member" ${m.role === 'member' ? 'selected' : ''}>แก้ไขได้</option><option value="viewer" ${m.role === 'viewer' ? 'selected' : ''}>ดูอย่างเดียว</option></select>
            <button type="button" class="inv-cancel" data-act="rm-member" data-id="${m.id}">ลบ</button></span></div>`;
        }).join('')}</div>
        <p class="small muted">เปลี่ยนสิทธิ์ได้ทันที เช่น จาก "แก้ไขได้" เป็น "ดูอย่างเดียว" — มีผลครั้งถัดไปที่สมาชิกคนนั้นเปิดแอพ</p>`}

      <div class="row">${isNew ? '' : `<button type="button" class="btn danger" data-act="del-circle" data-id="${c.id}">ลบกลุ่ม</button>`}<button type="button" class="btn ghost" data-act="close">ยกเลิก</button><button type="submit" class="btn">${isNew ? 'สร้าง' : 'บันทึก'}</button></div>
    </form>
  `);
  sheet.querySelector('form').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const careForIds = fd.getAll('care_for');
    const data = { name: String(fd.get('name')).trim(), description: String(fd.get('description') || '').trim() };
    const now = new Date().toISOString();
    S.circle_care_for = S.circle_care_for || [];
    const circleId = isNew ? uuid() : c.id;
    if (isNew) {
      const row = { id: circleId, user_id: DB.user.id, ...data, created_at: now };
      S.circles.push(row);
      S.circle_members.push({ id: uuid(), circle_id: circleId, user_id: DB.user.id, role: 'owner', email: DB.user.email || null, joined_at: now });
      if (await dbDo(DB.insert('circles', row))) await dbDo(DB.insert('circle_members', S.circle_members.at(-1)));
    } else {
      Object.assign(c, data);
      await dbDo(DB.update('circles', c.id, data));
    }
    const before = S.circle_care_for.filter((cf) => cf.circle_id === circleId);
    for (const cf of before.filter((x) => !careForIds.includes(x.profile_id))) {
      S.circle_care_for = S.circle_care_for.filter((x) => x.id !== cf.id);
      await dbDo(DB.remove('circle_care_for', cf.id));
    }
    for (const pid of careForIds.filter((p) => !before.some((x) => x.profile_id === p))) {
      const row = { id: uuid(), circle_id: circleId, profile_id: pid, added_at: now };
      S.circle_care_for.push(row);
      await dbDo(DB.insert('circle_care_for', row));
    }
    const email = String(fd.get('member_email') || '').trim().toLowerCase();
    S.circle_invites = S.circle_invites || [];
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) toast('อีเมลไม่ถูกต้อง เชิญไม่สำเร็จ');
      else if (email === String(DB.user.email || '').toLowerCase()) toast('นี่คืออีเมลของคุณเอง');
      else if (S.circle_invites.some((i) => i.circle_id === circleId && i.email === email)) toast('เชิญอีเมลนี้ไปแล้ว');
      else if (S.circle_members.some((m) => m.circle_id === circleId && String(m.email || '').toLowerCase() === email)) toast('อีเมลนี้เป็นสมาชิกในกลุ่มแล้ว');
      else {
        const inv = { id: uuid(), circle_id: circleId, circle_name: data.name, email, role: fd.get('member_role') === 'viewer' ? 'viewer' : 'member', created_at: now };
        S.circle_invites.push(inv);
        if (await dbDo(DB.insert('circle_invites', inv))) toast(`ส่งคำเชิญถึง ${email} แล้ว`);
      }
    }
    closeSheet();
    render();
  };
}

document.addEventListener('change', async (ev) => {
  const t = ev.target; if (!S) return;
  if (t.dataset.import !== undefined) { const file = t.files[0]; t.value = ''; if (file) await importFile(file); return; }
  if (t.dataset.memberRole) {
    const m = S.circle_members.find((x) => x.id === t.dataset.memberRole); if (!m) return;
    const role = t.value === 'viewer' ? 'viewer' : 'member';
    m.role = role;
    if (await dbDo(DB.update('circle_members', m.id, { role }))) toast(`เปลี่ยนสิทธิ์ของ ${m.email || 'สมาชิก'} เป็น "${roleLabel(role)}" แล้ว`);
    return;
  }
  if (t.dataset.todayToggle) {
    const id = t.dataset.todayToggle;
    const hidden = new Set(todayHidden()); if (t.checked) hidden.delete(id); else hidden.add(id);
    S.settings.today_hidden = [...hidden];
    render();
    await dbDo(DB.saveSettings(S.settings));
    return;
  }
  const slotKey = t.dataset.slotHh || t.dataset.slotMm;
  if (slotKey) {
    const box = t.closest('.t24');
    S.settings.slot_times[slotKey] = `${$('[data-slot-hh]', box).value}:${$('[data-slot-mm]', box).value}`;
    if (await dbDo(DB.saveSettings(S.settings))) toast('บันทึกเวลาแล้ว');
  }
  if (t.dataset.slotTime) {
    S.settings.slot_times[t.dataset.slotTime] = t.value;
    if (await dbDo(DB.saveSettings(S.settings))) toast('บันทึกเวลาแล้ว');
  }
  if (t.dataset.toggleReminder) {
    const p = S.profiles.find((x) => x.id === t.dataset.toggleReminder);
    p.reminder_enabled = t.checked;
    if (await dbDo(DB.update('profiles', p.id, { reminder_enabled: p.reminder_enabled }))) toast(p.reminder_enabled ? `เปิดเตือนกินยาของ${p.name}` : `ปิดเตือนกินยาของ${p.name}`);
  }
});
document.addEventListener('toggle', (ev) => {
  const d = ev.target; if (d.dataset?.legend) { ui.legendOpen = ui.legendOpen || {}; ui.legendOpen[d.dataset.legend] = d.open; }
}, true);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeSheet(); });
