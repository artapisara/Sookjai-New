/* สุขใจ — แอพเตือนกินยาและนัดหมอ (ต้นแบบ)
 * เก็บข้อมูลไว้ในเครื่อง (localStorage) — ไม่มีเซิร์ฟเวอร์
 */
(() => {
  'use strict';

  // ---------- ค่าคงที่ ----------
  const STORE_KEY = 'sukjai-v1';
  const SLOTS = [
    { key: 'morning', label: 'เช้า', icon: '🌅' },
    { key: 'noon', label: 'กลางวัน', icon: '☀️' },
    { key: 'evening', label: 'เย็น', icon: '🌇' },
    { key: 'bed', label: 'ก่อนนอน', icon: '🌙' },
  ];
  const MEAL = { before: 'ก่อนอาหาร', after: 'หลังอาหาร', none: 'ไม่ขึ้นกับอาหาร' };
  const AVATARS = ['👴', '👵', '👨', '👩', '🧓', '👨‍🦳', '👩‍🦳', '🧑', '👦', '👧', '🐱', '🐶', '🌻', '🌷'];
  const COLORS = ['#3FA796', '#F2785C', '#7C6CF2', '#E9A23B', '#4C8BF5', '#D9548F', '#5BAA3C', '#8C6E5D'];
  const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const DOW = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const DOW_L = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const REMIND_DAYS = [5, 2, 1];
  const LOW_STOCK_DAYS = 7;

  // ---------- ตัวช่วย ----------
  const $ = (s) => document.querySelector(s);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pad = (n) => String(n).padStart(2, '0');
  const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseDk = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayKey = () => dk(new Date());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const daysUntil = (key) => Math.round((parseDk(key) - parseDk(todayKey())) / 86400000);
  const thDate = (key, long) => {
    const d = parseDk(key);
    return long
      ? `${DOW_L[d.getDay()]}ที่ ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
      : `${d.getDate()} ${MONTHS_S[d.getMonth()]} ${String(d.getFullYear() + 543).slice(2)}`;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, def = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : def; };

  // ---------- ข้อมูล ----------
  function demoData() {
    const t = new Date();
    const p1 = uid(), p2 = uid(), p3 = uid(), p4 = uid();
    const med = (personId, name, purpose, times, extra = {}) => ({
      id: uid(), personId, name, purpose, times, dose: 1, unit: 'เม็ด', meal: 'after',
      stock: 30, status: 'active', note: '', order: 0, updatedAt: todayKey(), history: [], ...extra,
    });
    const meds = [
      med(p1, 'Amlodipine 5 mg', 'ความดันโลหิตสูง', ['morning'], { stock: 5 }),
      med(p1, 'Metformin 500 mg', 'เบาหวาน', ['morning', 'evening']),
      med(p2, 'Simvastatin 20 mg', 'ไขมันในเลือด', ['bed']),
      med(p2, 'Calcium + Vit D', 'บำรุงกระดูก', ['noon'], { meal: 'after', stock: 60 }),
      med(p3, 'Losartan 50 mg', 'ความดันโลหิตสูง', ['morning']),
      med(p4, 'Vitamin B1-6-12', 'บำรุงปลายประสาท', ['morning'], { stock: 20 }),
      med(p1, 'Aspirin 81 mg', 'ป้องกันหลอดเลือด', ['morning'], {
        status: 'paused', history: [{ date: todayKey(), action: 'พักยา', reason: 'หมอให้หยุดก่อนทำฟัน' }],
      }),
    ];
    meds.forEach((m, i) => (m.order = i));
    return {
      people: [
        { id: p1, name: 'คุณปู่', avatar: '👴', color: COLORS[0], conditions: 'ความดันสูง, เบาหวาน' },
        { id: p2, name: 'คุณย่า', avatar: '👵', color: COLORS[1], conditions: 'ไขมันสูง' },
        { id: p3, name: 'พ่อ', avatar: '👨', color: COLORS[2], conditions: 'ความดันสูง' },
        { id: p4, name: 'แม่', avatar: '👩', color: COLORS[3], conditions: '' },
      ],
      meds,
      appts: [
        { id: uid(), personId: p1, date: dk(addDays(t, 2)), time: '09:00', doctor: 'นพ.สมชาย', place: 'รพ.ศิริราช ตึก 3', note: 'งดน้ำงดอาหารหลังเที่ยงคืน' },
        { id: uid(), personId: p2, date: dk(addDays(t, 5)), time: '13:30', doctor: 'พญ.วิไล', place: 'คลินิกอายุรกรรม', note: 'เอาสมุดยาไปด้วย' },
        { id: uid(), personId: p3, date: dk(addDays(t, 16)), time: '10:00', doctor: 'นพ.ธนา', place: 'รพ.ใกล้บ้าน', note: '' },
      ],
      taken: {},
      settings: { slotTimes: { morning: '08:00', noon: '12:00', evening: '18:00', bed: '21:00' }, notified: {} },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ใช้ข้อมูลตัวอย่าง */ }
    return demoData();
  }
  let S = load();
  S.settings = S.settings || {};
  S.settings.slotTimes = S.settings.slotTimes || { morning: '08:00', noon: '12:00', evening: '18:00', bed: '21:00' };
  S.settings.notified = S.settings.notified || {};
  S.taken = S.taken || {};

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { toast('บันทึกไม่สำเร็จ — พื้นที่ในเครื่องอาจเต็ม'); }
  }

  const person = (id) => S.people.find((p) => p.id === id) || { name: 'ไม่ระบุ', avatar: '❔', color: '#999' };
  const activeMeds = () => S.meds.filter((m) => m.status === 'active').sort((a, b) => a.order - b.order);
  const dailyUse = (m) => (m.times?.length || 0) * num(m.dose, 1);
  const daysLeft = (m) => (dailyUse(m) ? Math.floor(num(m.stock) / dailyUse(m)) : Infinity);

  // ---------- สถานะหน้าจอ ----------
  const ui = {
    tab: 'today',
    filter: 'all',
    calMonth: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
    calSel: todayKey(),
  };

  // ---------- องค์ประกอบ UI ----------
  const av = (p, cls = '') => `<div class="av ${cls}" style="background:${p.color}22">${esc(p.avatar)}</div>`;

  function personChips() {
    return `<div class="chips">
      <button class="chip ${ui.filter === 'all' ? 'on' : ''}" data-act="filter" data-id="all">ทุกคน</button>
      ${S.people.map((p) => `<button class="chip ${ui.filter === p.id ? 'on' : ''}" data-act="filter" data-id="${p.id}">
        <span>${esc(p.avatar)}</span>${esc(p.name)}</button>`).join('')}
    </div>`;
  }
  const byFilter = (arr) => (ui.filter === 'all' ? arr : arr.filter((x) => x.personId === ui.filter));

  function ring(done, total) {
    const r = 36, c = 2 * Math.PI * r, pct = total ? done / total : 0;
    return `<svg class="ring" viewBox="0 0 84 84"><circle class="bg" cx="42" cy="42" r="${r}"/>
      <circle class="fg" cx="42" cy="42" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
      <text x="42" y="42">${Math.round(pct * 100)}%</text></svg>`;
  }

  function apptAlerts() {
    return S.appts
      .map((a) => ({ a, n: daysUntil(a.date) }))
      .filter(({ n }) => n >= 0 && n <= Math.max(...REMIND_DAYS))
      .sort((x, y) => x.n - y.n)
      .map(({ a, n }) => {
        const p = person(a.personId);
        const when = n === 0 ? 'วันนี้' : n === 1 ? 'พรุ่งนี้' : `อีก ${n} วัน`;
        return `<div class="alert ${n <= 1 ? 'warn' : 'sun'}"><div class="ic">🩺</div><div>
          <b>${esc(p.avatar)} ${esc(p.name)} นัดหมอ${when}</b>
          <span class="small">${thDate(a.date)} · ${esc(a.time)} น. · ${esc(a.doctor)}${a.place ? ' · ' + esc(a.place) : ''}</span>
          ${a.note ? `<div class="small muted">📝 ${esc(a.note)}</div>` : ''}
        </div></div>`;
      }).join('');
  }

  function stockAlerts() {
    const low = activeMeds().filter((m) => daysLeft(m) <= LOW_STOCK_DAYS);
    if (!low.length) return '';
    return `<div class="alert warn"><div class="ic">📦</div><div><b>ยาใกล้หมด ควรเตรียมซื้อ/รับยาเพิ่ม</b>
      <span class="small">${low.map((m) => `${esc(person(m.personId).name)}: ${esc(m.name)} (เหลือ ${num(m.stock)} ${esc(m.unit)} ≈ ${daysLeft(m)} วัน)`).join('<br>')}</span>
    </div></div>`;
  }

  // ---------- หน้า: วันนี้ ----------
  function viewToday() {
    const key = todayKey();
    const takenToday = S.taken[key] || {};
    const meds = byFilter(activeMeds());
    let total = 0, done = 0;
    const slotHtml = SLOTS.map((s) => {
      const list = meds.filter((m) => m.times.includes(s.key));
      if (!list.length) return '';
      const rows = list.map((m) => {
        const p = person(m.personId);
        const k = `${m.id}|${s.key}`;
        const isDone = !!takenToday[k];
        total++; if (isDone) done++;
        return `<div class="dose ${isDone ? 'done' : ''}">
          ${av(p, 'sm')}
          <div class="info"><div class="name">${esc(m.name)}</div>
            <div class="small muted">${esc(p.name)} · ${num(m.dose)} ${esc(m.unit)} · ${MEAL[m.meal] || ''}
            ${isDone ? ` · ✓ ${new Date(takenToday[k]).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : ''}</div>
          </div>
          <button class="check ${isDone ? 'on' : ''}" data-act="take" data-id="${m.id}" data-slot="${s.key}" aria-label="กินแล้ว">${isDone ? '✓' : ''}</button>
        </div>`;
      }).join('');
      return `<div class="card"><div class="slot-head"><span style="font-size:26px">${s.icon}</span>
        <span class="t">${s.label}</span><span class="time">${S.settings.slotTimes[s.key]} น.</span></div>${rows}</div>`;
    }).join('');

    const hour = new Date().getHours();
    const greet = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
    return `
      <div class="header"><div class="logo"><img src="icon.svg" alt=""><div><h1>สุขใจ</h1>
        <p class="sub">${greet} · ${thDate(key, true)}</p></div></div></div>
      <div class="card hero">${ring(done, total)}<div>
        <div class="small" style="opacity:.85">กินยาวันนี้</div>
        <div class="big">${done} / ${total} มื้อ</div>
        <div class="small" style="opacity:.85">${total === 0 ? 'ยังไม่มียาในตาราง' : done === total ? 'ครบแล้ว เก่งมาก 🎉' : `เหลืออีก ${total - done} มื้อ`}</div>
      </div></div>
      ${apptAlerts()}${stockAlerts()}
      ${personChips()}
      ${slotHtml || `<div class="card empty"><div class="e">💊</div>ยังไม่มียาที่ต้องกิน<br><button class="btn sm" data-act="add-med" style="margin-top:10px">+ เพิ่มยา</button></div>`}
    `;
  }

  // ---------- หน้า: ยา ----------
  function medCard(m, withOrder) {
    const p = person(m.personId);
    const dl = daysLeft(m);
    const last = m.history?.[m.history.length - 1];
    return `<div class="card med">
      <div class="stripe" style="background:${p.color}"></div>
      <div class="info">
        <div class="name">${esc(m.name)}</div>
        <div class="small muted">${esc(p.avatar)} ${esc(p.name)}${m.purpose ? ' · รักษา: ' + esc(m.purpose) : ''}</div>
        <div>
          ${m.times.map((t) => `<span class="tag">${SLOTS.find((s) => s.key === t)?.icon} ${SLOTS.find((s) => s.key === t)?.label}</span>`).join('')}
          <span class="tag sun">${num(m.dose)} ${esc(m.unit)} · ${MEAL[m.meal]}</span>
          ${m.status === 'active' ? `<span class="tag ${dl <= LOW_STOCK_DAYS ? 'warn' : ''}">เหลือ ${num(m.stock)} ${esc(m.unit)}${dl !== Infinity ? ` (~${dl} วัน)` : ''}</span>` : ''}
        </div>
        <div class="small muted">อัปเดตล่าสุด ${thDate(m.updatedAt)}</div>
        ${m.status !== 'active' && last ? `<div class="hist">${esc(last.action)} เมื่อ ${thDate(last.date)}${last.reason ? ' — ' + esc(last.reason) : ''}</div>` : ''}
      </div>
      <div class="order">
        ${withOrder ? `<button class="iconbtn" data-act="up" data-id="${m.id}" aria-label="เลื่อนขึ้น">▲</button>
        <button class="iconbtn" data-act="down" data-id="${m.id}" aria-label="เลื่อนลง">▼</button>` : ''}
        <button class="iconbtn" data-act="edit-med" data-id="${m.id}" aria-label="แก้ไข">✏️</button>
      </div>
    </div>`;
  }

  function viewMeds() {
    const act = byFilter(activeMeds());
    const off = byFilter(S.meds.filter((m) => m.status !== 'active'));
    return `
      <h1>รายการยา</h1><p class="sub">เรียงลำดับด้วย ▲▼ — ตารางกินยาประจำวันจะเรียงตามนี้</p>
      <div style="height:10px"></div>${personChips()}
      <h2>กำลังใช้อยู่ <span class="small muted">${act.length} รายการ</span></h2>
      ${act.map((m) => medCard(m, true)).join('') || `<div class="card empty"><div class="e">💊</div>ยังไม่มียา กดปุ่ม + เพื่อเพิ่ม</div>`}
      <h2>พักยา / หยุดยา <span class="small muted">${off.length} รายการ</span></h2>
      ${off.map((m) => medCard(m, false)).join('') || `<div class="card empty small">ไม่มียาที่พักหรือหยุดไว้</div>`}
      <button class="fab" data-act="add-med" aria-label="เพิ่มยา">+</button>
    `;
  }

  // ---------- หน้า: นัดหมอ ----------
  function viewAppts() {
    const m = ui.calMonth;
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    const appts = byFilter(S.appts);
    const map = {};
    appts.forEach((a) => (map[a.date] = map[a.date] || []).push(a));
    let cells = DOW.map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i); const key = dk(d);
      const list = map[key] || [];
      cells += `<button class="d ${d.getMonth() !== m.getMonth() ? 'out' : ''} ${key === todayKey() ? 'today' : ''} ${key === ui.calSel ? 'sel' : ''} ${list.length ? 'has' : ''}" data-act="sel-day" data-id="${key}">
        ${d.getDate()}<span class="dots">${list.slice(0, 3).map((a) => `<i style="background:${person(a.personId).color}"></i>`).join('')}</span></button>`;
    }
    const selList = (map[ui.calSel] || []).sort((a, b) => a.time.localeCompare(b.time));
    const upcoming = appts.filter((a) => daysUntil(a.date) >= 0).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const past = appts.filter((a) => daysUntil(a.date) < 0).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    return `
      <h1>นัดหมอ</h1><p class="sub">ปฏิทินแยกสีตามแต่ละคน · เตือนล่วงหน้า 5, 2 และ 1 วัน</p>
      <div style="height:10px"></div>${personChips()}
      <div class="card">
        <div class="cal-nav"><button class="iconbtn" data-act="cal-prev" aria-label="เดือนก่อน">◀</button>
          <b>${MONTHS[m.getMonth()]} ${m.getFullYear() + 543}</b>
          <button class="iconbtn" data-act="cal-next" aria-label="เดือนถัดไป">▶</button></div>
        <div class="cal">${cells}</div>
        <div class="chips" style="padding-top:12px">${S.people.map((p) => `<span class="small" style="display:flex;align-items:center;gap:4px;flex:none"><i style="width:10px;height:10px;border-radius:50%;background:${p.color};display:inline-block"></i>${esc(p.name)}</span>`).join('')}</div>
      </div>
      <h2>${thDate(ui.calSel, true)}</h2>
      ${selList.map(apptCard).join('') || `<div class="card empty small">ไม่มีนัดวันนี้ <button class="btn sm" data-act="add-appt" data-id="${ui.calSel}" style="margin-left:8px">+ เพิ่มนัด</button></div>`}
      <h2>นัดที่กำลังจะถึง</h2>
      ${upcoming.map(apptCard).join('') || `<div class="card empty small">ยังไม่มีนัดล่วงหน้า</div>`}
      ${past.length ? `<h2>นัดที่ผ่านมา</h2>${past.map(apptCard).join('')}` : ''}
      <button class="fab" data-act="add-appt" data-id="${ui.calSel}" aria-label="เพิ่มนัด">+</button>
    `;
  }

  function apptCard(a) {
    const p = person(a.personId); const d = parseDk(a.date); const n = daysUntil(a.date);
    const cd = n < 0 ? '' : n === 0 ? '<span class="countdown hot">วันนี้</span>' : n === 1 ? '<span class="countdown hot">พรุ่งนี้</span>' : `<span class="countdown">อีก ${n} วัน</span>`;
    return `<div class="card appt" data-act="edit-appt" data-id="${a.id}" style="${n < 0 ? 'opacity:.6' : ''}">
      <div class="date" style="background:${p.color}"><b>${d.getDate()}</b><span>${MONTHS_S[d.getMonth()]}</span></div>
      <div class="info"><div style="display:flex;gap:8px;align-items:center;justify-content:space-between"><b>${esc(p.avatar)} ${esc(p.name)}</b>${cd}</div>
        <div class="small">🕘 ${esc(a.time)} น. · 👨‍⚕️ ${esc(a.doctor) || '-'}</div>
        ${a.place ? `<div class="small muted">📍 ${esc(a.place)}</div>` : ''}
        ${a.note ? `<div class="small muted">📝 ${esc(a.note)}</div>` : ''}
      </div></div>`;
  }

  // ---------- หน้า: ครอบครัว ----------
  function viewPeople() {
    return `
      <h1>ครอบครัว</h1><p class="sub">คนที่เราดูแล — เลือกรูปและสีประจำตัวได้</p>
      <div style="height:14px"></div>
      ${S.people.map((p) => {
        const n = S.meds.filter((m) => m.personId === p.id && m.status === 'active').length;
        const next = S.appts.filter((a) => a.personId === p.id && daysUntil(a.date) >= 0).sort((a, b) => a.date.localeCompare(b.date))[0];
        return `<div class="card person" data-act="edit-person" data-id="${p.id}" style="border-left:6px solid ${p.color}">
          ${av(p, 'lg')}<div class="info"><b style="font-size:20px">${esc(p.name)}</b>
          ${p.conditions ? `<div class="small">🩺 โรคประจำตัว: ${esc(p.conditions)}</div>` : ''}
          <div class="small muted">💊 ยา ${n} รายการ${next ? ` · 📅 นัดถัดไป ${thDate(next.date)}` : ''}</div></div>
          <span class="muted">›</span></div>`;
      }).join('')}
      <button class="btn block" data-act="add-person">+ เพิ่มคนในครอบครัว</button>

      <h2>ตั้งค่า</h2>
      <div class="card">
        <b>เวลาเตือนแต่ละมื้อ</b>
        <div class="two" style="margin-top:10px">
          ${SLOTS.map((s) => `<label class="f"><span>${s.icon} ${s.label}</span><input type="time" data-slot-time="${s.key}" value="${S.settings.slotTimes[s.key]}"></label>`).join('')}
        </div>
        <button class="btn ghost block" data-act="notif">🔔 เปิดการแจ้งเตือนบนเครื่องนี้</button>
        <p class="small muted" style="margin:8px 0 0">ต้นแบบนี้แจ้งเตือนได้ขณะเปิดแอพค้างไว้ (เบราว์เซอร์จำกัดการเตือนตอนปิดแอพ) — แอพจริงบนสโตร์จะเตือนได้แม้ปิดแอพ</p>
      </div>
      <div class="card">
        <b>สำรองข้อมูล</b>
        <p class="small muted" style="margin:4px 0 10px">ข้อมูลเก็บในเครื่องนี้เท่านั้น ควรสำรองไว้เป็นระยะ</p>
        <div class="row"><button class="btn ghost" data-act="export">⬇️ ส่งออก</button>
          <button class="btn ghost" data-act="import">⬆️ นำเข้า</button></div>
        <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="demo">ใช้ข้อมูลตัวอย่าง</button>
          <button class="btn danger" data-act="wipe">ล้างข้อมูลทั้งหมด</button></div>
        <input type="file" id="importFile" accept="application/json" hidden>
      </div>
      <p class="small muted" style="text-align:center">สุขใจ · ต้นแบบ v0.1 · ใช้ประกอบการดูแล ไม่แทนคำแนะนำของแพทย์/เภสัชกร</p>
    `;
  }

  // ---------- ฟอร์ม ----------
  function openSheet(html) { const m = $('#modal'); m.innerHTML = `<div class="sheet">${html}</div>`; m.classList.remove('hidden'); }
  function closeSheet() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; }

  function personSelect(sel) {
    return `<label class="f"><span>ของใคร</span><div class="pick">${S.people.map((p, i) => `<label>
      <input type="radio" name="personId" value="${p.id}" ${(sel ? sel === p.id : (ui.filter !== 'all' ? ui.filter === p.id : i === 0)) ? 'checked' : ''}>
      <span class="opt">${esc(p.avatar)} ${esc(p.name)}</span></label>`).join('')}</div></label>`;
  }

  function medForm(m) {
    if (!S.people.length) { toast('เพิ่มคนในครอบครัวก่อนนะ'); return go('people'); }
    const e = m || { times: ['morning'], dose: 1, unit: 'เม็ด', meal: 'after', stock: 30, status: 'active' };
    openSheet(`<h3>${m ? 'แก้ไขยา' : 'เพิ่มยา'}</h3>
      <form id="f">
        ${personSelect(e.personId)}
        <label class="f"><span>ชื่อยา</span><input type="text" name="name" required value="${esc(e.name)}" placeholder="เช่น Amlodipine 5 mg"></label>
        <label class="f"><span>ใช้รักษา / อาการ</span><input type="text" name="purpose" value="${esc(e.purpose)}" placeholder="เช่น ความดันสูง"></label>
        <label class="f"><span>กินมื้อไหน</span><div class="pick">${SLOTS.map((s) => `<label>
          <input type="checkbox" name="times" value="${s.key}" ${e.times.includes(s.key) ? 'checked' : ''}><span class="opt">${s.icon} ${s.label}</span></label>`).join('')}</div></label>
        <div class="two">
          <label class="f"><span>ครั้งละ</span><input type="number" name="dose" min="0" step="0.5" value="${num(e.dose, 1)}"></label>
          <label class="f"><span>หน่วย</span><select name="unit">${['เม็ด', 'แคปซูล', 'ช้อนชา', 'ช้อนโต๊ะ', 'ซีซี', 'หยด', 'ยูนิต', 'ซอง'].map((u) => `<option ${u === e.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
        </div>
        <label class="f"><span>ช่วงเวลา</span><div class="pick">${Object.entries(MEAL).map(([k, v]) => `<label>
          <input type="radio" name="meal" value="${k}" ${e.meal === k ? 'checked' : ''}><span class="opt">${v}</span></label>`).join('')}</div></label>
        <label class="f"><span>จำนวนยาคงเหลือ (${esc(e.unit)})</span><input type="number" name="stock" min="0" step="0.5" value="${num(e.stock)}"></label>
        <label class="f"><span>หมายเหตุ</span><textarea name="note" placeholder="เช่น ห้ามกินพร้อมนม">${esc(e.note)}</textarea></label>
        ${m ? `<div class="card" style="background:var(--bg);box-shadow:none">
          <b>สถานะยา</b> <span class="tag ${m.status === 'active' ? '' : 'warn'}">${{ active: 'กำลังใช้', paused: 'พักยา', stopped: 'หยุดยา' }[m.status]}</span>
          <div class="row" style="margin-top:10px">
            ${m.status === 'active'
              ? `<button type="button" class="btn ghost sm" data-act="status" data-id="${m.id}" data-to="paused">⏸ พักยา</button>
                 <button type="button" class="btn ghost sm" data-act="status" data-id="${m.id}" data-to="stopped">⏹ หยุดยา</button>`
              : `<button type="button" class="btn sm" data-act="status" data-id="${m.id}" data-to="active">▶️ กลับมาใช้</button>`}
          </div>
          ${(m.history || []).length ? `<div class="hist">${m.history.slice().reverse().map((h) => `${thDate(h.date)} · ${esc(h.action)}${h.reason ? ' — ' + esc(h.reason) : ''}`).join('<br>')}</div>` : ''}
        </div>` : ''}
        <div class="row" style="margin-top:6px">
          ${m ? `<button type="button" class="btn danger" data-act="del-med" data-id="${m.id}">ลบ</button>` : ''}
          <button type="button" class="btn ghost" data-act="close">ยกเลิก</button>
          <button class="btn" type="submit">บันทึก</button>
        </div>
      </form>`);
    $('#f').onsubmit = (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const times = fd.getAll('times');
      if (!times.length) return toast('เลือกอย่างน้อย 1 มื้อ');
      const data = {
        personId: fd.get('personId'), name: fd.get('name').trim(), purpose: fd.get('purpose').trim(), times,
        dose: num(fd.get('dose'), 1), unit: fd.get('unit'), meal: fd.get('meal'), stock: num(fd.get('stock')),
        note: fd.get('note').trim(), updatedAt: todayKey(),
      };
      if (m) Object.assign(m, data);
      else S.meds.push({ id: uid(), status: 'active', history: [{ date: todayKey(), action: 'เริ่มใช้ยา', reason: '' }], order: Math.max(-1, ...S.meds.map((x) => x.order)) + 1, ...data });
      save(); closeSheet(); render(); toast('บันทึกแล้ว');
    };
  }

  function statusForm(m, to) {
    const label = { paused: 'พักยา', stopped: 'หยุดยา', active: 'กลับมาใช้ยา' }[to];
    openSheet(`<h3>${label}: ${esc(m.name)}</h3><form id="f">
      <label class="f"><span>เหตุผล (ไม่บังคับ)</span><input type="text" name="reason" placeholder="${to === 'active' ? 'เช่น หมอให้กลับมากินต่อ' : 'เช่น หมอสั่งหยุด, แพ้ยา'}"></label>
      <div class="row"><button type="button" class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" type="submit">ยืนยัน</button></div></form>`);
    $('#f').onsubmit = (ev) => {
      ev.preventDefault();
      m.status = to; m.updatedAt = todayKey();
      (m.history = m.history || []).push({ date: todayKey(), action: label, reason: new FormData(ev.target).get('reason').trim() });
      save(); closeSheet(); render(); toast(`${label}แล้ว`);
    };
  }

  function apptForm(a, date) {
    if (!S.people.length) { toast('เพิ่มคนในครอบครัวก่อนนะ'); return go('people'); }
    const e = a || { date: date || todayKey(), time: '09:00' };
    openSheet(`<h3>${a ? 'แก้ไขนัดหมอ' : 'เพิ่มนัดหมอ'}</h3><form id="f">
      ${personSelect(e.personId)}
      <div class="two">
        <label class="f"><span>วันที่</span><input type="date" name="date" required value="${e.date}"></label>
        <label class="f"><span>เวลา</span><input type="time" name="time" required value="${e.time}"></label>
      </div>
      <label class="f"><span>ชื่อหมอ</span><input type="text" name="doctor" value="${esc(e.doctor)}" placeholder="เช่น นพ.สมชาย"></label>
      <label class="f"><span>สถานที่</span><input type="text" name="place" value="${esc(e.place)}" placeholder="เช่น รพ.ศิริราช ตึก 3 ชั้น 2"></label>
      <label class="f"><span>สิ่งที่ต้องเตรียม / หมายเหตุ</span><textarea name="note" placeholder="เช่น งดน้ำงดอาหาร, เอาสมุดยาไปด้วย">${esc(e.note)}</textarea></label>
      <p class="small muted" style="margin-top:-6px">🔔 จะเตือนล่วงหน้า 5 วัน, 2 วัน และ 1 วัน</p>
      <div class="row">
        ${a ? `<button type="button" class="btn danger" data-act="del-appt" data-id="${a.id}">ลบ</button>` : ''}
        <button type="button" class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" type="submit">บันทึก</button></div></form>`);
    $('#f').onsubmit = (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const data = { personId: fd.get('personId'), date: fd.get('date'), time: fd.get('time'), doctor: fd.get('doctor').trim(), place: fd.get('place').trim(), note: fd.get('note').trim() };
      if (a) Object.assign(a, data); else S.appts.push({ id: uid(), ...data });
      ui.calSel = data.date; const d = parseDk(data.date); ui.calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      save(); closeSheet(); render(); toast('บันทึกนัดแล้ว');
    };
  }

  function personForm(p) {
    const e = p || { avatar: AVATARS[0], color: COLORS[S.people.length % COLORS.length] };
    openSheet(`<h3>${p ? 'แก้ไขข้อมูล' : 'เพิ่มคนในครอบครัว'}</h3><form id="f">
      <label class="f"><span>ชื่อเรียก</span><input type="text" name="name" required value="${esc(e.name)}" placeholder="เช่น คุณยาย"></label>
      <label class="f"><span>รูปประจำตัว</span><div class="pick">${AVATARS.map((a) => `<label><input type="radio" name="avatar" value="${a}" ${a === e.avatar ? 'checked' : ''}><span class="opt emo">${a}</span></label>`).join('')}</div></label>
      <label class="f"><span>สีในปฏิทิน</span><div class="pick">${COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === e.color ? 'checked' : ''}><span class="opt sw" style="background:${c}"></span></label>`).join('')}</div></label>
      <label class="f"><span>โรคประจำตัว</span><input type="text" name="conditions" value="${esc(e.conditions)}" placeholder="เช่น ความดันสูง, เบาหวาน"></label>
      <div class="row">
        ${p ? `<button type="button" class="btn danger" data-act="del-person" data-id="${p.id}">ลบ</button>` : ''}
        <button type="button" class="btn ghost" data-act="close">ยกเลิก</button><button class="btn" type="submit">บันทึก</button></div></form>`);
    $('#f').onsubmit = (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const data = { name: fd.get('name').trim(), avatar: fd.get('avatar'), color: fd.get('color'), conditions: fd.get('conditions').trim() };
      if (p) Object.assign(p, data); else S.people.push({ id: uid(), ...data });
      save(); closeSheet(); render(); toast('บันทึกแล้ว');
    };
  }

  function confirmSheet(msg, onYes) {
    openSheet(`<h3>${msg}</h3><div class="row"><button class="btn ghost" data-act="close">ยกเลิก</button><button class="btn danger" id="yes">ยืนยัน</button></div>`);
    $('#yes').onclick = () => { onYes(); closeSheet(); render(); };
  }

  // ---------- การกระทำ ----------
  function toggleTake(medId, slot) {
    const key = todayKey(); const m = S.meds.find((x) => x.id === medId); if (!m) return;
    S.taken[key] = S.taken[key] || {};
    const k = `${medId}|${slot}`;
    if (S.taken[key][k]) { delete S.taken[key][k]; m.stock = num(m.stock) + num(m.dose, 1); }
    else { S.taken[key][k] = Date.now(); m.stock = Math.max(0, num(m.stock) - num(m.dose, 1)); toast(`✓ ${person(m.personId).name} กิน ${m.name} แล้ว`); }
    // เก็บประวัติย้อนหลัง 60 วัน
    const cutoff = dk(addDays(new Date(), -60));
    Object.keys(S.taken).forEach((d) => { if (d < cutoff) delete S.taken[d]; });
    save(); render();
  }

  function move(id, dir) {
    const list = byFilter(activeMeds());
    const i = list.findIndex((m) => m.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i].order, list[j].order] = [list[j].order, list[i].order];
    save(); render();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `sukjai-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(a.href);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  document.addEventListener('click', (ev) => {
    if (ev.target.id === 'modal') return closeSheet();
    const el = ev.target.closest('[data-act], [data-tab]');
    if (!el) return;
    if (el.dataset.tab) return go(el.dataset.tab);
    const { act, id } = el.dataset;
    const med = () => S.meds.find((m) => m.id === id);
    switch (act) {
      case 'filter': ui.filter = id; render(); break;
      case 'take': toggleTake(id, el.dataset.slot); break;
      case 'add-med': medForm(); break;
      case 'edit-med': medForm(med()); break;
      case 'up': move(id, -1); break;
      case 'down': move(id, 1); break;
      case 'status': statusForm(med(), el.dataset.to); break;
      case 'del-med': confirmSheet('ลบยานี้ถาวร? (ถ้าแค่เลิกกิน แนะนำใช้ "หยุดยา" เพื่อเก็บประวัติ)', () => { S.meds = S.meds.filter((m) => m.id !== id); save(); }); break;
      case 'add-appt': apptForm(null, id); break;
      case 'edit-appt': apptForm(S.appts.find((a) => a.id === id)); break;
      case 'del-appt': confirmSheet('ลบนัดนี้?', () => { S.appts = S.appts.filter((a) => a.id !== id); save(); }); break;
      case 'sel-day': ui.calSel = id; render(); break;
      case 'cal-prev': ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() - 1, 1); render(); break;
      case 'cal-next': ui.calMonth = new Date(ui.calMonth.getFullYear(), ui.calMonth.getMonth() + 1, 1); render(); break;
      case 'add-person': personForm(); break;
      case 'edit-person': personForm(S.people.find((p) => p.id === id)); break;
      case 'del-person': confirmSheet('ลบคนนี้ พร้อมยาและนัดทั้งหมดของเขา?', () => {
        S.people = S.people.filter((p) => p.id !== id); S.meds = S.meds.filter((m) => m.personId !== id); S.appts = S.appts.filter((a) => a.personId !== id);
        if (ui.filter === id) ui.filter = 'all'; save();
      }); break;
      case 'close': closeSheet(); break;
      case 'export': exportData(); break;
      case 'import': $('#importFile').click(); break;
      case 'demo': confirmSheet('แทนที่ข้อมูลปัจจุบันด้วยข้อมูลตัวอย่าง?', () => { S = demoData(); ui.filter = 'all'; save(); }); break;
      case 'wipe': confirmSheet('ล้างข้อมูลทั้งหมด? ย้อนกลับไม่ได้', () => {
        S = { people: [], meds: [], appts: [], taken: {}, settings: { slotTimes: S.settings.slotTimes, notified: {} } }; ui.filter = 'all'; save();
      }); break;
      case 'notif': enableNotif(); break;
    }
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.slotTime) { S.settings.slotTimes[t.dataset.slotTime] = t.value; save(); toast('บันทึกเวลาแล้ว'); }
    if (t.id === 'importFile' && t.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try {
          const d = JSON.parse(r.result);
          if (!Array.isArray(d.people) || !Array.isArray(d.meds)) throw new Error();
          S = { appts: [], taken: {}, ...d }; S.settings = S.settings || { slotTimes: { morning: '08:00', noon: '12:00', evening: '18:00', bed: '21:00' } }; S.settings.notified = S.settings.notified || {};
          save(); render(); toast('นำเข้าข้อมูลแล้ว');
        } catch { toast('ไฟล์ไม่ถูกต้อง'); }
      };
      r.readAsText(t.files[0]);
    }
  });

  // ---------- การแจ้งเตือน (ขณะเปิดแอพ) ----------
  async function enableNotif() {
    if (!('Notification' in window)) return toast('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน');
    const r = await Notification.requestPermission();
    toast(r === 'granted' ? 'เปิดการแจ้งเตือนแล้ว 🔔' : 'ยังไม่ได้อนุญาตการแจ้งเตือน');
    if (r === 'granted') checkReminders();
  }
  function notify(tag, title, body) {
    if (S.settings.notified[tag]) return;
    S.settings.notified[tag] = 1; save();
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: 'icon.svg', tag }); } catch { toast(`${title} — ${body}`); }
    } else toast(`🔔 ${title}`);
  }
  function checkReminders() {
    const now = new Date(); const key = todayKey();
    const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    SLOTS.forEach((s) => {
      if (hm < S.settings.slotTimes[s.key]) return;
      const pending = activeMeds().filter((m) => m.times.includes(s.key) && !(S.taken[key] || {})[`${m.id}|${s.key}`]);
      if (pending.length) notify(`${key}-${s.key}`, `${s.icon} ถึงเวลากินยามื้อ${s.label}`, pending.map((m) => `${person(m.personId).name}: ${m.name}`).join(', '));
    });
    S.appts.forEach((a) => {
      const n = daysUntil(a.date);
      if (REMIND_DAYS.includes(n) || n === 0) {
        const p = person(a.personId);
        notify(`${key}-appt-${a.id}`, `🩺 ${p.name} นัดหมอ${n === 0 ? 'วันนี้' : n === 1 ? 'พรุ่งนี้' : `อีก ${n} วัน`}`, `${thDate(a.date)} ${a.time} น. · ${a.doctor} ${a.place}`);
      }
    });
    // ล้างประวัติการเตือนเก่า
    Object.keys(S.settings.notified).forEach((k) => { if (!k.startsWith(key)) delete S.settings.notified[k]; });
  }

  // ---------- แสดงผล ----------
  function go(tab) { ui.tab = tab; render(); window.scrollTo(0, 0); }
  function render() {
    const views = { today: viewToday, meds: viewMeds, appts: viewAppts, people: viewPeople };
    $('#app').innerHTML = views[ui.tab]();
    document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  }

  let lastDay = todayKey();
  setInterval(() => {
    checkReminders();
    if (todayKey() !== lastDay) { lastDay = todayKey(); render(); } // ขึ้นวันใหม่
  }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkReminders(); render(); } });

  save();
  render();
  setTimeout(checkReminders, 1500);
})();
