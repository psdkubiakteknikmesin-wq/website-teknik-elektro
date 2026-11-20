import { esc } from './util.js';

export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

export function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(buf);
}

export function html(res, body, status = 200, headers = {}) {
  send(res, status, body, headers);
}

export function json(res, obj, status = 200, headers = {}) {
  const buf = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(buf);
}

export function redirect(res, location, cookie = null) {
  const headers = { Location: location, 'Content-Length': 0 };
  if (cookie) headers['Set-Cookie'] = cookie;
  res.writeHead(302, headers);
  res.end();
}

export function notFoundPage(settings) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Halaman tidak ditemukan · SIPREL</title>
  <link rel="stylesheet" href="/assets/styles.css"></head>
  <body class="portal"><main class="wrap narrow" style="padding:80px 0;text-align:center">
  <p class="eyebrow">Error 404</p>
  <h1 style="font-size:38px;margin:8px 0 12px">Halaman tidak ditemukan</h1>
  <p class="muted">Tautan yang Anda buka mungkin sudah kedaluwarsa atau salah ketik.</p>
  <p style="margin-top:26px"><a class="btn btn-primary" href="/">Kembali ke beranda</a></p>
  </main></body></html>`;
}

const MAX_BODY = 1024 * 1024;

export async function readBody(req) {
  const type = String(req.headers['content-type'] || '');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Data yang dikirim terlalu besar.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (type.includes('application/json')) {
    try {
      return { json: JSON.parse(raw || '{}'), fields: {}, raw };
    } catch {
      return { json: {}, fields: {}, raw };
    }
  }
  const params = new URLSearchParams(raw);
  const fields = {};
  for (const [k, v] of params) {
    if (k.endsWith('[]')) {
      const key = k.slice(0, -2);
      if (!fields[key]) fields[key] = [];
      fields[key].push(v);
    } else {
      fields[k] = v;
    }
  }
  return { json: {}, fields, raw };
}

export function isValidOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // form biasa / non-browser
  try {
    const o = new URL(origin);
    const host = String(req.headers.host || '');
    return o.host === host;
  } catch {
    return false;
  }
}

export function csrfField(user) {
  return user?.csrf ? `<input type="hidden" name="_csrf" value="${esc(user.csrf)}">` : '';
}

export function csrfValid(req, user, fields) {
  if (!isValidOrigin(req)) return false;
  if (!user) return true;
  const token = fields?._csrf || req.headers['x-csrf'];
  return token === user.csrf;
}

export function errorPage(settings, message = 'Terjadi kesalahan pada server.') {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kesalahan · SIPREL</title><link rel="stylesheet" href="/assets/styles.css"></head>
  <body class="portal"><main class="wrap narrow" style="padding:80px 0;text-align:center">
  <p class="eyebrow">Error 500</p>
  <h1 style="font-size:34px;margin:8px 0 12px">Ada yang tidak beres</h1>
  <p class="muted">${esc(message)}</p>
  <p style="margin-top:26px"><a class="btn btn-primary" href="/">Kembali ke beranda</a></p>
  </main></body></html>`;
}
