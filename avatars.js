/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — ไอคอนคนแบบเรียบง่าย (SVG ที่วาดเอง)
 * รหัส: <เพศ>-<วัย>-<ท่า>  เช่น f-elder-wave
 * เพศ: m ชาย / f หญิง · วัย: child เด็ก / adult วัยทำงาน / mid วัยผู้ใหญ่ / elder ผู้สูงอายุ · ท่า: smile ยิ้ม / wave โบกมือ / heart ถือหัวใจ / ok ชูนิ้ว
 */
'use strict';

const AV_GENDERS = [['m', 'ชาย'], ['f', 'หญิง']];
const AV_AGES = [['child', 'เด็ก'], ['adult', 'วัยทำงาน'], ['mid', 'วัยผู้ใหญ่'], ['elder', 'ผู้สูงอายุ']]; // mid = วัยกลางคน (~45–60 ปี) ทรงผม/เสื้อผ้าต่างจากกลุ่มอื่น และมีท่าอุ้มสุนัข/แมว
const AV_POSES = [['smile', 'ยิ้ม'], ['wave', 'โบกมือ'], ['heart', 'ถือหัวใจ'], ['ok', 'ชูนิ้ว']];
const AV_POSES_MID = [['smile', 'ยิ้ม'], ['wave', 'โบกมือ'], ['dog', 'อุ้มสุนัข'], ['cat', 'อุ้มแมว']]; // วัยผู้ใหญ่: มีท่าอุ้มสัตว์เลี้ยง
const avPosesOf = (age) => (age === 'mid' ? AV_POSES_MID : AV_POSES);
const AVATAR_IDS = AV_AGES.flatMap(([a]) => AV_GENDERS.flatMap(([g]) => avPosesOf(a).map(([p]) => `${g}-${a}-${p}`)));

/** เดาไอคอนจากความสัมพันธ์ (ใช้ตอนสร้างโปรไฟล์ใหม่) */
function avatarForRelation(rel) {
  const map = { 'ปู่': 'm-elder', 'ตา': 'm-elder', 'ย่า': 'f-elder', 'ยาย': 'f-elder', 'พ่อ': 'm-adult', 'แม่': 'f-adult',
    'พี่ชาย': 'm-adult', 'พี่สาว': 'f-adult', 'น้องชาย': 'm-child', 'น้องสาว': 'f-child', 'ตัวเอง': 'f-adult' };
  return map[rel] ? `${map[rel]}-smile` : null;
}

