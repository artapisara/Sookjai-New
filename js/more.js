/* สุขใจ — หน้าจอเสริม: จัดลำดับยา/คน · สรุปการกินยารายเดือน · อารมณ์ · ยืนยันตัวตน 2 ขั้นตอน · PDPA */
'use strict';

// ---------- จัดลำดับยา (เลขต่อเนื่องรายคน 1..n) ----------
function reorderMedsSheet(pid) {
  if (!canEditProfile(pid)) return toast('สิทธิ์ของคุณดูอย่างเดียว');
  const p = profileById(pid); const pre = medPrefix(pid);
  const all = S.medications.filter((m) => m.profile_id === pid);
  const order = [...all.filter((m) => m.status === 'active'), ...all.filter((m) => m.status !== 'active')]
    .sort((a, b) => (a.status === 'active') === (b.status === 'active') ? a.sort_order - b.sort_order : 0).map((m) => m.id);
  const draw = () => {
    const sheet = openSheet(`<h3>จัดลำดับยาของ${esc(p.name)}</h3>
      <p class="small muted">กดลูกศรเพื่อเลื่อน เลขจะเรียงใหม่เป็น ${esc(pre)}1, ${esc(pre)}2, ${esc(pre)}3 … ตามลำดับนี้</p>
      <div class="reorder">${order.map((id, i) => { const m = all.find((x) => x.id === id); return `<div class="ro-row">
        <b class="ro-no">${esc(pre)}${i + 1}</b><span class="ro-name">${esc(m.name)}${m.status !== 'active' ? ` <small class="muted">(${MED_STATUS[m.status]})</small>` : ''}</span>
        <button type="button" class="ro-btn" data-ro="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น">▲</button>
        <button type="button" class="ro-btn" data-ro="down" data-i="${i}" ${i === order.length - 1 ? 'disabled' : ''} aria-label="เลื่อนลง">▼</button></div>`; }).join('')}</div>
      <div class="row sticky-actions"><button class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" id="roSave">บันทึกลำดับ</button></div>`);
    $$('[data-ro]', sheet).forEach((b) => (b.onclick = () => {
      const i = +b.dataset.i; const j = b.dataset.ro === 'up' ? i - 1 : i + 1;
      [order[i], order[j]] = [order[j], order[i]]; const y = $('.reorder', sheet).scrollTop; draw(); $('#modal .reorder').scrollTop = y;
    }));
    $('#roSave', sheet).onclick = async () => {
      const changes = [];
      order.forEach((id, i) => { const m = S.medications.find((x) => x.id === id); if (m && m.sort_order !== i + 1) { m.sort_order = i + 1; changes.push(m); } });
      closeSheet(); render();
      if (changes.length && await dbDo(Promise.all(changes.map((m) => DB.update('medications', m.id, { sort_order: m.sort_order }))))) toast('บันทึกลำดับยาแล้ว');
    };
  };
  draw();
}

// ---------- จัดลำดับคน (ต่อบัญชี ใช้ทุกหน้า) ----------
function reorderPeopleSheet() {
  const order = S.profiles.map((p) => p.id);
  const draw = () => {
    const sheet = openSheet(`<h3>จัดลำดับคน</h3><p class="small muted">ลำดับนี้ใช้ในทุกหน้า (ปฏิทิน ตารางกินยา ครอบครัว) และตั้งได้เฉพาะบัญชีของคุณ</p>
      <div class="reorder">${order.map((id, i) => { const p = profileById(id); return `<div class="ro-row">
        ${avatarHtml(p, 'xs')}<span class="ro-name">${esc(p.name)}</span>
        <button type="button" class="ro-btn" data-ro="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="เลื่อนขึ้น">▲</button>
        <button type="button" class="ro-btn" data-ro="down" data-i="${i}" ${i === order.length - 1 ? 'disabled' : ''} aria-label="เลื่อนลง">▼</button></div>`; }).join('')}</div>
      <div class="row sticky-actions"><button class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" id="roSave">บันทึกลำดับ</button></div>`);
    $$('[data-ro]', sheet).forEach((b) => (b.onclick = () => { const i = +b.dataset.i; const j = b.dataset.ro === 'up' ? i - 1 : i + 1; [order[i], order[j]] = [order[j], order[i]]; draw(); }));
    $('#roSave', sheet).onclick = async () => {
      S.settings.profile_order = [...order]; sortProfiles(); closeSheet(); render();
      if (await dbDo(DB.saveSettings(S.settings))) toast('บันทึกลำดับคนแล้ว');
    };
  };
  draw();
}

