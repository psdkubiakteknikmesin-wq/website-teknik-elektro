import { loadEnv } from './src/env.js';
loadEnv();

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { getSettings } = await import('./src/db.js');
const { publicRoutes } = await import('./src/routes-public.js');
const { adminRoutes } = await import('./src/routes-admin.js');
const { currentUser, currentPenerima } = await import('./src/auth.js');
const { securityHeaders, send, json, notFoundPage, errorPage, isValidOrigin, readBody } = await import('./src/http.js');

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

/* ── router ────────────────────────────────────────────────────────────── */

function compile(routes) {
  return routes.map((r) => {
    const keys = [];
    const pattern = r.path
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          keys.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    return { ...r, regex: new RegExp(`^${pattern}/?$`), keys };
  });
}

const ROUTES = compile([...publicRoutes, ...adminRoutes]);

/* ── static ────────────────────────────────────────────────────────────── */

function sajikanStatis(req, res, pathname) {
  const rel = decodeURIComponent(pathname.replace(/^\/assets\/?/, ''));
  if (!rel || rel.includes('..') || rel.includes('\\')) return false;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) return false;
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': 'public, max-age=60' });
    res.end();
    return true;
  }
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.png' || ext === '.svg' ? 'public, max-age=86400' : 'public, max-age=60',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

/* ── server ────────────────────────────────────────────────────────────── */

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  try {
    securityHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // platform health check
    if (pathname === '/healthz' || (pathname === '/api/health' && req.method === 'GET')) {
      return json(res, { ok: true, uptime: Math.round(process.uptime()), waktu: new Date().toISOString() });
    }

    if (pathname === '/robots.txt') {
      return send(res, 200, 'User-agent: *\nDisallow: /admin\nDisallow: /api\n', { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    if (pathname.startsWith('/assets/')) {
      if (sajikanStatis(req, res, pathname)) return;
      return send(res, 404, 'Aset tidak ditemukan', { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    const settings = getSettings();
    const proto = req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0].trim() : 'http';
    const baseUrl = (settings.base_url || process.env.BASE_URL || `${proto}://${req.headers.host || `localhost:${PORT}`}`).replace(/\/$/, '');
    const user = currentUser(req);
    const penerima = currentPenerima(req);

    const ctx = {
      req,
      res,
      url,
      pathname,
      method: req.method,
      query: Object.fromEntries(url.searchParams.entries()),
      params: {},
      user,
      penerima,
      settings,
      baseUrl,
      secure: proto === 'https',
    };

    if (settings.pemeliharaan === '1' && !pathname.startsWith('/admin') && !pathname.startsWith('/assets')) {
      return send(res, 503, notFoundPage(settings).replace('Halaman tidak ditemukan', 'Situs sedang dalam pemeliharaan').replace('Error 404', 'Maintenance'));
    }

    let matchedPath = false;
    for (const route of ROUTES) {
      const m = route.regex.exec(pathname);
      if (!m) continue;
      matchedPath = true;
      if (route.method !== req.method) continue;
      ctx.params = {};
      route.keys.forEach((k, i) => {
        ctx.params[k] = decodeURIComponent(m[i + 1]);
      });
      const result = await route.handler(ctx);
      if (res.writableEnded) {
        if (process.env.LOG_REQUESTS === '1') {
          console.log(`${req.method} ${pathname} → ${res.statusCode} (${Date.now() - started}ms)`);
        }
        return;
      }
      void result;
      return;
    }

    if (matchedPath) return send(res, 405, 'Metode tidak diizinkan', { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, POST' });
    return send(res, 404, notFoundPage(settings));
  } catch (err) {
    console.error('[SIPREL] Kesalahan:', err);
    try {
      if (!res.writableEnded) {
        const settings = safeSettings();
        send(res, 500, errorPage(settings, 'Silakan coba lagi beberapa saat lagi.'));
      }
    } catch {
      /* abaikan */
    }
  }
});

function safeSettings() {
  try {
    return getSettings();
  } catch {
    return { dept: 'Jurusan Teknik Elektro', instansi2: 'Universitas Cenderawasih', fakultas: 'Fakultas Teknik', alamat: '' };
  }
}

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ⚡ SIPREL — Sistem Informasi Persuratan Teknik Elektro');
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  Portal publik   : http://localhost:${PORT}/`);
  console.log(`  Dashboard admin : http://localhost:${PORT}/admin`);
  console.log(`  Portal penerima : http://localhost:${PORT}/terima/demo-penerima-elektro`);
  console.log(`  Health check    : http://localhost:${PORT}/healthz`);
  console.log('');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000);
});

export { server };
