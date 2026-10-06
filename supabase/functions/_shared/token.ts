// © 2026 สุขใจ (Sookjai) — สงวนลิขสิทธิ์
// โทเคนลงลายมือชื่อ (HMAC-SHA256) สำหรับปุ่ม "กินแล้ว / เตือนอีก 15 นาที" ในการแจ้งเตือน
// ส่งไปกับ push โดย send-reminders → Service Worker ส่งกลับมาที่ notification-action → ตรวจลายมือชื่อและอายุก่อนทำรายการ
// ความลับ: ACTION_SECRET (ถ้าไม่ตั้ง ใช้ CRON_SECRET) — ตั้งด้วย: supabase secrets set ACTION_SECRET=ข้อความสุ่มยาวๆ

export type ActionClaims = { u: string; p: string; s: string; d: string; k: string; n: number; exp: number };

const enc = new TextEncoder();
const secret = () => Deno.env.get('ACTION_SECRET') ?? Deno.env.get('CRON_SECRET') ?? '';
const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const hmacKey = () => crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function signToken(c: ActionClaims): Promise<string> {
  const body = b64u(enc.encode(JSON.stringify(c)));
  const sig = b64u(await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(body)));
  return `${body}.${sig}`;
}

/** คืนข้อมูลในโทเคนถ้าลายมือชื่อถูกและยังไม่หมดอายุ ไม่งั้นคืน null */
export async function verifyToken(token: string): Promise<ActionClaims | null> {
  try {
    if (!secret()) return null;
    const [body, sig] = String(token).split('.'); if (!body || !sig) return null;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), fromB64u(sig), enc.encode(body)); if (!ok) return null;
    const c = JSON.parse(new TextDecoder().decode(fromB64u(body))) as ActionClaims;
    if (!c.u || !c.p || !c.s || !c.d || Date.now() / 1000 > c.exp) return null;
    return c;
  } catch { return null; }
}