// ---------- สรุปผลการกินยาใน 1 เดือน ----------
const ymOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS[m - 1]} ${y + 543}`; };
const shiftYm = (ym, n) => { const [y, m] = ym.split('-').map(Number); return ymOf(new Date(y, m - 1 + n, 1)); };
const minYm = () => shiftYm(ymOf(new Date()), -HISTORY_MONTHS);
const medStart = (m) => (m.status_history || []).find((h) => h.status === 'active')?.date || null;

function adherenceData(pid, ym) {
  const [y, mo] = ym.split('-').map(Number);
  const nDays = new Date(y, mo, 0).getDate(); const today = todayKey();
  const meds = S.medications.filter((m) => m.profile_id === pid && m.status === 'active' && !m.as_needed && m.slots.length);
  const days = []; const perMed = {}; const perSlot = {};
  for (let d = 1; d <= nDays; d++) {
    const key = `${ym}-${pad(d)}`;
    if (key > today) { days.push({ d, key, future: true }); continue; }
    let exp = 0, got = 0;
    for (const m of meds) {
      const st = medStart(m); if (st && st > key) continue;
      for (const s of m.slots) {
        exp++; const ok = !!takenLog(m.id, s, key); if (ok) got++;
        perMed[m.id] = perMed[m.id] || { m, exp: 0, got: 0 }; perMed[m.id].exp++; if (ok) perMed[m.id].got++;
        perSlot[s] = perSlot[s] || { exp: 0, got: 0 }; perSlot[s].exp++; if (ok) perSlot[s].got++;
      }
    }
    days.push({ d, key, exp, got });
  }
  const exp = days.reduce((a, x) => a + (x.exp || 0), 0); const got = days.reduce((a, x) => a + (x.got || 0), 0);
  return { days, exp, got, meds, perMed: Object.values(perMed), perSlot, firstDow: new Date(y, mo - 1, 1).getDay() };
}


// ---------- ยืนยันตัวตน 2 ขั้นตอน (TOTP) ----------
async function mfaSettingsSheet() {
  if (DB.mode !== 'supabase') return toast('ใช้ได้เมื่อเชื่อมต่อ Supabase แล้ว');
  let f; try { f = await DB.mfaFactors(); } catch (e) { return toast('โหลดการตั้งค่าไม่สำเร็จ: ' + e.message); }
  if (f.verified.length) {
    openSheet(`<h3>ยืนยันตัวตน 2 ขั้นตอน</h3>
      <div class="alert sun"><div class="ic">✅</div><div><b>เปิดใช้อยู่</b><span class="small">ทุกครั้งที่เข้าสู่ระบบ ต้องใส่รหัส 6 หลักจากแอพ Authenticator</span></div></div>
      <div class="row sticky-actions"><button class="btn ghost" data-act="close">ปิด</button><button class="btn danger" id="mfaOff">ปิดการยืนยัน 2 ขั้นตอน</button></div>`);
    $('#mfaOff').onclick = () => confirmSheet('ปิดการยืนยันตัวตน 2 ขั้นตอน?<br><small class="muted">บัญชีจะเหลือแค่รหัสผ่านอย่างเดียว</small>', async () => {
      try { for (const x of f.verified) await DB.mfaUnenroll(x.id); toast('ปิดการยืนยัน 2 ขั้นตอนแล้ว'); } catch (e) { toast('ปิดไม่สำเร็จ: ' + e.message); }
    }, 'ปิดใช้');
    return;
  }
  const sheet = openSheet(`<h3>ยืนยันตัวตน 2 ขั้นตอน</h3>
    <p class="small">เพิ่มความปลอดภัยให้ข้อมูลสุขภาพ: หลังใส่รหัสผ่าน ต้องใส่รหัส 6 หลักที่เปลี่ยนทุก 30 วินาทีจากแอพในมือถือ เช่น Google Authenticator หรือ Microsoft Authenticator</p>
    <ol class="small"><li>ติดตั้งแอพ Authenticator ในมือถือ</li><li>กด "เริ่มตั้งค่า" แล้วสแกน QR ด้วยแอพนั้น</li><li>ใส่รหัส 6 หลักที่แอพแสดง เพื่อยืนยัน</li></ol>
    <div id="mfaBox"></div>
    <div class="row sticky-actions"><button class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" id="mfaStart">เริ่มตั้งค่า</button></div>`);
  $('#mfaStart', sheet).onclick = async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'กำลังสร้าง QR…';
    let en; try { en = await DB.mfaEnroll(); } catch (e) { btn.disabled = false; btn.textContent = 'เริ่มตั้งค่า'; return toast('ตั้งค่าไม่สำเร็จ: ' + e.message); }
    btn.remove();
    $('#mfaBox', sheet).innerHTML = `<div class="mfa-qr"><img src="${esc(en.totp.qr_code)}" alt="QR สำหรับแอพ Authenticator" width="200" height="200"></div>
      <p class="small muted center">สแกนไม่ได้? ใส่รหัสนี้ในแอพแทน<br><code class="mfa-secret">${esc(en.totp.secret)}</code></p>
      <label class="f"><span>รหัส 6 หลักจากแอพ</span><input type="text" id="mfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456"></label>
      <p class="small red-t hidden" id="mfaErr"></p>
      <button class="btn block" id="mfaVerify">ยืนยันและเปิดใช้</button>`;
    $('#mfaVerify', sheet).onclick = async (e2) => {
      const code = $('#mfaCode', sheet).value.replace(/\D/g, ''); const err = $('#mfaErr', sheet);
      if (code.length !== 6) { err.textContent = 'ใส่รหัสให้ครบ 6 หลัก'; err.classList.remove('hidden'); return; }
      e2.currentTarget.disabled = true;
      try { await DB.mfaVerify(en.id, code); closeSheet(); toast('✓ เปิดการยืนยันตัวตน 2 ขั้นตอนแล้ว'); }
      catch (e) { e2.currentTarget.disabled = false; err.textContent = 'รหัสไม่ถูกต้องหรือหมดเวลา ลองรหัสใหม่จากแอพ'; err.classList.remove('hidden'); }
    };
  };
}

