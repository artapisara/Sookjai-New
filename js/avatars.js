/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — ไอคอนคนแบบเรียบง่าย (SVG ที่วาดเอง)
 * รหัส: <เพศ>-<วัย>-<ท่า>  เช่น f-elder-wave
 * เพศ: m ชาย / f หญิง · วัย: child เด็ก / adult วัยทำงาน / elder ผู้สูงอายุ · ท่า: smile ยิ้ม / wave โบกมือ / heart ถือหัวใจ / ok ชูนิ้ว
 */
'use strict';

const AV_GENDERS = [['m', 'ชาย'], ['f', 'หญิง']];
const AV_AGES = [['child', 'เด็ก'], ['adult', 'วัยทำงาน'], ['elder', 'ผู้สูงอายุ']];
const AV_POSES = [['smile', 'ยิ้ม'], ['wave', 'โบกมือ'], ['heart', 'ถือหัวใจ'], ['ok', 'ชูนิ้ว']];
const AVATAR_IDS = AV_AGES.flatMap(([a]) => AV_GENDERS.flatMap(([g]) => AV_POSES.map(([p]) => `${g}-${a}-${p}`)));

/** เดาไอคอนจากความสัมพันธ์ (ใช้ตอนสร้างโปรไฟล์ใหม่) */
function avatarForRelation(rel) {
  const map = { 'ปู่': 'm-elder', 'ตา': 'm-elder', 'ย่า': 'f-elder', 'ยาย': 'f-elder', 'พ่อ': 'm-adult', 'แม่': 'f-adult',
    'พี่ชาย': 'm-adult', 'พี่สาว': 'f-adult', 'น้องชาย': 'm-child', 'น้องสาว': 'f-child', 'ตัวเอง': 'f-adult' };
  return map[rel] ? `${map[rel]}-smile` : null;
}

function avatarSVG(id, color = '#3FA796') {
  const [g, age, pose] = String(id || 'f-adult-smile').split('-');
  const SKIN = '#F5C9A6', INK = '#2B3A42';
  const hairDark = g === 'f' ? '#5A3B2E' : '#3A2E2A';
  const gray = '#CDD3D8';
  const kid = age === 'child', old = age === 'elder';
  const hy = kid ? 30 : 27; // ตำแหน่งศีรษะ
  const hr = kid ? 11.5 : 11;
  let back = '', hair = '', face = '', extra = '', arms = '';

  // ผมด้านหลัง (ผู้หญิง)
  if (g === 'f' && age === 'adult') back = `<path d="M19 ${hy + 1}c0-13 6-16 13-16s13 3 13 16l1 15c-4 2-8 0-8 0H26s-4 2-8 0z" fill="${hairDark}"/>`;
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