/** วัยผู้ใหญ่ (วัยกลางคน) — หน้าตา/ทรงผม/เสื้อผ้าต่างจากวัยทำงานและผู้สูงอายุ: ผู้ชายผมเซ็ตเฉียง+หนวดเคราสั้น+เสื้อโปโล · ผู้หญิงผมบ๊อบลอน+ต่างหู+สร้อยมุก+คาร์ดิแกน · ท่า: ยิ้ม/โบกมือ/อุ้มสุนัข/อุ้มแมว */
function midAvatarSVG(g, pose, color) {
  const SKIN = '#F5C9A6', INK = '#2B3A42', gray = '#CDD3D8', hy = 27, hr = 11;
  const hairC = g === 'f' ? '#7B4B35' : '#4A3B35';
  let back = '', body = '', neck = '', hair = '', face = '', extra = '', arms = '';
  const sleeve = (d) => `<path d="${d}" stroke="${color}" stroke-width="6.5" stroke-linecap="round" fill="none"/>`;
  if (g === 'm') {
    body = `<rect x="28.5" y="${hy + 8}" width="7" height="7" fill="${SKIN}"/><path d="M10 64c0-14 9-20 22-20s22 6 22 20z" fill="${color}"/>`;
    neck = `<path d="M25.5 45.5l6.5 7 6.5-7-3.2-2.2-3.3 3-3.3-3z" fill="#fff"/><path d="M32 52.5V64" stroke="rgba(0,0,0,.22)" stroke-width="1"/><circle cx="32" cy="55.5" r=".9" fill="rgba(0,0,0,.35)"/><circle cx="32" cy="59.5" r=".9" fill="rgba(0,0,0,.35)"/>`;
    hair = `<path d="M20.6 ${hy - 1}c-.8-9.6 5-14.6 12.4-14.2 7 .4 11 5 10.4 14.2-1.2-5.2-4.4-7.6-9.4-8-4 .2-8.4 1.6-13.4 8z" fill="${hairC}"/>
      <path d="M21 ${hy + 1}c-.4-4 .4-6 2.4-7.4l.2 7zM43 ${hy + 1}c.4-4-.4-6-2.4-7.4l-.2 7z" fill="${gray}"/>
      <path d="M24.4 ${hy + 5.2}c1 8.2 4.2 9.8 7.6 9.8s6.6-1.6 7.6-9.8c-1.8 3.2-4.4 4.4-7.6 4.4s-5.8-1.2-7.6-4.4z" fill="#7C7470"/>`;
    face = `<path d="M24.8 ${hy - 3.6}q3-1.6 5.6 0M33.6 ${hy - 3.6}q2.6-1.6 5.6 0" stroke="${hairC}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <circle cx="28" cy="${hy}" r="1.4" fill="${INK}"/><circle cx="36" cy="${hy}" r="1.4" fill="${INK}"/>
      <path d="M28.6 ${hy + 5}q3.4 2.8 6.8 0" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  } else {
    back = `<path d="M17.4 ${hy + 2}c-1.6-14 5-18.6 14.6-18.6s16.2 4.6 14.6 18.6c-.4 4-2 7.4-4.4 10.4 1 1.4 4 1.8 5 .8-1 4-5 6-8 4.4l-1.6-9H26.4l-1.6 9c-3 1.6-7-.4-8-4.4 1 1 4 .6 5-.8-2.4-3-4-6.4-4.4-10.4z" fill="${hairC}"/>`;
    body = `<rect x="28.5" y="${hy + 8}" width="7" height="7" fill="${SKIN}"/><path d="M10 64c0-14 9-20 22-20s22 6 22 20z" fill="${color}"/><path d="M24.6 46.4l7.4 11.6 7.4-11.6z" fill="#FFF3E0"/><path d="M24.6 46.4L32 58M39.4 46.4L32 58" stroke="rgba(0,0,0,.18)" stroke-width="1" fill="none"/>`;
    neck = `<g fill="#fff" stroke="#E4D9C8" stroke-width=".4"><circle cx="26.4" cy="47.2" r="1.15"/><circle cx="28.6" cy="49.2" r="1.15"/><circle cx="32" cy="50" r="1.3"/><circle cx="35.4" cy="49.2" r="1.15"/><circle cx="37.6" cy="47.2" r="1.15"/></g>`;
    hair = `<path d="M20.4 ${hy}c0-10 5-14 11.6-14s11.6 4 11.6 14c-2.4-4.6-6-7.4-11.6-7.4-3.6 0-8.2 2-11.6 7.4z" fill="${hairC}"/>
      <path d="M25.6 ${hy - 8.6}q4.4-3.6 9.4-1.8" stroke="${gray}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    face = `<circle cx="28" cy="${hy}" r="1.4" fill="${INK}"/><circle cx="36" cy="${hy}" r="1.4" fill="${INK}"/>
      <path d="M28.5 ${hy + 4}q3.5 3 7 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <circle cx="25" cy="${hy + 3.5}" r="1.8" fill="#F29A8A" opacity=".55"/><circle cx="39" cy="${hy + 3.5}" r="1.8" fill="#F29A8A" opacity=".55"/>`;
    extra = `<circle cx="20.6" cy="${hy + 4.6}" r="1.5" fill="#F2C14E"/><circle cx="43.4" cy="${hy + 4.6}" r="1.5" fill="#F2C14E"/>`;
  }
  extra += `<path d="M25.6 ${hy + 3}q-1.2 2 0 3.6M38.4 ${hy + 3}q1.2 2 0 3.6" stroke="#C99A78" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".6"/>`;
  const hands = `${sleeve('M15 57q2 5 9 4')}${sleeve('M49 57q-2 5-9 4')}<circle cx="24.4" cy="60.6" r="3.1" fill="${SKIN}"/><circle cx="39.6" cy="60.6" r="3.1" fill="${SKIN}"/>`;
  if (pose === 'wave') arms = `${sleeve('M47 55l6.5-14')}<circle cx="54.4" cy="38" r="3.8" fill="${SKIN}"/><path d="M58.9 33.5q1.5 2 0 4M60.9 31.5q2.5 3.5 0 7" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round" opacity=".5"/>`;
  if (pose === 'dog') arms = `<ellipse cx="32" cy="53.4" rx="9" ry="8" fill="#D9A55F"/>
    <path d="M23.6 47.4c-3.2 1-4.8 6-2.6 9.6 2.6-.4 4.6-3 4.6-6.2z" fill="#8A5A2B"/><path d="M40.4 47.4c3.2 1 4.8 6 2.6 9.6-2.6-.4-4.6-3-4.6-6.2z" fill="#8A5A2B"/>
    <ellipse cx="32" cy="57.2" rx="4.8" ry="3.4" fill="#F6E0BC"/><ellipse cx="32" cy="55.6" rx="1.8" ry="1.25" fill="#2B2B2B"/>
    <circle cx="28.4" cy="52" r="1.2" fill="${INK}"/><circle cx="35.6" cy="52" r="1.2" fill="${INK}"/><path d="M30.8 58.6q1.2 2.4 2.4 0z" fill="#F08A8A"/>${hands}`;
  if (pose === 'cat') arms = `<ellipse cx="32" cy="53.6" rx="9.2" ry="7.6" fill="#B9BEC6"/>
    <path d="M23.4 50.6l-.6-8.2 6.6 4.2z" fill="#B9BEC6"/><path d="M40.6 50.6l.6-8.2-6.6 4.2z" fill="#B9BEC6"/>
    <path d="M24.4 48.4l-.3-3.6 3 1.9zM39.6 48.4l.3-3.6-3 1.9z" fill="#F3B6B6"/>
    <path d="M32 46.6v3M28.8 47.4l.9 2.4M35.2 47.4l-.9 2.4" stroke="#8C929B" stroke-width="1.1" stroke-linecap="round"/>
    <ellipse cx="28.6" cy="53" rx="1.1" ry="1.5" fill="#2B2B2B"/><ellipse cx="35.4" cy="53" rx="1.1" ry="1.5" fill="#2B2B2B"/><path d="M31 55.4h2l-1 1.2z" fill="#E88A8A"/>
    <path d="M32 56.6q-1.2 1.5-2.6 1M32 56.6q1.2 1.5 2.6 1M24.6 55.4l-4.4-1M24.6 57l-4.4 1M39.4 55.4l4.4-1M39.4 57l4.4 1" stroke="#fff" stroke-width=".8" fill="none" stroke-linecap="round" opacity=".85"/>${hands}`;
  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="64" height="64" fill="${hexA(color, 0.16)}"/>
    ${back}${body}${neck}<circle cx="32" cy="${hy}" r="${hr}" fill="${SKIN}"/>${hair}${face}${extra}${arms}</svg>`;
}
function avatarSVG(id, color = '#3FA796') {
  const [g, age, pose] = String(id || 'f-adult-smile').split('-');
  if (age === 'mid') return midAvatarSVG(g, pose, color);
  const SKIN = '#F5C9A6', INK = '#2B3A42';
  const hairDark = g === 'f' ? '#5A3B2E' : '#3A2E2A';
  const gray = '#CDD3D8';
  const kid = age === 'child', old = age === 'elder';
  const hy = kid ? 30 : 27; // ตำแหน่งศีรษะ
  const hr = kid ? 11.5 : 11;
  let back = '', hair = '', face = '', extra = '', arms = '';

  // ผมด้านหลัง (ผู้หญิง)
  if (g === 'f' && (age === 'adult' || age === 'mid')) back = `<path d="M19 ${hy + 1}c0-13 6-16 13-16s13 3 13 16l1 15c-4 2-8 0-8 0H26s-4 2-8 0z" fill="${hairDark}"/>`;
  if (g === 'f' && kid) back = `<circle cx="18.5" cy="${hy}" r="4.6" fill="${hairDark}"/><circle cx="45.5" cy="${hy}" r="4.6" fill="${hairDark}"/>
    <circle cx="21.5" cy="${hy - 1}" r="1.6" fill="${color}"/><circle cx="42.5" cy="${hy - 1}" r="1.6" fill="${color}"/>`;
  if (g === 'f' && old) back = `<circle cx="32" cy="${hy - 13}" r="5.5" fill="${gray}"/>`;

  // ผมด้านหน้า
  const top = hy - hr;
  if (g === 'm' && !old) hair = `<path d="M${32 - hr} ${hy - 1}c0-9 5-${hr - 1} ${hr}-${hr - 1}s${hr} 2 ${hr} ${hr - 1}c-3-4-7-6-${hr}-6s-8 2-${hr} 6z" fill="${hairDark}"/>`
    + (kid ? `<path d="M30 ${top}c1-3 4-4 6-3-2 0-3 1-3 3z" fill="${hairDark}"/>` : '');
  if (g === 'f' && !old) hair = `<path d="M${32 - hr} ${hy - 1}c0-9 5-${hr} ${hr}-${hr}s${hr} 3 ${hr} ${hr}c-5-3-9-5-${hr - 2}-5-4 0-9 2-${hr + 2} 5z" fill="${hairDark}"/>`;
  if (g === 'm' && old) hair = `<path d="M21 ${hy + 1}c0-5 1-7 3-8v7zM43 ${hy + 1}c0-5-1-7-3-8v7z" fill="${gray}"/>`;
  if (g === 'f' && old) hair = `<path d="M21 ${hy}c0-9 5-12 11-12s11 3 11 12c-3-4-7-6-11-6s-8 2-11 6z" fill="${gray}"/>`;

  // หน้า
  const er = kid ? 1.7 : 1.4;
  face = `<circle cx="28" cy="${hy}" r="${er}" fill="${INK}"/><circle cx="36" cy="${hy}" r="${er}" fill="${INK}"/>
    <path d="M28.5 ${hy + 4}q3.5 3 7 0" stroke="${INK}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  if (kid || g === 'f') face += `<circle cx="25" cy="${hy + 3.5}" r="1.8" fill="#F29A8A" opacity=".55"/><circle cx="39" cy="${hy + 3.5}" r="1.8" fill="#F29A8A" opacity=".55"/>`;
  if (old) extra += `<g fill="none" stroke="${INK}" stroke-width="1.2"><circle cx="28" cy="${hy}" r="3.3"/><circle cx="36" cy="${hy}" r="3.3"/><path d="M31.3 ${hy}h1.4"/></g>`;
  if (age === 'mid') { // วัยผู้ใหญ่: ผมดอกเลาที่ขมับ/ปอยผม + รอยยิ้มจางๆ ข้างปาก (ไม่ใส่แว่น ต่างจากผู้สูงอายุ)
    extra += g === 'm'
      ? `<path d="M${32 - hr} ${hy}c0-4 .6-6 2.6-7.2l.4 6.4z" fill="${gray}"/><path d="M${32 + hr} ${hy}c0-4-.6-6-2.6-7.2l-.4 6.4z" fill="${gray}"/>`
      : `<path d="M25 ${hy - 8}q4-4 9-2.5" stroke="${gray}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M23 ${hy - 3}q.5-3 2.5-5" stroke="${gray}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    extra += `<path d="M25.6 ${hy + 3}q-1.2 2 0 3.6M38.4 ${hy + 3}q1.2 2 0 3.6" stroke="#C99A78" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".7"/>`;
  }
  if (g === 'm' && old) extra += `<path d="M28.5 ${hy + 3.3}q3.5-1.6 7 0q-3.5 1.2-7 0z" fill="${gray}"/>`;

  // ลำตัว
  const body = kid
    ? `<rect x="29" y="${hy + 9}" width="6" height="6" fill="${SKIN}"/><path d="M17 64c0-11 6-16 15-16s15 5 15 16z" fill="${color}"/>`
    : `<rect x="28.5" y="${hy + 8}" width="7" height="7" fill="${SKIN}"/><path d="M12 64c0-13 8-19 20-19s20 6 20 19z" fill="${color}"/>`;
  const collar = `<path d="M27 ${kid ? 48 : 45}l5 5 5-5" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"/>`;

  // ท่าทาง
  const shirtDark = 'rgba(0,0,0,.18)';
  if (pose === 'wave') arms = `<path d="M47 55l6-14" stroke="${color}" stroke-width="6.5" stroke-linecap="round"/><path d="M47 55l6-14" stroke="${shirtDark}" stroke-width="6.5" stroke-linecap="round" opacity=".35"/>
    <circle cx="54" cy="38" r="3.8" fill="${SKIN}"/><path d="M58.5 33.5q1.5 2 0 4M60.5 31.5q2.5 3.5 0 7" stroke="${INK}" stroke-width="1" fill="none" stroke-linecap="round" opacity=".5"/>`;
  if (pose === 'heart') arms = `<path d="M32 60c-5-3.5-8-6-8-9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-3 5.5-8 9z" fill="#EF5B4C" stroke="#fff" stroke-width="1.2"/>
    <circle cx="24.5" cy="54" r="3" fill="${SKIN}"/><circle cx="39.5" cy="54" r="3" fill="${SKIN}"/>`;
  if (pose === 'ok') arms = `<rect x="43" y="47" width="7.5" height="8" rx="3" fill="${SKIN}"/><rect x="45.5" y="41" width="3.4" height="8" rx="1.7" fill="${SKIN}"/>`;

  return `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="64" height="64" fill="${hexA(color, 0.16)}"/>
    ${back}${body}${collar}<circle cx="32" cy="${hy}" r="${hr}" fill="${SKIN}"/>${hair}${face}${extra}${arms}</svg>`;
}

const avatarHtml = (p, size = '') => `<div class="av ${size}">${avatarSVG(p.avatar, p.color)}</div>`;