/** หน้าใส่รหัส 6 หลักตอนเข้าสู่ระบบ (บัญชีที่เปิดยืนยัน 2 ขั้นตอน) */
function mfaChallengeView(onDone) {
  document.body.classList.add('auth');
  $('#app').innerHTML = `<div class="login"><img src="icon.svg" alt="" class="login-logo"><h1>ยืนยันตัวตน</h1>
    <p class="sub">ใส่รหัส 6 หลักจากแอพ Authenticator ในมือถือ</p>
    <form id="mfaForm" class="card">
      <label class="f"><span>รหัส 6 หลัก</span><input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required autofocus placeholder="123456"></label>
      <p class="small red-t hidden" id="mfaErr"></p>
      <button class="btn block" type="submit">ยืนยัน</button>
      <button class="linkbtn" type="button" id="mfaLogout">ออกจากระบบ</button>
    </form></div>`;
  $('#mfaLogout').onclick = async () => { await DB.signOut(); location.reload(); };
  $('#mfaForm').onsubmit = async (ev) => {
    ev.preventDefault(); const err = $('#mfaErr'); const btn = $('button[type=submit]', ev.target);
    const code = String(new FormData(ev.target).get('code')).replace(/\D/g, '');
    if (code.length !== 6) { err.textContent = 'ใส่รหัสให้ครบ 6 หลัก'; err.classList.remove('hidden'); return; }
    btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ…';
    try { const { verified } = await DB.mfaFactors(); await DB.mfaVerify(verified[0].id, code); onDone(); }
    catch (e) { btn.disabled = false; btn.textContent = 'ยืนยัน'; err.textContent = 'รหัสไม่ถูกต้องหรือหมดเวลา ลองรหัสใหม่จากแอพ'; err.classList.remove('hidden'); }
  };
}

