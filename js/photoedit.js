/* © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์ / All rights reserved · ห้ามคัดลอกหรือนำไปใช้โดยไม่ได้รับอนุญาต · ดู LICENSE.txt */
/* สุขใจ — ตัวแก้ไขรูปก่อนใช้ (รูปเม็ดยา): หมุนซ้าย/ขวา · กลับซ้าย-ขวา · กลับบน-ล่าง · ตัดภาพ (ลากกรอบ)
 * editPhoto(file) → Promise<Blob JPEG | null> (null = ยกเลิก) — ทำงานในเครื่อง ไม่ส่งรูปไปที่ไหนจนกว่าจะกดบันทึกยา
 */
'use strict';

const PE_MAX = 1600; // ด้านยาวสุดของรูปที่ใช้แก้ (พอสำหรับรูปเม็ดยา · ประหยัดพื้นที่)
const PE_MIN = 40;   // กรอบตัดเล็กสุด (พิกเซลของรูป)

async function peLoad(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } // ถือทิศทางตามที่กล้องบันทึก (กันรูปตะแคง)
  catch {
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('เปิดรูปไม่ได้')); img.src = URL.createObjectURL(file); });
  }
}

function editPhoto(file) {
  return new Promise(async (resolve) => {
    let src;
    try { src = await peLoad(file); } catch (e) { console.warn(e); toast('เปิดรูปไม่ได้ ลองรูปอื่นนะ'); return resolve(null); }
    const sw0 = src.width || src.naturalWidth, sh0 = src.height || src.naturalHeight; const sc0 = Math.min(1, PE_MAX / Math.max(sw0, sh0));
    let cv = document.createElement('canvas'); cv.width = Math.round(sw0 * sc0); cv.height = Math.round(sh0 * sc0); cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    if (src.close) src.close();
    let crop = { x: 0, y: 0, w: cv.width, h: cv.height };

    const ov = document.createElement('div'); ov.className = 'pe-overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="pe-box">
      <h3>แก้ไขรูป</h3>
      <div class="pe-wrap"><div class="pe-stage"><canvas></canvas><div class="pe-crop"><i data-h="tl"></i><i data-h="tr"></i><i data-h="bl"></i><i data-h="br"></i></div></div></div>
      <p class="small muted center pe-tip">ลากกรอบสีเขียวเพื่อตัดภาพ · ลากมุมเพื่อปรับขนาด</p>
      <div class="pe-tools">
        <button type="button" class="btn ghost sm" data-t="rl">หมุนซ้าย</button><button type="button" class="btn ghost sm" data-t="rr">หมุนขวา</button>
        <button type="button" class="btn ghost sm" data-t="fh">กลับซ้าย-ขวา</button><button type="button" class="btn ghost sm" data-t="fv">กลับบน-ล่าง</button>
      </div>
      <div class="row"><button type="button" class="btn ghost" data-t="cancel">ยกเลิก</button><button type="button" class="btn" data-t="ok">ใช้รูปนี้</button></div></div>`;
    document.body.appendChild(ov);
    const view = ov.querySelector('canvas'), box = ov.querySelector('.pe-crop');

    const paint = () => {
      view.width = cv.width; view.height = cv.height; view.getContext('2d').drawImage(cv, 0, 0);
      const k = view.clientWidth / cv.width || 1;
      box.style.left = `${crop.x * k}px`; box.style.top = `${crop.y * k}px`; box.style.width = `${crop.w * k}px`; box.style.height = `${crop.h * k}px`;
    };
    const resetCrop = () => { crop = { x: 0, y: 0, w: cv.width, h: cv.height }; };
    const remake = (w, h, draw) => { const n = document.createElement('canvas'); n.width = w; n.height = h; const c = n.getContext('2d'); draw(c, w, h); cv = n; resetCrop(); paint(); };
    const ops = {
      rl: () => remake(cv.height, cv.width, (c, w, h) => { c.translate(0, h); c.rotate(-Math.PI / 2); c.drawImage(cv, 0, 0); }),
      rr: () => remake(cv.height, cv.width, (c, w) => { c.translate(w, 0); c.rotate(Math.PI / 2); c.drawImage(cv, 0, 0); }),
      fh: () => remake(cv.width, cv.height, (c, w) => { c.translate(w, 0); c.scale(-1, 1); c.drawImage(cv, 0, 0); }),
      fv: () => remake(cv.width, cv.height, (c, w, h) => { c.translate(0, h); c.scale(1, -1); c.drawImage(cv, 0, 0); }),
    };

    // ลากกรอบตัดภาพ (เมาส์/นิ้ว) — มุม = ปรับขนาด · ในกรอบ = เลื่อน
    let drag = null;
    box.addEventListener('pointerdown', (ev) => { drag = { mode: ev.target.dataset.h || 'move', sx: ev.clientX, sy: ev.clientY, start: { ...crop }, k: view.clientWidth / cv.width || 1 }; box.setPointerCapture(ev.pointerId); ev.preventDefault(); });
    box.addEventListener('pointermove', (ev) => {
      if (!drag) return; const dx = (ev.clientX - drag.sx) / drag.k, dy = (ev.clientY - drag.sy) / drag.k; const s = drag.start; let { x, y, w, h } = s;
      if (drag.mode === 'move') { x = Math.min(Math.max(0, s.x + dx), cv.width - s.w); y = Math.min(Math.max(0, s.y + dy), cv.height - s.h); }
      else {
        let x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h; const m = drag.mode;
        if (m.includes('l')) x1 = Math.min(Math.max(0, s.x + dx), x2 - PE_MIN); if (m.includes('r')) x2 = Math.max(Math.min(cv.width, s.x + s.w + dx), x1 + PE_MIN);
        if (m.includes('t')) y1 = Math.min(Math.max(0, s.y + dy), y2 - PE_MIN); if (m.includes('b')) y2 = Math.max(Math.min(cv.height, s.y + s.h + dy), y1 + PE_MIN);
        x = x1; y = y1; w = x2 - x1; h = y2 - y1;
      }
      crop = { x, y, w, h }; paint();
    });
    const end = () => { drag = null; }; box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);

    const close = (val) => { window.removeEventListener('resize', paint); ov.remove(); resolve(val); };
    ov.addEventListener('click', (ev) => {
      const t = ev.target.closest('[data-t]')?.dataset.t; if (!t) return;
      if (ops[t]) return ops[t]();
      if (t === 'cancel') return close(null);
      if (t === 'ok') {
        const out = document.createElement('canvas'); out.width = Math.round(crop.w); out.height = Math.round(crop.h);
        out.getContext('2d').drawImage(cv, Math.round(crop.x), Math.round(crop.y), out.width, out.height, 0, 0, out.width, out.height);
        out.toBlob((b) => { if (!b) { toast('บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง'); return; } close(b); }, 'image/jpeg', 0.85);
      }
    });
    window.addEventListener('resize', paint);
    paint(); requestAnimationFrame(paint); // วาดทันที + วาดซ้ำเมื่อเลย์เอาต์นิ่งแล้ว
  });
}
