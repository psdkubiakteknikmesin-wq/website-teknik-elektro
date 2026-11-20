import crypto from 'node:crypto';

/** Escape HTML. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape untuk teks di dalam atribut atau JS string. */
export function attr(value) {
  return esc(value);
}

export function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/-->/g, '--\\>');
}

const TZ = 'Asia/Jayapura';
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** "2026-11-18" -> "18 November 2026" tanpa bergantung timezone. */
export function tanggalID(iso) {
  if (!iso) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  return `${Number(m[3])} ${MONTHS_ID[Number(m[2]) - 1]} ${m[1]}`;
}

export function tanggalJamID(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')} · ${get('hour')}:${get('minute')} WIT`;
}

export function hariID(iso) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return '';
  const idx = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return DAYS_ID[map[idx] ?? 0];
}

/** Tanggal hari ini (WIT) dalam format YYYY-MM-DD. */
export function todayID() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function nowISO() {
  return new Date().toISOString();
}

export function randomToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomCode(len = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buf = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i += 1) out += alphabet[buf[i] % alphabet.length];
  return out;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const calc = crypto.scryptSync(String(password), salt, 64);
    const known = Buffer.from(hash, 'hex');
    if (known.length !== calc.length) return false;
    return crypto.timingSafeEqual(known, calc);
  } catch {
    return false;
  }
}

/** Normalisasi nomor WhatsApp Indonesia menjadi 62xxxxxxxxxx. */
export function normalisasiWA(input) {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  else if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
  return digits;
}

export function waCantik(nomor) {
  const n = normalisasiWA(nomor);
  if (!n) return '-';
  return `+${n.slice(0, 2)} ${n.slice(2, 5)}-${n.slice(5, 9)}-${n.slice(9)}`.replace(/-$/, '');
}

export function inisial(nama) {
  const parts = String(nama ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ringkas(text, max = 120) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function parseLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}