// ---------- PDPA: ความยินยอม + ความเป็นส่วนตัว ----------
const PDPA_TEXT = `
  <ul class="pdpa">
    <li><p><b>เก็บอะไร:</b> ข้อมูลสุขภาพของคนที่คุณใส่ไว้ (โรคประจำตัว ยา นัดหมอ รูป อารมณ์) และอีเมลของคุณ</p></li>
    <li><p><b>ใช้ทำอะไร:</b> ทำตารางยา เตือน และแชร์ให้คนที่คุณเชิญ ไม่ขาย ไม่ส่งต่อ ไม่ใช้ทำโฆษณา</p></li>
    <li><p><b>ปลอดภัย:</b> เห็นเฉพาะคุณและกลุ่มที่คุณแชร์ · เก็บบน Supabase (สิงคโปร์) ล็อกสิทธิ์ไว้</p></li>
    <li><p><b>คุณคุมได้:</b> ดาวน์โหลด แก้ไข ถอนความยินยอม หรือลบทั้งหมดได้ทุกเมื่อ ที่ ตั้งค่า → ความเป็นส่วนตัว</p></li>
  </ul>`;

function consentView(onDone) {
  document.body.classList.add('auth');
  $('#app').innerHTML = `<div class="login consent"><h1>ขออนุญาตเก็บข้อมูลสุขภาพ</h1>
    <p class="sub">ตามกฎหมาย PDPA เราต้องขออนุญาตก่อน</p>
    <form id="pdpaForm" class="card">${PDPA_TEXT}
      <label class="check-row"><input type="checkbox" name="c1" required><span>ฉันเข้าใจและอนุญาตให้เก็บข้อมูลตามข้างต้น</span></label>
      <label class="check-row"><input type="checkbox" name="c2" required><span>ฉันแจ้งคนในครอบครัวที่จะใส่ข้อมูลแล้ว และเขาไม่ขัดข้อง</span></label>
      <button class="btn block" type="submit">ยอมรับและเริ่มใช้งาน</button>
      <button class="linkbtn" type="button" id="pdpaNo">ไม่ยอมรับ (ออกจากระบบ)</button>
    </form></div>`;
  $('#pdpaNo').onclick = async () => { await DB.signOut(); location.reload(); };
  $('#pdpaForm').onsubmit = async (ev) => {
    ev.preventDefault();
    S.settings.pdpa_consent_at = new Date().toISOString(); S.settings.pdpa_version = PDPA_VERSION;
    if (await dbDo(DB.saveSettings(S.settings))) onDone();
  };
}

function privacySheet() {
  const at = S.settings.pdpa_consent_at;
  openSheet(`<h3>ความเป็นส่วนตัวและข้อมูลสุขภาพ</h3>${PDPA_TEXT}
    ${DB.mode === 'supabase' ? `<p class="small muted">ให้ความยินยอมเมื่อ ${at ? thDate(String(at).slice(0, 10), 'long') : '-'}</p>` : '<p class="small muted">โหมดทดลอง: ข้อมูลอยู่ในเครื่องนี้เท่านั้น ไม่ได้ส่งขึ้นเซิร์ฟเวอร์</p>'}
    ${CFG.PRIVACY_CONTACT ? `<p class="small">ติดต่อเรื่องข้อมูลส่วนบุคคล: <b>${esc(CFG.PRIVACY_CONTACT)}</b></p>` : ''}
    <button class="btn ghost block" id="pvExport">⬇️ ดาวน์โหลดข้อมูลของฉัน (ไฟล์ JSON)</button>
    <button class="btn danger block" id="pvDelete" style="margin-top:8px">🗑️ ถอนความยินยอมและลบข้อมูลทั้งหมดของฉัน</button>
    <div class="row sticky-actions"><button class="btn ghost" data-act="close">ปิด</button></div>`);
  $('#pvExport').onclick = exportMyData;
  $('#pvDelete').onclick = deleteMyDataSheet;
}

