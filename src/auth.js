import crypto from 'node:crypto';
import { db } from './db.js';

const SECRET = process.env.SESSION_SECRET || 'siprel-elektro-dev-secret-jangan-dipakai-di-produksi';
const COOKIE_USER = 'siprel_sesi';
const COOKIE_PENERIMA = 'siprel_penerima';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

/**
 * Sesi dipisah per jenis akun:
 *  - kind 'user'     → akun pengajuan (mahasiswa/petugas), cookie siprel_sesi
 *  - kind 'penerima' → akun portal penerima, cookie siprel_penerima
 * Keduanya bisa aktif bersamaan di browser yang sama tanpa saling menimpa.
 */
export function makeSession(akun, kind = 'user') {
  const payload = b64url(
    JSON.stringify({
      uid: akun.id,
      kind,
      role: akun.role || kind,
      csrf: crypto.randomBytes(16).toString('hex'),
      exp: Math.floor(Date.now() / 1000) + MAX_AGE,
    })
  );
  return `${payload}.${sign(payload)}`;
}

export function readSession(cookieHeader, namaCookie = COOKIE_USER) {
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(`${namaCookie}=`));
  if (!raw) return null;
  const value = decodeURIComponent(raw.slice(namaCookie.length + 1));
  const [payload, sig] = value.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function cookieSet(session, secure, namaCookie = COOKIE_USER) {
  const parts = [
    `${namaCookie}=${encodeURIComponent(session)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function cookieClear(secure, namaCookie = COOKIE_USER) {
  const parts = [`${namaCookie}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/** Akun pengajuan (mahasiswa/administrator) — hanya dari tabel users. */
export function currentUser(req) {
  const sesi = readSession(req.headers.cookie, COOKIE_USER);
  if (!sesi || (sesi.kind && sesi.kind !== 'user')) return null;
  const user = db
    .prepare('SELECT id, nama, email, nim, wa, role, aktif, created_at FROM users WHERE id = ?')
    .get(sesi.uid);
  if (!user || !user.aktif) return null;
  return { ...user, csrf: sesi.csrf };
}

/** Akun portal penerima — hanya dari tabel penerima. */
export function currentPenerima(req) {
  const sesi = readSession(req.headers.cookie, COOKIE_PENERIMA);
  if (!sesi || sesi.kind !== 'penerima') return null;
  const akun = db
    .prepare('SELECT id, nama, email, nim, wa, aktif, created_at FROM penerima WHERE id = ?')
    .get(sesi.uid);
  if (!akun || !akun.aktif) return null;
  return { ...akun, role: 'penerima', csrf: sesi.csrf };
}

export function requireRole(req, role) {
  const user = currentUser(req);
  if (!user) return null;
  if (role === 'admin' && user.role !== 'admin') return null;
  return user;
}

/* ── pembatas percobaan (rate limit) ───────────────────────────────────── */

const buckets = new Map();

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = buckets.get(key) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count += 1;
  buckets.set(key, entry);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  return { allowed: entry.count <= limit, sisa: Math.max(0, limit - entry.count), reset: entry.reset };
}

export function ipDari(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'lokal';
}

export const NAMA_COOKIE = { user: COOKIE_USER, penerima: COOKIE_PENERIMA };
