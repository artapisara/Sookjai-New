/* สุขใจ — ชั้นข้อมูล
 * SupaDB  : ใช้ Supabase (Auth + Postgres + Storage) เมื่อกรอก config.js แล้ว
 * LocalDB : โหมดทดลอง เก็บในเครื่อง (localStorage) เมื่อยังไม่ได้ตั้งค่า Supabase
 * ทั้งสองแบบใช้ชื่อตาราง/คอลัมน์ชุดเดียวกัน
 */
'use strict';

const TABLES = ['profiles', 'medications', 'appointments', 'hospitals', 'doctors', 'med_logs', 'care_plans', 'care_logs', 'circles', 'circle_members', 'circle_care_for', 'circle_invites', 'emergency_contacts', 'mood_logs'];
const HISTORY_MONTHS = 24; // ดูสรุปย้อนหลังได้กี่เดือน (ข้อมูลเก็บในฐานข้อมูลไม่หาย — โหลดมาทีละเดือนตอนเปิดดู)
const BUCKET = 'attachments';

// ---------------- Supabase ----------------
class SupaDB {
  constructor(cfg) {
    this.mode = 'supabase';
    this.cfg = cfg;
    this.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    this.user = null;
  }
  async getUser() { const { data } = await this.sb.auth.getSession(); this.user = data.session?.user || null; return this.user; }
  // เรียก cb นอกคิวของ supabase-js (กันค้างเมื่อ cb ไปเรียก supabase ต่อ)
  onAuth(cb) { this.sb.auth.onAuthStateChange((e, s) => { this.user = s?.user || null; setTimeout(() => cb(this.user, e), 0); }); }
  async updatePassword(password) { const { error } = await this.sb.auth.updateUser({ password }); if (error) throw error; }
  async signIn(email, password) { const { error } = await this.sb.auth.signInWithPassword({ email, password }); if (error) throw error; }
  async signUp(email, password) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
    if (error) throw error; return data.session ? 'ok' : 'confirm';
  }
  async resetPassword(email) { const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin }); if (error) throw error; }
  async signOut() { await this.sb.auth.signOut(); }

  // ---- ยืนยันตัวตน 2 ขั้นตอน (TOTP) ----
  async needsMfa() {
    const { data, error } = await this.sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
  }
  async mfaFactors() { const { data, error } = await this.sb.auth.mfa.listFactors(); if (error) throw error; return { verified: data.totp || [], all: data.all || [] }; }
  async mfaEnroll() {
    const { all } = await this.mfaFactors(); // ล้างรายการที่สมัครค้างไว้แต่ยังไม่ยืนยัน
    for (const f of all.filter((x) => x.factor_type === 'totp' && x.status !== 'verified')) await this.sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await this.sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `สุขใจ ${new Date().toISOString().slice(0, 16)}` });
    if (error) throw error; return data; // { id, totp: { qr_code, secret } }
  }
  async mfaVerify(factorId, code) { const { error } = await this.sb.auth.mfa.challengeAndVerify({ factorId, code }); if (error) throw error; }
  async mfaUnenroll(factorId) { const { error } = await this.sb.auth.mfa.unenroll({ factorId }); if (error) throw error; }

  /** ดึงบันทึกกินยา/อารมณ์ของช่วงวันที่ (แบ่งหน้าละ 1000 แถว เพราะ Supabase จำกัดต่อคำขอ) */
  async logsBetween(table, from, to) {
    const out = []; const size = 1000;
    for (let i = 0; ; i += size) {
      let q = this.sb.from(table).select('*').gte('log_date', from);
      if (to) q = q.lte('log_date', to);
      const { data, error } = await q.order('log_date').order('id').range(i, i + size - 1);
      if (error) throw error;
      out.push(...data); if (data.length < size) break;
    }
    return out;
  }
  async loadMonthLogs(ym) {
    const [y, m] = ym.split('-').map(Number); const last = new Date(y, m, 0).getDate();
    const from = `${ym}-01`; const to = `${ym}-${pad(last)}`;
    const [med_logs, mood_logs] = await Promise.all([this.logsBetween('med_logs', from, to), this.logsBetween('mood_logs', from, to)]);
    return { med_logs, mood_logs };
  }
  async loadAll() {
    const d0 = new Date(); const since = dk(new Date(d0.getFullYear(), d0.getMonth(), 1)); // เริ่มด้วยเดือนนี้ — เดือนก่อนๆ โหลดตอนกดดูย้อนหลัง
    const q = (t) => this.sb.from(t).select('*');
    const [p, m, a, h, d, l, s, cp, cl, c, cm, ccf, ci, ec, ml] = await Promise.all([
      q('profiles').order('created_at'), q('medications').order('sort_order'), q('appointments').order('appt_date'),
      q('hospitals').order('name'), q('doctors').order('name'), this.logsBetween('med_logs', since).then((data) => ({ data })).catch((error) => ({ error })),
      this.sb.from('user_settings').select('*').maybeSingle(),
      q('care_plans').order('created_at'), q('care_logs').order('log_date'),
      q('circles').order('created_at'), q('circle_members').order('joined_at'),
      q('circle_care_for').order('added_at'), q('circle_invites').order('created_at'), q('emergency_contacts').order('created_at'),
      this.logsBetween('mood_logs', since).then((data) => ({ data })).catch((error) => ({ error })),
    ]);
    // ยังไม่ได้รัน schema.sql ล่าสุด (ไม่มีตาราง mood_logs) → เปิดแอพได้ตามปกติ แต่ยังบันทึกอารมณ์ไม่ได้
    if (ml.error?.code === 'PGRST205') { console.warn('ยังไม่มีตาราง mood_logs — รัน supabase/schema.sql ใหม่'); ml.error = null; ml.data = []; }
    for (const r of [p, m, a, h, d, l, s, cp, cl, c, cm, ccf, ci, ec, ml]) if (r.error) throw r.error;
    return { profiles: p.data, medications: m.data, appointments: a.data, hospitals: h.data, doctors: d.data, med_logs: l.data,
      care_plans: cp.data, care_logs: cl.data, circles: c.data, circle_members: cm.data, circle_care_for: ccf.data, circle_invites: ci.data, emergency_contacts: ec.data,
      mood_logs: ml.data,
      settings: { slot_times: { ...DEFAULT_SLOT_TIMES, ...(s.data?.slot_times || {}) }, today_hidden: s.data?.today_hidden || [],
        profile_order: s.data?.profile_order || [], pdpa_consent_at: s.data?.pdpa_consent_at || null, pdpa_version: s.data?.pdpa_version || null } };
  }
  /** ลบทุกแถวของตารางที่ตรงเงื่อนไข (ใช้ตอนผู้ใช้สั่งลบข้อมูลของตัวเอง — RLS ยังจำกัดให้ลบได้เฉพาะของตัวเอง) */
  async removeWhere(t, col, val) { const { error } = await this.sb.from(t).delete().eq(col, val); if (error) throw error; }
  async insert(t, row) { const { error } = await this.sb.from(t).insert(row); if (error) throw error; }
  async update(t, id, patch) { const { error } = await this.sb.from(t).update(patch).eq('id', id); if (error) throw error; }
  async remove(t, id) { const { error } = await this.sb.from(t).delete().eq('id', id); if (error) throw error; }
  async saveSettings(settings) {
    const { error } = await this.sb.from('user_settings').upsert({ user_id: this.user.id, slot_times: settings.slot_times, today_hidden: settings.today_hidden || [],
      profile_order: settings.profile_order || [], pdpa_consent_at: settings.pdpa_consent_at || null, pdpa_version: settings.pdpa_version || null, timezone: 'Asia/Bangkok' });
    if (error) throw error;
  }
  async upload(file, apptId) {
    const blob = await compressImage(file);
    const path = `${this.user.id}/${apptId}/${uuid()}.jpg`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error; return path;
  }
  async fileUrl(path) {
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (error) throw error; return data.signedUrl;
  }
  async removeFiles(paths) { if (paths.length) await this.sb.storage.from(BUCKET).remove(paths); }
  async savePushSubscription(sub) {
    const j = sub.toJSON();
    const { error } = await this.sb.from('push_subscriptions').upsert(
      { user_id: this.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent },
      { onConflict: 'endpoint' });
    if (error) throw error;
  }
}