function myData() {
  const pids = new Set(S.profiles.filter((p) => ownsProfile(p.id)).map((p) => p.id));
  const medIds = new Set(S.medications.filter((m) => pids.has(m.profile_id)).map((m) => m.id));
  const planIds = new Set(S.care_plans.filter((c) => pids.has(c.profile_id)).map((c) => c.id));
  const mine = (t) => (S[t] || []).filter((r) => !r.user_id || r.user_id === DB.user.id);
  return {
    exported_at: new Date().toISOString(), account: DB.user.email,
    profiles: S.profiles.filter((p) => pids.has(p.id)), medications: S.medications.filter((m) => medIds.has(m.id)),
    med_logs: S.med_logs.filter((l) => medIds.has(l.medication_id)), appointments: S.appointments.filter((a) => pids.has(a.profile_id)),
    care_plans: S.care_plans.filter((c) => planIds.has(c.id)), care_logs: S.care_logs.filter((l) => planIds.has(l.plan_id)),
    mood_logs: (S.mood_logs || []).filter((l) => pids.has(l.profile_id)),
    circles: mine('circles'), emergency_contacts: mine('emergency_contacts'), hospitals: mine('hospitals'), doctors: mine('doctors'), settings: S.settings,
  };
}
function exportMyData() {
  const blob = new Blob([JSON.stringify(myData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sookjai-mydata-${todayKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('ดาวน์โหลดข้อมูลแล้ว');
}

function deleteMyDataSheet() {
  const sheet = openSheet(`<h3>ลบข้อมูลทั้งหมดของฉัน</h3>
    <div class="alert red"><div class="ic">⚠️</div><div><b>ย้อนกลับไม่ได้</b><span class="small">จะลบคนในครอบครัวที่คุณสร้าง ยา นัดหมอ รูป บันทึกอาการ อารมณ์ กลุ่มผู้ดูแลของคุณ และออกจากกลุ่มที่คนอื่นแชร์มา แนะนำให้ดาวน์โหลดข้อมูลเก็บไว้ก่อน</span></div></div>
    <p class="small muted">หากต้องการลบบัญชีผู้ใช้ (อีเมล) ด้วย ${CFG.PRIVACY_CONTACT ? `ติดต่อ ${esc(CFG.PRIVACY_CONTACT)}` : 'ติดต่อผู้ดูแลระบบของแอพ'}</p>
    <label class="f"><span>พิมพ์คำว่า <b>ลบข้อมูล</b> เพื่อยืนยัน</span><input type="text" id="delConfirm" autocomplete="off"></label>
    <div class="row sticky-actions"><button class="btn ghost" data-act="close">ยกเลิก</button><button class="btn danger" id="delGo" disabled>ลบทั้งหมด</button></div>`);
  const inp = $('#delConfirm', sheet), go = $('#delGo', sheet);
  inp.oninput = () => (go.disabled = inp.value.trim() !== 'ลบข้อมูล');
  go.onclick = async () => {
    go.disabled = true; go.textContent = 'กำลังลบ…';
    try {
      if (DB.mode !== 'supabase') { DB.reset(false); location.reload(); return; }
      const d = myData(); const uid = DB.user.id;
      const files = [...d.appointments.flatMap((a) => a.attachments || []), ...d.care_logs.flatMap((l) => l.photos || [])];
      await DB.removeFiles(files).catch(() => {});
      for (const c of d.circles) await DB.remove('circles', c.id);
      for (const p of d.profiles) await DB.remove('profiles', p.id);
      for (const t of ['emergency_contacts', 'hospitals', 'doctors', 'med_logs', 'mood_logs', 'circle_members', 'circle_invites', 'care_logs', 'care_plans', 'appointments', 'medications', 'push_subscriptions', 'user_settings']) {
        await DB.removeWhere(t, t === 'circle_invites' ? 'invited_by' : 'user_id', uid).catch((e) => console.warn(t, e));
      }
      await DB.signOut(); alert('ลบข้อมูลของคุณเรียบร้อยแล้ว'); location.reload();
    } catch (e) { console.error(e); go.disabled = false; go.textContent = 'ลบทั้งหมด'; toast('ลบไม่สำเร็จ: ' + e.message); }
  };
}
