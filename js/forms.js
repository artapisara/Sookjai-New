/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
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
    ${(values || []).map((v) => `<span class="tg" data-v="${esc(v)}">${esc(v)}<button type="button" data-rm aria-label="ลบ">×</button></span>`).join('')}
    <input type="text" placeholder="${placeholder}" enterkeyhint="done"><button type="button" class="tg-add">เพิ่ม</button></div>`;
}
function bindTagBoxes(root) {
  $$('.tagbox', root).forEach((box) => {
    const input = $('input', box);
    const add = () => {
      input.value.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => {
        if ($$('.tg', box).some((t) => t.dataset.v === v)) return;
        const t = document.createElement('span'); t.className = 'tg'; t.dataset.v = v;
        t.innerHTML = `${esc(v)}<button type="button" data-rm aria-label="ลบ">×</button>`;
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
  return p.drug_allergies?.length ? `<div class="alert red"><div class="ic">⚠️</div><div class="al-inline"><b>${esc(p.name)} แพ้ยา</b>${tagList(p.drug_allergies, 'allergy')}</div></div>` : '';
}

// หมายเหตุ + ข้อควรระวัง รวมเป็นช่องเดียว (เก็บในคอลัมน์ warning) — ส่วน "เก็บในที่ทึบแสง" คงไว้ใน note เหมือนเดิม
const noteParts = (m) => String(m?.note || '').split(/\s*(?:·|\n)\s*/).map((x) => x.trim()).filter(Boolean);
const keptNote = (m) => noteParts(m).filter((x) => /ทึบแสง/.test(x)).join(' · ');
function mergedRemark(e) {
  const out = []; [String(e.warning || '').trim(), ...noteParts(e).filter((x) => !/ทึบแสง/.test(x))].forEach((t) => { if (t && !out.some((o) => o.includes(t))) out.push(t); });
  return out.join('\n');
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
      <div class="name-row"><label class="f"><span>ชื่อยา <b class="req" aria-hidden="true">*</b></span><input type="text" name="name" required value="${esc(e.name)}" placeholder="เช่น Amlodipine 5 mg"></label><button type="button" class="st-chip st-${e.status}" id="stBtn" aria-expanded="false">${MED_STATUS[e.status]} ▾</button></div>
      ${true ? `<div class="f st-panel pn-${e.status}" id="stPanel" hidden><span class="lbl">สถานะของยา</span>
        <div class="seg">${Object.entries(MED_STATUS).map(([k, v]) => `<label><input type="radio" name="status" value="${k}" ${e.status === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>
        <input type="text" name="status_reason" class="${e.status === 'active' ? 'hidden' : ''}" style="margin-top:8px" value="${esc(e.status_reason)}" placeholder="เหตุผล เช่น หมอสั่งงด, แพ้ยา, หายแล้ว">
        ${(m?.status_history || []).length ? `<div class="hist">${m.status_history.slice().reverse().map((h) => `${thDate(h.date)} · ${MED_STATUS[h.status] || h.status}${h.reason ? ' — ' + esc(h.reason) : ''}`).join('<br>')}</div>` : ''}
</div>` : ''}

      <div class="two">
        <label class="f"><span>ครั้งละกี่เม็ด</span><input type="number" name="dose" min="0" step="0.25" inputmode="decimal" value="${num(e.dose, 1)}"></label>
        <div class="f"><span class="lbl">หน่วย</span>${selectOther('unit', UNITS, unitOf(e), 'เลือกหน่วย')}</div>
      </div>
      <div class="two dose-row2"><div class="f"><span class="dose-quick" role="group" aria-label="เลือกจำนวนที่ใช้บ่อย">${[0.25, 0.5, 1, 2].map((d) => `<button type="button" data-dose-set="${d}">${doseLabel(d)}</button>`).join('')}</span><details class="every-box"><summary>ทานทุก .... ชั่วโมง</summary><div class="every-in"><span class="lbl">ทุก <input type="number" id="evHours" class="ev-in" min="1" max="24" step="1" inputmode="numeric" placeholder="8"> ชั่วโมง</span>
        <span class="lbl">เริ่มต้นกินยา <select id="evHH">${Array.from({ length: 24 }, (_, i) => `<option ${i === 6 ? 'selected' : ''}>${pad(i)}</option>`).join('')}</select><b>:</b><select id="evMM"><option>00</option><option>15</option><option>30</option><option>45</option></select> น.</span>
        <div class="every-row"><button type="button" class="btn sm" id="evGo">คำนวณเวลา</button></div>
        <small class="small muted" id="evNote"></small></div></details></div>      <label class="f stock-box"><span>มีกี่เม็ด <small>(ใช้นับวันยาหมด)</small></span><input type="number" name="stock" min="0" step="0.25" inputmode="decimal" value="${num(e.stock)}"></label></div>
      <div class="f slot-box"><span class="lbl">ช่วงเวลาทานยา <b class="req" aria-hidden="true">*</b> <small class="slot-hint">ระบุเวลา ไปที่ <b>ตั้งค่า › กำหนดช่วงเวลาทานยา</b></small></span>
        <div class="slot-pick">${SLOTS.map((s) => {
          const on = e.slots.includes(s.key);
          return `<div class="slot-row ${on ? 'on' : ''} ${s.key === 'bedtime' ? 'slot-bed' : ''}">
            <label class="slot-main"><input type="checkbox" name="slots" value="${s.key}" ${on ? 'checked' : ''}><span class="si">${s.icon}</span><span>${s.key === 'bedtime' ? s.label : s.label.replace(/^(ก่อน|หลัง)/, '<u class="sl-kw">$1</u>')}</span></label>
                      </div>`;
        }).join('')}</div>
      </div>
      <div class="two sw-pair"><label class="switch-row wd-sw"><span>ทานเฉพาะบางวัน<small class="small muted" style="display:block">(เช่น สัปดาห์ละ 1 ครั้ง หรือ 2 ครั้ง)</small></span><span class="switch"><input type="checkbox" id="wdOn" ${e.weekdays?.length ? 'checked' : ''}><i></i></span></label><label class="switch-row asn-box"><span>ทานยาเฉพาะเมื่อมีอาการ<small class="small muted" style="display:block">(ไม่นำไปคำนวณเม็ดยาที่เหลือ)</small></span><span class="switch"><input type="checkbox" name="as_needed" ${e.as_needed ? 'checked' : ''}><i></i></span></label></div>
      <div class="f wd-box ${e.weekdays?.length ? '' : 'hidden'}" id="wdBox"><span class="lbl">เลือกวันที่ต้องทาน <small>(เลือกได้หลายวัน)</small></span>
        <div class="wd-pick">${WD_SHORT.map((d, i) => `<label><input type="checkbox" name="wd" value="${i}" ${e.weekdays?.includes(i) ? 'checked' : ''}><span>${d}</span></label>`).join('')}</div></div>
      <div class="purpose-row"><label class="f"><span>รักษาโรคอะไร <b class="req" aria-hidden="true">*</b></span><input type="text" name="purpose" required value="${esc(e.purpose)}" placeholder="เช่น ความดันโลหิตสูง"></label><label class="opq-box"><input type="checkbox" name="opaque" ${/ทึบแสง/.test(e.note || '') ? 'checked' : ''}><span>เก็บยาในที่ทึบแสง</span></label></div>
      <label class="f warn-box"><span>หมายเหตุ / ข้อควรระวัง <small>ที่ระบุไว้บนซองยาที่จ่ายโดยแพทย์</small></span><textarea name="warning" rows="3" placeholder="เช่น เก็บยาในที่ทึบแสง · กินเฉพาะเวลานอนไม่หลับ">${esc(mergedRemark(e))}</textarea></label>
      <label class="f extra-box"><span>บันทึกเพิ่มเติม</span><textarea name="extra_note" rows="3" maxlength="1000" placeholder="เช่น กินยาตัวนี้แล้วยังปวดขาอยู่">${esc(e.extra_note)}</textarea></label>
      <label class="f"><span>แพทย์ที่จ่ายยา <small>(ไม่บังคับ)</small></span><input type="text" name="prescriber" list="docList" maxlength="120" value="${esc(e.prescriber)}" placeholder="ชื่อแพทย์"><datalist id="docList">${S.doctors.map((d) => `<option value="${esc(d.name)}">`).join('')}</datalist></label>
      <div class="f"><span class="lbl">แผนกที่จ่ายยา <small>(ไม่บังคับ)</small></span>${selectOther('prescribed_dept', DEPARTMENTS, e.prescribed_dept, 'เลือกแผนก')}</div>
      <label class="f"><span>รหัสยา <small>(เรียงต่อเนื่องของคนนี้ · อักษรนำ "<b id="noPrefix">${esc(medPrefix(pid0))}</b>")</small></span>
        <input type="number" name="sort_order" min="1" step="1" inputmode="numeric" required value="${e.sort_order || nextNoFor(pid0)}"></label>
            ${m ? `<p class="small muted">อัปเดตล่าสุด ${thDateTime(m.updated_at)} (อัตโนมัติ)</p>` : ''}
      <div class="row sticky-actions">
        ${m ? `<button type="button" class="btn danger ${delLocked() ? 'locked' : ''}" data-act="del-med" data-id="${m.id}">${delLocked() ? '🔒 ' : ''}ลบ</button>` : ''}
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
  $$('input[name=slots]', f).forEach((c) => c.addEventListener('change', () => { c.closest('.slot-row').classList.toggle('on', c.checked); }));
  const calcEvery = (silent) => {
    const h = Number($('#evHours', f).value); const sh = Number($('#evHH', f).value), sm = Number($('#evMM', f).value); if (!h || h < 1 || h > 24) { if (!silent) toast('กรอกจำนวนชั่วโมงก่อน'); $('#evNote', f).textContent = ''; return; } const toMin = (s) => { const [a, b] = String(s).split(':').map(Number); return a * 60 + b; };
    const dist = (x, y) => { const d = Math.abs(x - y) % 1440; return Math.min(d, 1440 - d); };
    const used = new Set(); const rows = [];
    for (let i = 0; i < 24 / h; i++) {
      const t = (sh * 60 + sm + i * h * 60) % 1440;
      const best = SLOTS.filter((s) => !used.has(s.key)).sort((a, b) => dist(toMin(slotTime(a.key)), t) - dist(toMin(slotTime(b.key)), t))[0];
      if (best) { used.add(best.key); rows.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)} → ${best.short}`); }
    }
    $$('input[name=slots]', f).forEach((c) => { const on = used.has(c.value); if (c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change', { bubbles: true })); } });
    $('#evNote', f).textContent = `คำนวณแล้ว :
${rows.join('\n')}`;
  };
  $('#evGo', f).addEventListener('click', () => calcEvery(false));
  $('#wdOn', f).addEventListener('change', (ev) => { $('#wdBox', f).classList.toggle('hidden', !ev.target.checked); if (!ev.target.checked) $$('input[name=wd]', f).forEach((c) => (c.checked = false)); });
  $$('input[name=status]', f).forEach((r) => r.addEventListener('change', () => $('input[name=status_reason]', f).classList.toggle('hidden', r.value === 'active')));
  { const sb = $('#stBtn', f), sp = $('#stPanel', f); if (sb && sp) {
    sb.addEventListener('click', () => { sp.hidden = !sp.hidden; sb.setAttribute('aria-expanded', String(!sp.hidden)); });
    $$('input[name=status]', f).forEach((r) => r.addEventListener('change', () => { sb.textContent = MED_STATUS[r.value] + ' ▾'; sb.className = 'st-chip st-' + r.value; sp.className = 'f st-panel pn-' + r.value; }));
  } }
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    const slots = fd.getAll('slots');
    if (!String(fd.get('name') || '').trim()) { toast('กรอกชื่อยาก่อนนะ'); return f.elements.name.focus(); }
    if (!String(fd.get('purpose') || '').trim()) { toast('กรอกว่ายานี้รักษาโรคอะไร'); return f.elements.purpose.focus(); }
    if (!slots.length) { const box = $('.slot-pick', f); box.classList.add('need'); box.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => box.classList.remove('need'), 2500); return toast('เลือกช่วงเวลาทานยาอย่างน้อย 1 ช่วง'); }
    const pid = fd.get('profile_id');
    // โควตายา (Free: ยาที่ "กำลังทาน" ต่อโปรไฟล์) — เช็กตอนเพิ่มยาใหม่ และตอนเปลี่ยนสถานะกลับเป็น "กำลังทาน"/ย้ายไปโปรไฟล์อื่น · หน้าต่างซ้อนทับฟอร์ม ข้อมูลที่กรอกไม่หาย · แก้ไข/เปลี่ยนชื่อ/หยุดทาน/ลบ ทำได้เสมอ
    if ((fd.get('status') || 'active') === 'active' && (!m || m.status !== 'active' || m.profile_id !== pid) && !canUse('meds', { pid, exceptId: m?.id })) { await limitDialog('meds'); return; }
    if (m && !(await askConfirm(`ต้องการ <b>แก้ไขข้อมูลยา "${esc(m.name)}"</b> ใช่หรือไม่?<br><small class="muted">กด "ใช่ แก้ไข" เพื่อบันทึกการเปลี่ยนแปลง</small>`, 'ใช่ แก้ไข'))) return;
    const sortNo = Math.max(1, Math.round(num(fd.get('sort_order'), 1)));
    const clash = S.medications.find((x) => x.id !== m?.id && x.profile_id === pid && x.sort_order === sortNo);
    if (clash) return toast(`รหัส ${medPrefix(pid)}${sortNo} เป็นของยา ${clash.name} แล้ว — ใช้รหัสอื่น`);
    const wd = $('#wdOn', f).checked ? fd.getAll('wd').map(Number).filter((n) => n >= 0 && n <= 6) : [];
    if ($('#wdOn', f).checked && !wd.length) return toast('เลือกวันที่ต้องทานอย่างน้อย 1 วัน หรือปิดสวิตช์');
    const unit = String(readSelectOther(fd, 'unit') || 'เม็ด').trim().slice(0, 20) || 'เม็ด';
    const data = {
      profile_id: pid, sort_order: sortNo, no_pending: false, name: fd.get('name').trim(), purpose: fd.get('purpose').trim(),
      ...(String(fd.get('prescriber') || '').trim() || m?.prescriber ? { prescriber: String(fd.get('prescriber') || '').trim() } : {}),
      ...(String(readSelectOther(fd, 'prescribed_dept') || '').trim() || m?.prescribed_dept ? { prescribed_dept: String(readSelectOther(fd, 'prescribed_dept') || '').trim() } : {}), // ไม่ส่งคอลัมน์ถ้าไม่ได้ใช้ (ยังไม่รัน SQL ก็บันทึกยาปกติได้)
      dose: num(fd.get('dose'), 1), unit, stock: num(fd.get('stock')), ...(m && num(fd.get('stock')) !== num(m.stock) ? { stock_at: todayKey() } : {}), // เริ่มนับจำนวนคงเหลือใหม่จากวันที่แก้ตัวเลข
      slots: SLOTS.map((s) => s.key).filter((k) => slots.includes(k)),
      slot_reminders: Object.fromEntries(slots.map((k) => [k, m?.slot_reminders?.[k] !== false])), // เปิด/ปิดที่ ตั้งค่า > การแจ้งเตือน (ช่วงใหม่ = เปิด)
      note: fd.get('opaque') ? 'เก็บในที่ทึบแสง' : '', updated_at: new Date().toISOString(),
      ...(wd.length || m?.weekdays?.length ? { weekdays: wd.length === 7 ? [] : wd } : {}), // ไม่ส่งคอลัมน์ถ้าไม่ได้ใช้ (ยังไม่รัน SQL ก็บันทึกยาปกติได้)
      warning: String(fd.get('warning') || '').trim(), as_needed: !!fd.get('as_needed'),
      ...(String(fd.get('extra_note') || '').trim() || m?.extra_note ? { extra_note: String(fd.get('extra_note') || '').trim() } : {}), // ไม่ส่งคอลัมน์ถ้าไม่ได้ใช้ (ยังไม่รัน SQL ก็บันทึกยาปกติได้)
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
      const st0 = fd.get('status') || 'active'; const rs0 = st0 === 'active' ? '' : String(fd.get('status_reason') || '').trim();
      const row = { id: uuid(), status: st0, status_reason: rs0, status_history: [{ date: todayKey(), status: st0, reason: st0 === 'active' ? 'เริ่มทานยา' : rs0 }], ...data };
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

/** Free เก็บใบนัดเต็มโควตาของโปรไฟล์ → หน้าต่างให้เลือก "เลือกใบนัดที่จะลบ" / "ดู Premium" / "ยกเลิก" · คืน true เมื่อมีที่ว่างพอบันทึกได้ (ไม่ลบอะไรเองโดยไม่ถาม) */
async function apptQuotaFlow(pid) {
  while (!canUse('appts', { pid })) {
    const v = await limitDialog('appts', { primary: 'เลือกใบนัดที่จะลบ' });
    if (v !== 'primary') return false;
    await apptDeletePicker(pid);
  }
  return true;
}
/** รายการใบนัดของโปรไฟล์ให้เลือกลบ (ซ้อนทับฟอร์ม) — ทุกการลบมีหน้าต่างยืนยันอีกชั้น ระบุว่าลบถาวรกู้คืนไม่ได้ รวมรูปที่แนบ */
function apptDeletePicker(pid) {
  return new Promise((resolve) => {
    const ov = document.createElement('div'); ov.className = 'ask-ov';
    const draw = () => {
      const list = S.appointments.filter((x) => x.profile_id === pid).sort((x, y) => String(y.appt_date).localeCompare(String(x.appt_date)));
      ov.innerHTML = `<div class="ask-box ap-pick" role="dialog" aria-modal="true"><p class="ask-msg"><b>เลือกใบนัดที่จะลบ</b><br><small class="muted">ของ ${esc(profileById(pid).name)} · ลบแล้วกู้คืนไม่ได้</small></p>
        <div class="ap-list">${list.map((x) => `<div class="ap-row"><div><b>${thDate(x.appt_date)}</b> · ${hhmm(x.appt_time)} น.<small>${esc([x.department, hospitalById(x.hospital_id)?.name].filter(Boolean).join(' · ') || 'ไม่ระบุแผนก')}${(x.attachments || []).length ? ` · 📎 ${(x.attachments || []).length} รูป` : ''}</small></div><button type="button" class="btn danger sm" data-del="${x.id}">ลบ</button></div>`).join('') || '<p class="small muted">ไม่มีใบนัดแล้ว</p>'}</div>
        <div class="ask-btns"><button type="button" class="btn ghost" data-close>ปิด</button></div></div>`;
    };
    ov.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]') || e.target === ov) { ov.remove(); return resolve(); }
      const b = e.target.closest('[data-del]'); if (!b) return;
      const x = S.appointments.find((r) => r.id === b.dataset.del); if (!x) return;
      const ok = await askConfirm(`ลบใบนัด <b>${thDate(x.appt_date)}</b> <b>ถาวร</b> ใช่หรือไม่?<br><small class="muted">ข้อมูลนัดและรูปใบนัดที่แนบ${(x.attachments || []).length ? ` (${(x.attachments || []).length} รูป)` : ''}จะหายไปและกู้คืนไม่ได้</small>`, 'ลบถาวร', 'ไม่ลบ');
      if (!ok) return;
      S.appointments = S.appointments.filter((r) => r.id !== x.id);
      if (await dbDo(DB.remove('appointments', x.id))) DB.removeFiles(x.attachments || []).catch(() => {});
      if (canUse('appts', { pid })) { ov.remove(); toast('ลบใบนัดแล้ว — บันทึกใบนัดใหม่ได้เลย'); return resolve(); }
      draw();
    });
    draw(); document.body.appendChild(ov);
  });
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
      <div class="post-visit"><label class="f"><span>8. แพทย์แนะนำว่า <small>(จะขึ้นในสรุปก่อนพบแพทย์ครั้งถัดไป ถ้าเป็นแพทย์คนเดิมและแผนกเดิม)</small></span><textarea name="visit_summary" maxlength="1000" placeholder="เช่น ปรับยาใหม่ / ให้งดอาหารเค็ม / นัดตรวจเลือดอีก 1 เดือน">${esc(e.visit_summary)}</textarea></label></div>
      <label class="f"><span>9. หมายเหตุ</span><textarea name="note" placeholder="เช่น เจาะเลือดต้องงดอาหาร">${esc(e.note)}</textarea></label>
      <div class="f"><span class="lbl">10. แนบรูปภาพ (ใบนัด/เอกสาร)</span>
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
  const syncPhotoNote = () => { const n = keep.length + pending.length; photoNote.textContent = `แนบได้สูงสุด ${MAX_APPT_PHOTOS} ภาพต่อ 1 นัด (เก็บภาพไว้ 1 ปีนับจากวันนัด แล้วจะลบอัตโนมัติ)`; photoNote.classList.toggle('red-t', n >= MAX_APPT_PHOTOS); };
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
    const apptPid = fd.get('profile_id');
    if ((!a || a.profile_id !== apptPid) && !(await apptQuotaFlow(apptPid))) return; // Free: เก็บใบนัดได้ต่อโปรไฟล์ — เต็มแล้วต้องลบใบเก่าก่อน (ข้อมูลในฟอร์มไม่หาย)
    if (a && !(await askConfirm(`ต้องการ <b>แก้ไขนัดหมอนี้</b> ใช่หรือไม่?<br><small class="muted">กด "ใช่ แก้ไข" เพื่อบันทึกการเปลี่ยนแปลง</small>`, 'ใช่ แก้ไข'))) return;
    const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      const department = readSelectOther(fd, 'department');
      const hospital_id = await resolveHospital(fd.get('hospital_name'), fd.get('hospital_phone'));
      const doctor_id = await resolveDoctor(fd.get('doctor_name'), department, hospital_id);
      const id = a ? a.id : uuid();
      const uploaded = [];
      const ownerUid = profileById(apptPid).user_id; for (const p of pending) uploaded.push(await DB.upload(p.file, id, ownerUid)); // รูปเก็บใต้โฟลเดอร์ของเจ้าของโปรไฟล์ → นับเป็นโควตา/ถูกลบโดยงานครบกำหนดของเจ้าของ
      const data = {
        profile_id: fd.get('profile_id'), department, appt_date: fd.get('appt_date'), appt_time: fd.get('appt_time'),
        doctor_id, hospital_id, building: fd.get('building').trim(), visit_reason: readSelectOther(fd, 'visit_reason'),
        note: fd.get('note').trim(), attachments: [...keep, ...uploaded],
      };
      const summary = String(fd.get('visit_summary') || '').trim();
      if (summary || (a && a.visit_summary)) data.visit_summary = summary || null; // ส่งเฉพาะเมื่อมีค่า (กันพังถ้ายังไม่ได้รัน SQL เพิ่มคอลัมน์)
      const save = async () => { if (a) { await DB.update('appointments', id, data); Object.assign(a, data); } else { await DB.insert('appointments', { id, ...data }); S.appointments.push({ id, ...data }); } };
      try { await save(); }
      catch (err) {
        if (!/visit_summary/.test(String(err?.message || ''))) throw err;
        delete data.visit_summary; await save(); toast('บันทึกนัดแล้ว แต่ยังบันทึก "ผลการพบแพทย์" ไม่ได้ — ต้องรัน supabase/appt-summary.sql ก่อน');
      }
      if (removed.length) DB.removeFiles(removed).catch(() => {});
      ui.calSel = data.appt_date; const d = parseDk(data.appt_date); ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      closeSheet(); render(); toast('บันทึกนัดแล้ว');
    } catch (e) {
      console.error(e); const q = /PREMIUM_REQUIRED:(\w+)/.exec(e.message || ''); // ฐานข้อมูลบังคับโควตาซ้ำอีกชั้น
      if (q) { limitDialog(q[1]); await reload(); } else toast('บันทึกไม่สำเร็จ: ' + e.message);
      btn.disabled = false; btn.textContent = 'บันทึก';
    }
  };
}

/** รายละเอียดนัด — อ่านจากข้อมูลชุดเดียวกับปฏิทินและการแจ้งเตือน */
function apptMessage(a, n) {
  // ข้อความแจ้งเตือนนัดหมอ: บอกแค่ว่า "พบแพทย์ครั้งถัดไป" + วัน เวลา แผนก (ไม่ใส่ชื่อหมอ/โรงพยาบาล/หมายเหตุ เพื่อให้สั้นและเป็นส่วนตัวบนหน้าจอล็อก)
  return {
    title: '🩺 พบแพทย์ครั้งถัดไป',
    body: [thDate(a.appt_date), `เวลา ${hhmm(a.appt_time)} น.`, a.department ? `แผนก : ${a.department}` : ''].filter(Boolean).join('  '),
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
      ${h?.phone ? row('เบอร์โทร', `<a class="tel-btn" data-call-name="${esc(h.name)}" data-call-num="${esc(h.phone)}" href="${telHref(h.phone)}" aria-label="โทรหา ${esc(h.name)}">📞</a><span class="tel-num">${esc(h.phone)}</span>`) : ''}
      ${row('ตึก/ชั้น', esc(a.building))}
      ${row('สาเหตุ', esc(a.visit_reason))}
    </div>
    ${typeof reportButtonHtml === 'function' ? reportButtonHtml(a) : ''}
    ${a.note ? `<div class="alert sun" style="margin-top:12px"><div class="ic">📝</div><div><b>หมายเหตุ</b><span>${esc(a.note)}</span></div></div>` : ''}
    ${a.visit_summary ? `<div class="alert" style="margin-top:12px"><div class="ic">🩺</div><div><b>แพทย์แนะนำว่า</b><span style="white-space:pre-line">${esc(a.visit_summary)}</span></div></div>` : ''}
    ${!(a.attachments || []).length && a.images_purged_at ? '<p class="small muted purged-note">🗓️ รูปใบนัดถูกลบแล้ว (เก็บไว้ครบ 1 ปี)</p>' : ''}
    ${(a.attachments || []).length ? `<h4>รูปที่แนบ</h4><div class="thumbs" id="dThumbs">${a.attachments.map(() => '<div class="thumb loading"></div>').join('')}</div>` : ''}
    <div class="card flat small"><div class="preview"><b>${esc(apptMessage(a, Math.max(1, Math.min(n, 5))).title)}</b><br>${esc(apptMessage(a, 1).body).replace(/\n/g, '<br>')}</div></div>
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
  ui.slipsPid = pid;
  const p = profileById(pid);
  const mine = S.appointments.filter((a) => a.profile_id === pid);
  const list = [ // นัดที่กำลังจะถึง (ใกล้สุดก่อน) แล้วตามด้วยนัดที่ผ่านมาแล้ว (ล่าสุดก่อน)
    ...mine.filter((a) => daysUntil(a.appt_date) >= 0).sort((a, b) => a.appt_date.localeCompare(b.appt_date)),
    ...mine.filter((a) => daysUntil(a.appt_date) < 0).sort((a, b) => b.appt_date.localeCompare(a.appt_date)),
  ];
  const sheet = openSheet(`
    ${p.drug_allergies?.length ? `<div class="alert red"><div class="ic">⚠️</div><div><b>แพ้ยา</b><div class="tags">${tagList(p.drug_allergies, 'allergy')}</div></div></div>` : ''}
    <div class="detail-head" style="--pc:${p.color}">${avatarHtml(p, 'lg')}<div><div class="small muted">ใบนัด/เอกสารของ</div><h3 style="margin:0">${esc(p.name)}</h3></div></div>
    <p class="small muted" style="margin:0 0 10px">🗓️ รูปใบนัดเก็บไว้ 1 ปีนับจากวันนัด แล้วลบอัตโนมัติ</p>
    <button class="btn block" data-act="add-appt" data-pid="${pid}">📷 เพิ่มนัดใหม่พร้อมรูปใบนัด</button>
    ${list.map((a) => { const h = hospitalById(a.hospital_id); const n = daysUntil(a.appt_date);
      return `<div class="slip">
        <button class="slip-head" data-act="appt-detail" data-id="${a.id}">
          <b>${thDate(a.appt_date)} · ${hhmm(a.appt_time)} น.</b>${n >= 0 ? `<span class="countdown ${n <= 1 ? 'hot' : ''}">${whenText(n)}</span>` : ''}
          <span class="small muted">${esc(departmentOf(a))}${h ? ' · ' + esc(h.name) : ''}</span></button>
        ${a.attachments?.length
          ? `<div class="thumbs">${a.attachments.map((x) => `<div class="thumb"><img class="zoom" data-path="${esc(x)}" alt="ใบนัด"></div>`).join('')}</div>`
          : (a.images_purged_at ? `<p class="small muted purged-note">🗓️ รูปใบนัดถูกลบแล้ว (เก็บไว้ครบ 1 ปี)</p>` : `<button class="btn ghost sm" data-act="edit-appt" data-id="${a.id}">📎 แนบรูปใบนัด</button>`)}
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
    ${AV_GENDERS.flatMap(([g]) => avPosesOf(age).map(([pose, poseL]) => { const id = `${g}-${age}-${pose}`;
      return `<label title="${poseL}"><input type="radio" name="avatar" value="${id}" ${id === sel ? 'checked' : ''}><span class="opt av-opt">${avatarSVG(id, color)}</span></label>`; })).join('')}
  </div></div>`).join('');
}

function personForm(p, preset = {}) {
  if (!p && !preset.isSelf && !canUse('profiles')) return limitDialog('profiles'); // โปรไฟล์ของฉันสร้างได้เสมอ 1 อัน ไม่นับโควตา
  const e = p || { color: PRESET_COLORS[S.profiles.length % PRESET_COLORS.length], avatar: 'f-elder-smile', reminder_enabled: true, chronic_diseases: [], drug_allergies: [], ...preset };
  const relOther = e.relation && !RELATIONS.includes(e.relation);
  let avatarTouched = !!p;
  const sheet = openSheet(`<h3>${p ? (isSelfProfile(p) ? 'แก้ไขโปรไฟล์ของฉัน' : 'แก้ไขข้อมูลคน') : preset.isSelf ? 'สร้างโปรไฟล์ของฉัน' : 'เพิ่มสมาชิกที่ฉันดูแล'}</h3>
    ${preset.welcome ? '<div class="alert sun welcome-note"><div class="ic">👋</div><div><b>ยินดีต้อนรับสู่สุขใจ</b><span class="small">เริ่มจากสร้างโปรไฟล์ของคุณก่อนนะ ใช้เวลาไม่ถึงนาที · คนที่คุณดูแล (พ่อ แม่ ปู่ ย่า) เพิ่มทีหลังได้</span></div></div>' : ''}
    <form id="f">
      <div class="detail-head" id="pvHead">${avatarHtml(e, 'lg')}<div><b id="pvName">${esc(e.name || 'ชื่อเรียก')}</b><div class="small muted" id="pvRel">${esc(e.relation || '')}</div></div></div>
      <label class="f"><span>ชื่อเล่น/ชื่อเรียก</span><input type="text" name="name" required value="${esc(e.name)}" placeholder="เช่น ย่าปลา, ปู่เค็ม"></label>
      <label class="f"><span>สถานะ/ความสัมพันธ์</span>${selectOther('relation', RELATIONS.filter((r) => r !== 'ตัวเอง' || e.relation === 'ตัวเอง'), relOther ? e.relation : e.relation, 'เลือกความสัมพันธ์')}</label>
      <div class="two">
        <label class="f"><span>ปีเกิด (พ.ศ. หรือ ค.ศ.)</span><input type="number" name="birth_year" inputmode="numeric" min="1900" max="2700" value="${e.birth_year ? e.birth_year + 543 : ''}" placeholder="เช่น 2490"></label>
        <div class="f"><span class="lbl">กรุ๊ปเลือด</span><div class="pick">${BLOOD_TYPES.map((b) => `<label><input type="radio" name="blood_type" value="${b}" ${e.blood_type === b ? 'checked' : ''}><span class="opt blood">${b}</span></label>`).join('')}</div></div>
      </div>
      <div class="f"><span class="lbl">สีประจำตัว (ใช้ในหน้านัดพบแพทย์)</span><div class="pick colors">
        ${PRESET_COLORS.map((c) => `<label><input type="radio" name="color_p" value="${c}" ${c === e.color ? 'checked' : ''}><span class="opt sw" style="background:${c}"></span></label>`).join('')}
        <label class="custom-color" title="เลือกสีเอง"><input type="color" name="color" value="${e.color}"><span>🎨 เลือกเอง</span></label>
      </div></div>
      <div class="f"><span class="lbl">ไอคอน</span><div id="avPick">${avatarPicker(e.avatar, e.color)}</div></div>
      <div class="three">
        <label class="f"><span>น้ำหนัก (กก.)</span><input type="number" name="weight_kg" min="0" max="400" step="0.1" inputmode="decimal" value="${e.weight_kg ?? ''}" placeholder="เช่น 58"></label>
        <label class="f"><span>ส่วนสูง (ซม.)</span><input type="number" name="height_cm" min="0" max="250" step="0.1" inputmode="decimal" value="${e.height_cm ?? ''}" placeholder="เช่น 160"></label>
        <label class="f"><span>รอบเอว (ซม.)</span><input type="number" name="waist_cm" min="0" max="250" step="0.1" inputmode="decimal" value="${e.waist_cm ?? ''}" placeholder="เช่น 80"></label>
      </div>
      <label class="f"><span>รหัสแทนลำดับยา <small>(เช่น A จะเรียงลำดับ A1 A2 … ตามจำนวนยาที่ทาน)</small></span><input type="text" name="med_prefix" maxlength="3" value="${esc(e.med_prefix ?? '')}" placeholder="A"></label>
      <div class="f"><span class="lbl">โรคประจำตัว</span>${tagBox('chronic_diseases', e.chronic_diseases, 'พิมพ์แล้วกด เพิ่ม')}</div>
      <div class="f"><span class="lbl red-t">⚠️ แพ้ยา</span>${tagBox('drug_allergies', e.drug_allergies, 'เช่น Penicillin', 'allergy')}</div>
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
    if (p && !(await askConfirm(`ต้องการ <b>แก้ไขข้อมูลของ "${esc(p.name)}"</b> ใช่หรือไม่?<br><small class="muted">กด "ใช่ แก้ไข" เพื่อบันทึกการเปลี่ยนแปลง</small>`, 'ใช่ แก้ไข'))) return;
    let by = parseInt(fd.get('birth_year'), 10); if (by > 2400) by -= 543; // แปลง พ.ศ. → ค.ศ.
    const data = {
      name: fd.get('name').trim(), relation: readSelectOther(fd, 'relation'), birth_year: Number.isFinite(by) ? by : null,
      blood_type: fd.get('blood_type') || null, color: colorIn.value, avatar: curAvatar(),
      chronic_diseases: readTagBox(f, 'chronic_diseases'), drug_allergies: readTagBox(f, 'drug_allergies'),
      reminder_enabled: p ? !!reminderOn(p) : !!e.reminder_enabled, // ไม่มีสวิตช์ในฟอร์มแล้ว — คงค่าเดิมของคนนี้ไว้
      weight_kg: numOrNull(fd.get('weight_kg')), height_cm: numOrNull(fd.get('height_cm')), waist_cm: numOrNull(fd.get('waist_cm')),
      med_prefix: String(fd.get('med_prefix') || '').trim() || null,
    };
    if (p) { Object.assign(p, data); closeSheet(); render(); if (await dbDo(DB.update('profiles', p.id, data))) toast('บันทึกแล้ว'); }
    else { const row = { id: uuid(), ...data }; if (preset.isSelf && (DB.mode !== 'supabase' || S.ent?.v2)) row.is_self = true; S.profiles.push(row); closeSheet(); render(); if (await dbDo(DB.insert('profiles', row))) toast('เพิ่มแล้ว'); }
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
  if (el.dataset.tab) return navTab(el.dataset.tab);
  const { act, id } = el.dataset;
  if (act === 'del-med' && delLocked()) return toast('การป้องกันลบโดยไม่ได้ตั้งใจเปิดอยู่ — กดปุ่ม "ป้องกันแก้ไขข้อมูล" ในหน้ารายการยาเพื่อปิดก่อน');
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
    case 'del-appt': confirmSheet('ลบนัดนี้ถาวร?<br><small class="muted">กู้คืนไม่ได้ (รวมรูปใบนัดที่แนบ)</small>', async () => {
      const a = appt(); S.appointments = S.appointments.filter((x) => x.id !== id);
      if (await dbDo(DB.remove('appointments', id))) DB.removeFiles(a.attachments || []).catch(() => {});
    }, 'ลบ'); break;
    case 'sel-day': ui.calSel = id; render(); break;
    case 'cal-prev': ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() - 1, 1); render(); break;
    case 'cal-next': ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + 1, 1); render(); break;
    case 'cal-today': { const d = new Date(); ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1); ui.calSel = todayKey(); render(); break; }
    case 'add-person': personForm(); break;
    case 'edit-person': if (!ownsProfile(id)) { toast('ข้อมูลส่วนตัวนี้แก้ได้เฉพาะเจ้าของ — คุณดูยา นัด และบันทึกติดตามอาการได้จากปุ่มด้านล่าง'); break; } personForm(S.profiles.find((p) => p.id === id)); break;
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
    case 'privacy': privacySheet(); break;
    case 'today-visibility': openSheet(`<h3>แสดงตารางของใครบ้าง</h3>
      <p class="small muted">เลือกเฉพาะคนที่อยากเห็นในหน้า "วันนี้" "ยาที่ต้องทาน" "จำนวนยาที่เหลือ" และ "ความดัน / น้ำตาล" ตั้งได้เฉพาะบัญชีของคุณ ไม่กระทบคนอื่นในกลุ่ม</p>
      ${S.profiles.map((p) => `<label class="switch-row card"><span class="vis-who">${avatarHtml(p, 'xs')}<b>${esc(p.name)}</b></span>
        <span class="switch"><input type="checkbox" data-today-toggle="${p.id}" ${todayHidden().includes(p.id) ? '' : 'checked'}><i></i></span></label>`).join('')}
      <div class="row"><button class="btn" data-act="close">เสร็จแล้ว</button></div>`); break;
    case 'slot-name': toast(el.dataset.label); break;
    case 'rel-label': relLabelForm(el.dataset.id); break;
    case 'med-toggle': { ui.medOpen = ui.medOpen || {}; const on = !ui.medOpen[el.dataset.id]; ui.medOpen[el.dataset.id] = on; const row = el.closest('.mrow'); row.classList.toggle('open', on); row.querySelector('.mr-more').hidden = !on; el.setAttribute('aria-expanded', on); el.querySelector('.mr-chev').textContent = on ? '▴' : '▾'; break; }
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
    case 'del-person': confirmSheet('ลบคนนี้ พร้อมยา นัด และบันทึกติดตามอาการทั้งหมด?', async () => {
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
    <p class="small muted">จะเพิ่มคนและรายการยาใหม่ในบัญชีของคุณ (ไม่ลบหรือแก้ข้อมูลเดิม)</p>
    <div class="row"><button class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" id="doImport">นำเข้า</button></div>`);
  $('#doImport', sheet).onclick = async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'กำลังนำเข้า…';
    const now = new Date().toISOString(); const ids = {}; let nm = 0;
    const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
    try {
      for (const p of data.profiles) {
        ids[p.key] = uuid();
        const row = { id: ids[p.key], chronic_diseases: [], drug_allergies: [], reminder_enabled: true, ...pick(p, ['name', 'relation', 'birth_year', 'blood_type', 'color', 'avatar']) };
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
/** ชื่อกลุ่มขึ้นต้นด้วยคำว่า "กลุ่ม" เสมอ (ไม่ซ้ำซ้อนถ้าผู้ใช้พิมพ์เอง) */
const circleNameFix = (s) => { const r = String(s || '').trim().replace(/^(กลุ่ม\s*)+/, ''); return `กลุ่ม${r}`; };
function circleForm(c) {
  if (!c && !canUse('circles')) return limitDialog('circles');
  const e = c || { name: '', description: '' };
  const isNew = !c;
  const careFor = S.circle_care_for?.filter((cf) => cf.circle_id === c?.id) || [];
  const members = isNew ? [] : S.circle_members.filter((m) => m.circle_id === c.id)
    .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : String(a.joined_at).localeCompare(String(b.joined_at))));
  const mine = S.profiles.filter((p) => ownsProfile(p.id));
  const sheet = openSheet(`<h3>${isNew ? 'สร้างกลุ่มผู้ดูแล' : 'แก้ไขกลุ่มผู้ดูแล'}</h3>
    <form id="f">
      <label class="f"><span>ชื่อกลุ่ม</span><span class="grp-input"><b>กลุ่ม</b><input type="text" name="name" required maxlength="40" value="${esc(String(e.name || '').replace(/^กลุ่ม\s*/, ''))}" placeholder="เช่น ดูแลปู่ย่า"></span></label>
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
    if (c && !(await askConfirm(`ต้องการ <b>แก้ไขกลุ่มผู้ดูแล "${esc(c.name)}"</b> ใช่หรือไม่?<br><small class="muted">กด "ใช่ แก้ไข" เพื่อบันทึกการเปลี่ยนแปลง</small>`, 'ใช่ แก้ไข'))) return;
    const data = { name: circleNameFix(fd.get('name')), description: String(fd.get('description') || '').trim() };
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
      else if (!canUse('members', { cid: circleId })) setTimeout(() => limitDialog('members'), 400); // เต็มโควตาสมาชิกกลุ่ม (ตามแพ็กเกจของเจ้าของกลุ่ม)
      else {
        const inv = { id: uuid(), circle_id: circleId, circle_name: data.name, email, role: fd.get('member_role') === 'viewer' ? 'viewer' : 'member', created_at: now };
        S.circle_invites.push(inv);
        if (await dbDo(DB.insert('circle_invites', inv))) { toast(`ส่งคำเชิญถึง ${email} แล้ว`); if (DB.notifyInvite) DB.notifyInvite(inv.id); } // แจ้งเตือนเด้งไปที่เครื่องผู้ถูกเชิญ (ทำเบื้องหลัง)
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
    document.querySelectorAll('[data-toggle-reminder]').forEach((i) => { const q = S.profiles.find((x) => x.id === i.dataset.toggleReminder); if (q) i.checked = reminderOn(q); });
    if (await dbDo(DB.update('profiles', p.id, { reminder_enabled: p.reminder_enabled }))) toast(p.reminder_enabled ? `เปิดเตือนกินยาของ${p.name}` : `ปิดเตือนกินยาของ${p.name}`);
  }
  if (t.dataset.slotRemind) { // เปิด/ปิดเตือนรายยา รายช่วงเวลา
    const [mid, slot] = t.dataset.slotRemind.split('|'); const m = S.medications.find((x) => x.id === mid); if (!m) return;
    m.slot_reminders = { ...(m.slot_reminders || {}), [slot]: t.checked };
    if (await dbDo(DB.update('medications', mid, { slot_reminders: m.slot_reminders }))) toast(`${t.checked ? 'เปิด' : 'ปิด'}เตือน ${medNo(m)} · ${slotOf(slot).short}`);
  }
  if (t.dataset.lowQty !== undefined) { // ตั้งจำนวนเม็ดที่ยาเหลือแล้วขึ้นเตือน (ใช้กับยาทุกตัว)
    const v = Math.max(0, Math.min(999, Math.floor(Number(t.value)))); if (!Number.isFinite(v)) return;
    const prev = S.settings.low_stock_qty; t.value = v; S.settings.low_stock_qty = v;
    document.querySelectorAll('[data-low-set]').forEach((b) => b.classList.toggle('on', Number(b.dataset.lowSet) === v));
    try { await DB.saveSettings(S.settings); toast(`แจ้งเตือนเมื่อยาเหลือจำนวน ${v} เม็ด`); const sub = t.closest('details.nt-cat')?.querySelector(':scope > summary small'); if (sub) sub.textContent = `แจ้งเตือนเมื่อยาเหลือจำนวน ${v} เม็ด`; }
    catch (e) { S.settings.low_stock_qty = prev; toast(e?.needSql ? 'ต้องรัน SQL ล่าสุดใน Supabase ก่อน (supabase/notify-settings.sql) จึงจะตั้งจำนวนเม็ดได้' : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'); if (e?.needSql) t.value = prev ?? LOW_STOCK_QTY; }
  }
  if (t.dataset.apptHh !== undefined || t.dataset.apptMm !== undefined) { // เวลาแจ้งเตือนนัดหมอ (กำหนดเองได้ ทั้งบัญชี)
    const box = t.closest('.nt-time'); const next = `${box.querySelector('[data-appt-hh]').value}:${box.querySelector('[data-appt-mm]').value}`;
    const prev = S.settings.appt_remind_time; S.settings.appt_remind_time = next;
    try { await DB.saveSettings(S.settings); toast(`เตือนนัดหมอเวลา ${next} น.`); }
    catch (e) { S.settings.appt_remind_time = prev; const [ph, pm] = apptRemindTime().split(':'); box.querySelector('[data-appt-hh]').value = ph; box.querySelector('[data-appt-mm]').value = pm; toast(e?.needSql ? 'ต้องรัน SQL ล่าสุดใน Supabase ก่อน (supabase/notify-settings.sql) จึงจะตั้งเวลาเตือนนัดหมอได้' : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'); }
  }
  if (t.dataset.apptDay !== undefined) { // เลือกเตือนนัดหมอล่วงหน้ากี่วัน (ทั้งบัญชี)
    const cur = remindDays().slice(); const d = Number(t.dataset.apptDay); const next = (t.checked ? [...new Set([...cur, d])] : cur.filter((x) => x !== d)).sort((a, b) => b - a);
    const prev = S.settings.appt_remind_days; S.settings.appt_remind_days = next;
    try { await DB.saveSettings(S.settings); toast(next.length ? `เตือนนัดหมอล่วงหน้า ${next.map((x) => (x === 0 ? 'วันนัด' : x + ' วัน')).join(' · ')}` : 'ปิดเตือนนัดหมอล่วงหน้าทุกวันแล้ว'); }
    catch (e) { S.settings.appt_remind_days = prev; t.checked = !t.checked; toast(e?.needSql ? 'ต้องรัน SQL ล่าสุดใน Supabase ก่อน (supabase/notify-settings.sql) จึงจะเลือกวันเตือนนัดหมอได้' : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'); }
  }
  if (t.dataset.toggleAppt) { // เตือนนัดหมอรายคน
    const p = S.profiles.find((x) => x.id === t.dataset.toggleAppt); if (!p) return;
    p.appt_reminder = t.checked;
    if (await dbDo(DB.update('profiles', p.id, { appt_reminder: p.appt_reminder }))) toast(`${t.checked ? 'เปิด' : 'ปิด'}เตือนนัดหมอของ${p.name}`);
  }
  if (t.dataset.toggleCare) { // เตือนติดตามอาการรายเรื่อง
    const c = S.care_plans.find((x) => x.id === t.dataset.toggleCare); if (!c) return;
    c.remind = t.checked;
    if (await dbDo(DB.update('care_plans', c.id, { remind: c.remind }))) toast(`${t.checked ? 'เปิด' : 'ปิด'}เตือนบันทึกติดตามอาการ "${c.title}"`);
  }
});
document.addEventListener('toggle', (ev) => {
  const d = ev.target; if (d.dataset?.legend) { ui.legendOpen = ui.legendOpen || {}; ui.legendOpen[d.dataset.legend] = d.open; }
}, true);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeSheet(); });

// โทรออกทุกครั้งต้องถามยืนยันก่อน (กันกดพลาด) — ใช้กับลิงก์ tel: ทุกที่ในแอพ รวมเบอร์ฉุกเฉิน
document.addEventListener('click', async (ev) => {
  const a = ev.target.closest && ev.target.closest('a[href^="tel:"]');
  if (!a || a.classList.contains('disabled') || a.getAttribute('href') === '#') return;
  ev.preventDefault(); ev.stopPropagation();
  const href = a.getAttribute('href'); const number = a.dataset.callNum || decodeURIComponent(href.slice(4)); const name = a.dataset.callName || '';
  if (await askConfirm(`ต้องการ <b>โทรออก</b>${name ? ` ไปที่ <b>${esc(name)}</b>` : ''}<br><b style="font-size:1.25em">${esc(number)}</b> ใช่หรือไม่?`, '📞 ใช่ โทรเลย', 'ยกเลิก')) location.href = href;
}, true);

// ---------- ปุ่มเปิด-ปิดตา (แสดง/ซ่อนรหัสผ่าน) ที่ช่องรหัสผ่านทุกช่องในแอพ ----------
function addPwEye(inp) {
  if (inp.dataset.eye) return; inp.dataset.eye = '1';
  // ไอคอนเส้นเรียบ (วาดเอง): ตา = แสดงรหัสผ่าน · ตามีเส้นขีด = ซ่อนรหัสผ่าน
  const EYE = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>';
  const wrap = document.createElement('span'); wrap.className = 'pw-wrap'; inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
  const b = document.createElement('button'); b.type = 'button'; b.className = 'pw-eye'; b.innerHTML = EYE; b.setAttribute('aria-label', 'แสดงรหัสผ่าน'); b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; b.innerHTML = show ? EYE_OFF : EYE; b.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'); b.setAttribute('aria-pressed', String(show)); inp.focus(); });
  wrap.appendChild(b);
}const addPwEyes = () => document.querySelectorAll('input[type=password]:not([data-eye])').forEach(addPwEye);
new MutationObserver(addPwEyes).observe(document.body, { childList: true, subtree: true }); addPwEyes();

// ปุ่มลัด/ปุ่ม − + ของ "ยาใกล้หมด" ใน ตั้งค่า > การแจ้งเตือน → ใส่ค่าในช่อง แล้วให้ช่องบันทึกเอง
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-low-set], [data-low-step]'); if (!b) return;
  const inp = document.getElementById('lowQty'); if (!inp) return;
  const cur = Math.floor(Number(inp.value)) || 0;
  inp.value = b.dataset.lowSet !== undefined ? Number(b.dataset.lowSet) : Math.max(0, Math.min(999, cur + Number(b.dataset.lowStep)));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
});
// ปุ่มเลือกจำนวนยาต่อครั้งที่ใช้บ่อย (¼ ½ ¾ 1 1½ 2) ในฟอร์มยา
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-dose-set]'); if (!b) return;
  const inp = b.closest('form')?.querySelector('input[name=dose]'); if (!inp) return;
  inp.value = b.dataset.doseSet; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
});

// ตั้งค่า > การแจ้งเตือน: อัปเดตบรรทัดสรุปใต้ชื่อหมวดสดๆ เมื่อผู้ใช้เปลี่ยนค่าข้างใน (ทำหลังตัวจัดการหลักที่ตั้งค่าแล้ว)
document.addEventListener('change', (ev) => {
  if (!ev.target.closest?.('details.nt-cat')) return;
  const cats = document.querySelectorAll('details.nt-cat'); const set = (i, t) => { const s = cats[i]?.querySelector(':scope > summary small'); if (s) s.textContent = t; };
  set(0, ntMedSub()); set(1, ntApptSub()); set(2, ntCareSub());
});

/** ตั้งความสัมพันธ์ของ "ฉัน" ที่มีต่อโปรไฟล์ที่คนอื่นแชร์มา (เก็บในบัญชีตัวเอง ไม่กระทบเจ้าของข้อมูล) */
function relLabelForm(pid) {
  const p = profileById(pid); if (!p || ownsProfile(pid)) return;
  const cur = S.settings?.profile_relations?.[pid] || '';
  const sheet = openSheet(`<h3>ความสัมพันธ์ของฉัน</h3>
    <p class="small muted">${esc(p.name)} เป็นอะไรสำหรับคุณ? ตั้งได้เฉพาะในบัญชีของคุณ เจ้าของข้อมูลจะไม่เห็นและไม่ถูกเปลี่ยน</p>
    <form id="f"><div class="f"><span class="lbl">เป็น</span>${selectOther('relation', RELATIONS.filter((r) => r !== 'ตัวเอง'), cur, 'เลือกความสัมพันธ์')}</div>
      <div class="row sticky-actions">${cur ? '<button type="button" class="btn danger" id="relClear">ล้าง</button>' : ''}<button type="button" class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" type="submit">บันทึก</button></div></form>`);
  const f = $('#f', sheet); bindSelectOther(f);
  const save = async (val) => {
    const prev = S.settings.profile_relations; S.settings.profile_relations = { ...(prev || {}) };
    if (val) S.settings.profile_relations[pid] = val; else delete S.settings.profile_relations[pid];
    S.settings._relTouched = true;
    try { await DB.saveSettings(S.settings); closeSheet(); render(); toast(val ? `ตั้ง ${p.name} เป็น "${val}" แล้ว` : 'ล้างความสัมพันธ์แล้ว'); }
    catch (e) { S.settings.profile_relations = prev; toast(e?.needSql ? 'ต้องรัน SQL ล่าสุดใน Supabase ก่อน (supabase/notify-settings.sql) จึงจะตั้งความสัมพันธ์ได้' : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'); }
  };
  f.onsubmit = (ev) => { ev.preventDefault(); const v = String(readSelectOther(new FormData(f), 'relation') || '').trim().slice(0, 30); if (!v) return toast('เลือกหรือพิมพ์ความสัมพันธ์ก่อน'); save(v); };
  $('#relClear', f)?.addEventListener('click', () => save(''));
}