// ---------------- โหมดทดลอง (ในเครื่อง) ----------------
class LocalDB {
  constructor() {
    this.mode = 'local';
    this.key = 'sukjai-v2';
    this.user = { id: 'local', email: 'โหมดทดลอง (เก็บในเครื่องนี้)' };
    try { this.data = JSON.parse(localStorage.getItem(this.key)); } catch { this.data = null; }
    if (!this.data) this.data = demoData();
    TABLES.forEach((t) => (this.data[t] = this.data[t] || []));
    this.data.settings = this.data.settings || { slot_times: { ...DEFAULT_SLOT_TIMES } };
    this.persist();
  }
  persist() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); }
    catch { toast('พื้นที่ในเครื่องเต็ม — ลองลบรูปแนบบางรูป'); throw new Error('quota'); }
  }
  async getUser() { return this.user; }
  onAuth() {}
  async signOut() {}
  async needsMfa() { return false; }
  async loadAll() { return JSON.parse(JSON.stringify(this.data)); }
  async loadMonthLogs() { return { med_logs: [], mood_logs: [] }; } // โหมดทดลองโหลดครบตั้งแต่แรกแล้ว
  async insert(t, row) { this.data[t].push(JSON.parse(JSON.stringify(row))); this.persist(); }
  async update(t, id, patch) { const r = this.data[t].find((x) => x.id === id); if (r) Object.assign(r, JSON.parse(JSON.stringify(patch))); this.persist(); }
  async remove(t, id) {
    this.data[t] = this.data[t].filter((x) => x.id !== id);
    // ลบแบบต่อเนื่อง เหมือน on delete cascade ในฐานข้อมูล
    if (t === 'profiles') {
      const meds = this.data.medications.filter((m) => m.profile_id === id).map((m) => m.id);
      this.data.medications = this.data.medications.filter((m) => m.profile_id !== id);
      this.data.med_logs = this.data.med_logs.filter((l) => !meds.includes(l.medication_id));
      this.data.appointments = this.data.appointments.filter((a) => a.profile_id !== id);
      const plans = this.data.care_plans.filter((c) => c.profile_id === id).map((c) => c.id);
      this.data.care_plans = this.data.care_plans.filter((c) => c.profile_id !== id);
      this.data.care_logs = this.data.care_logs.filter((l) => !plans.includes(l.plan_id));
      this.data.circle_care_for = this.data.circle_care_for.filter((ccf) => ccf.profile_id !== id);
      this.data.mood_logs = this.data.mood_logs.filter((l) => l.profile_id !== id);
    }
    if (t === 'medications') this.data.med_logs = this.data.med_logs.filter((l) => l.medication_id !== id);
    if (t === 'care_plans') this.data.care_logs = this.data.care_logs.filter((l) => l.plan_id !== id);
    if (t === 'circles') {
      this.data.circle_members = this.data.circle_members.filter((m) => m.circle_id !== id);
      this.data.circle_care_for = this.data.circle_care_for.filter((ccf) => ccf.circle_id !== id);
      this.data.circle_invites = this.data.circle_invites.filter((i) => i.circle_id !== id);
    }
    this.persist();
  }
  async saveSettings(s) { this.data.settings = s; this.persist(); }
  async upload(file) { return blobToDataUrl(await compressImage(file, 1000, 0.6)); }
  async fileUrl(path) { return path; }
  async removeFiles() {}
  reset(withDemo) { this.data = withDemo ? demoData() : { settings: { slot_times: { ...DEFAULT_SLOT_TIMES } } }; TABLES.forEach((t) => (this.data[t] = this.data[t] || [])); this.persist(); }
}

function demoData() {
  const t = new Date();
  const P = [uuid(), uuid(), uuid(), uuid()];
  const H = [uuid(), uuid()];
  const D = [uuid(), uuid(), uuid()];
  const C = uuid();
  const now = new Date().toISOString();
  const med = (i, profile_id, name, purpose, slots, x = {}) => ({
    id: uuid(), profile_id, name, purpose, slots, slot_reminders: Object.fromEntries(slots.map((s) => [s, true])),
    dose: 1, stock: 30, sort_order: i, status: 'active', status_reason: '', status_history: [], note: '', updated_at: now, ...x,
  });
  return {
    profiles: [
      { id: P[0], name: 'ปู่เค็ม', relation: 'ปู่', birth_year: 1944, blood_type: 'O', color: '#3FA796', avatar: 'm-elder-wave',
        chronic_diseases: ['ความดันโลหิตสูง', 'เบาหวาน'], drug_allergies: ['Penicillin'], reminder_enabled: true },
      { id: P[1], name: 'ย่าปลา', relation: 'ย่า', birth_year: 1947, blood_type: 'A', color: '#EF5B4C', avatar: 'f-elder-heart',
        chronic_diseases: ['ไขมันในเลือดสูง', 'กระดูกพรุน'], drug_allergies: [], reminder_enabled: true },
      { id: P[2], name: 'พ่อ', relation: 'พ่อ', birth_year: 1970, blood_type: 'B', color: '#7C6CF2', avatar: 'm-adult-ok',
        chronic_diseases: ['ความดันโลหิตสูง'], drug_allergies: ['Aspirin', 'ยากลุ่ม NSAIDs'], reminder_enabled: true },
      { id: P[3], name: 'แม่', relation: 'แม่', birth_year: 1973, blood_type: 'AB', color: '#F2A93B', avatar: 'f-adult-smile',
        chronic_diseases: [], drug_allergies: [], reminder_enabled: false },
    ],
    medications: [
      med(1, P[0], 'Amlodipine 5 mg', 'ความดันโลหิตสูง', ['after_breakfast'], { stock: 5 }),
      med(2, P[0], 'Metformin 500 mg', 'เบาหวาน', ['after_breakfast', 'after_dinner'], { slot_reminders: { after_breakfast: true, after_dinner: false } }),
      med(3, P[0], 'Glipizide 5 mg', 'เบาหวาน', ['before_breakfast']),
      med(4, P[0], 'Aspirin 81 mg', 'ป้องกันหลอดเลือดอุดตัน', ['after_breakfast'], {
        status: 'paused', status_reason: 'หมอให้งดก่อนถอนฟัน', status_history: [{ date: todayKey(), status: 'paused', reason: 'หมอให้งดก่อนถอนฟัน' }] }),
      med(1, P[1], 'Simvastatin 20 mg', 'ไขมันในเลือดสูง', ['bedtime']),
      med(2, P[1], 'Calcium + Vit D', 'กระดูกพรุน', ['after_lunch'], { stock: 60 }),
      med(1, P[2], 'Losartan 50 mg', 'ความดันโลหิตสูง', ['after_breakfast']),
    ],
    hospitals: [
      { id: H[0], name: 'โรงพยาบาลศิริราช', phone: '02-419-7000' },
      { id: H[1], name: 'โรงพยาบาลรามาธิบดี', phone: '02-201-1000' },
    ],
    doctors: [
      { id: D[0], name: 'นพ.สมชาย ใจดี', department: 'อายุรกรรม', hospital_id: H[0] },
      { id: D[1], name: 'พญ.วิไล รักษ์ดี', department: 'กระดูกและข้อ', hospital_id: H[1] },
      { id: D[2], name: 'นพ.ธนา สุขสันต์', department: 'หัวใจ', hospital_id: H[0] },
    ],
    appointments: [
      { id: uuid(), profile_id: P[0], department: 'อายุรกรรม', appt_date: dk(addDays(t, 2)), appt_time: '09:00', doctor_id: D[0], hospital_id: H[0],
        building: 'ตึกผู้ป่วยนอก ชั้น 3', visit_reason: 'รับยาต่อเนื่อง', note: 'เจาะเลือด ต้องงดน้ำงดอาหารหลังเที่ยงคืน', attachments: [] },
      { id: uuid(), profile_id: P[1], department: 'กระดูกและข้อ', appt_date: dk(addDays(t, 5)), appt_time: '13:30', doctor_id: D[1], hospital_id: H[1],
        building: 'ตึก สก. ชั้น 2', visit_reason: 'ติดตามอาการ', note: 'เอาผลเอกซเรย์ครั้งก่อนไปด้วย', attachments: [] },
      { id: uuid(), profile_id: P[2], department: 'หัวใจ', appt_date: dk(addDays(t, 5)), appt_time: '10:00', doctor_id: D[2], hospital_id: H[0],
        building: '', visit_reason: 'ตรวจสุขภาพประจำปี', note: '', attachments: [] },
      { id: uuid(), profile_id: P[0], department: 'จักษุแพทย์', appt_date: dk(addDays(t, 18)), appt_time: '08:30', doctor_id: null, hospital_id: H[1],
        building: '', visit_reason: 'ติดตามอาการ', note: 'ห้ามขับรถกลับเอง (หยอดยาขยายม่านตา)', attachments: [] },
    ],
    med_logs: [],
    care_plans: [
      { id: C, profile_id: P[0], title: 'แผลที่ขาซ้าย', started_on: dk(addDays(t, -3)), interval_days: 1, remind: true, status: 'active', created_at: now,
        care_steps: ['ล้างแผลด้วยน้ำเกลือ เปลี่ยนผ้าก๊อซ เช้า-เย็น', 'ทายาฆ่าเชื้อ เช้า-เย็น', 'ระวังอย่าให้แผลโดนน้ำ'],
        note: 'ถ้าแผลบวมแดง มีหนอง หรือมีไข้ ให้กลับไปพบแพทย์' },
    ],
    care_logs: [
      { id: uuid(), plan_id: C, log_date: dk(addDays(t, -3)), trend: null, note: 'แผลถลอกยาว ~3 ซม. ขอบแดงเล็กน้อย', photos: [], created_at: now },
      { id: uuid(), plan_id: C, log_date: dk(addDays(t, -2)), trend: 'same', note: 'ยังมีน้ำเหลืองซึมเล็กน้อย', photos: [], created_at: now },
      { id: uuid(), plan_id: C, log_date: dk(addDays(t, -1)), trend: 'better', note: 'แผลแห้งขึ้น ไม่มีหนอง', photos: [], created_at: now },
    ],
    circles: (() => { const cid = uuid(); window._demoCid = cid; return [
      { id: cid, user_id: 'local', name: 'กลุ่มดูแลปู่เค็ม', description: 'ลูกหลานปู่เค็มทั้งหมด', created_at: now },
    ]; })(),
    circle_members: (() => { const cid = window._demoCid; return [
      { id: uuid(), circle_id: cid, user_id: 'local', role: 'owner', joined_at: now },
    ]; })(),
    circle_care_for: (() => { const cid = window._demoCid; return [
      { id: uuid(), circle_id: cid, profile_id: P[0], added_at: now },
    ]; })(),
    settings: { slot_times: { ...DEFAULT_SLOT_TIMES } },
  };
}
