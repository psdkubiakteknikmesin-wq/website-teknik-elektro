import { esc, inisial } from './util.js';

const BASE = '/assets';

/* ── ikon ──────────────────────────────────────────────────────────────── */

const ICONS = {
  bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  check: '<path d="m20 6-11 11-5-5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>',
  student: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  location: '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  wallet: '<path d="M3 7h18v12H3z"/><path d="M3 7V5h13v2"/><circle cx="17" cy="13" r="1.3"/>',
  percent: '<path d="m19 5-14 14"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/><path d="M3 12h18"/>',
  transfer: '<path d="M4 8h13l-3-3"/><path d="M20 16H7l3 3"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z"/><path d="M8 3v18"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 17h10v4H7z"/>',
  whatsapp: '<path d="M20 12a8 8 0 0 1-11.9 7L4 20l1.1-4A8 8 0 1 1 20 12Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5"/>',
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/>',
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 3h14l2 10v8H3v-8Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8"/><path d="M10 12h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.5a3.5 3.5 0 0 1 0 7"/><path d="M17 14.5c2.5.6 4 2.7 4 5.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h9"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  file: '<path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  spark: '<path d="m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2Z"/>',
  phone: '<path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2.2 2C10 18 6 14 4 5.2A2 2 0 0 1 6 3Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  map: '<path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z"/><path d="M9 3v16M15 5v16"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4Z"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
};

export function icon(name, cls = '') {
  const path = ICONS[name] || ICONS.file;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

/* ── komponen kecil ────────────────────────────────────────────────────── */

const STATUS = {
  baru: { label: 'Menunggu verifikasi', cls: 'st-baru', dot: 'amber' },
  diproses: { label: 'Sedang diproses', cls: 'st-proses', dot: 'blue' },
  selesai: { label: 'Selesai / terbit', cls: 'st-selesai', dot: 'green' },
  ditolak: { label: 'Ditolak', cls: 'st-tolak', dot: 'red' },
};

export function statusBadge(status) {
  const s = STATUS[status] || { label: status, cls: 'st-baru' };
  return `<span class="badge ${s.cls}"><i class="dot"></i>${esc(s.label)}</span>`;
}

export function statusLabel(status) {
  return STATUS[status]?.label || status;
}

export function flash(msg, type = 'ok') {
  if (!msg) return '';
  return `<div class="flash flash-${esc(type)}" role="status">
    ${icon(type === 'err' ? 'info' : 'check')}<span>${esc(msg)}</span>
    <button type="button" class="flash-x" onclick="this.parentElement.remove()" aria-label="Tutup">×</button>
  </div>`;
}

export function avatar(nama, cls = '') {
  return `<span class="avatar ${cls}">${esc(inisial(nama))}</span>`;
}

export function emptyState(judul, teks, aksi = '') {
  return `<div class="empty">
    <div class="empty-ic">${icon('inbox')}</div>
    <h3>${esc(judul)}</h3>
    <p>${esc(teks)}</p>
    ${aksi}
  </div>`;
}

function navLink(href, label, active, key, extra = '') {
  return `<a href="${href}" class="nav-link ${active === key ? 'is-active' : ''}">${label}${extra}</a>`;
}

/* ── layout publik ─────────────────────────────────────────────────────── */

export function publicLayout({ settings, user, title, body, active = '', desc = '' }) {
  const pageTitle = title ? `${title} · SIPREL Elektro` : 'SIPREL · Sistem Informasi Persuratan Teknik Elektro';
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(desc || 'Layanan pengajuan surat digital Jurusan Teknik Elektro, Fakultas Teknik, Universitas Cenderawasih.')}">
<link rel="icon" href="${BASE}/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${BASE}/styles.css">
<script src="${BASE}/app.js" defer></script>
</head>
<body class="portal">
<a class="skip-link" href="#main">Lewati ke konten</a>
<header class="site-head">
  <div class="wrap head-in">
    <a class="brand" href="/">
      <span class="brand-mark">${icon('bolt')}</span>
      <span class="brand-text"><strong>SIPREL</strong><small>Teknik Elektro · UNCEN</small></span>
    </a>
    <nav class="site-nav" id="site-nav" aria-label="Navigasi utama">
      ${navLink('/', 'Beranda', active, 'beranda')}
      ${navLink('/layanan', 'Layanan Surat', active, 'layanan')}
      ${navLink('/lacak', 'Lacak Surat', active, 'lacak')}
      ${navLink('/verifikasi', 'Verifikasi', active, 'verifikasi')}
    </nav>
    <div class="head-actions">
      ${user
        ? `<a class="btn btn-ghost btn-sm hide-sm" href="/saya">${icon('grid')} Dashboard saya</a>
           <a class="btn btn-primary btn-sm" href="/saya/ajukan">${icon('send')} Ajukan surat</a>`
        : `<a class="btn btn-ghost btn-sm hide-sm" href="/masuk">Masuk</a>
           <a class="btn btn-primary btn-sm" href="/daftar">Mulai ajukan</a>`}
      <button class="menu-btn" type="button" data-menu aria-label="Buka menu">${icon('grid')}</button>
    </div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="wrap foot-grid">
    <div class="foot-brand">
      <a class="brand" href="/">
        <span class="brand-mark">${icon('bolt')}</span>
        <span class="brand-text"><strong>SIPREL</strong><small>Teknik Elektro · UNCEN</small></span>
      </a>
      <p>Sistem Informasi Persuratan Jurusan Teknik Elektro, Fakultas Teknik, Universitas Cenderawasih. Melayani pengajuan, penerbitan, dan distribusi surat secara digital.</p>
      <p class="foot-note">${icon('location')} ${esc(settings.alamat)}</p>
    </div>
    <div>
      <h4>Layanan</h4>
      <ul class="foot-links">
        <li><a href="/layanan">Semua jenis surat</a></li>
        <li><a href="/saya/ajukan">Ajukan surat baru</a></li>
        <li><a href="/lacak">Lacak pengajuan</a></li>
        <li><a href="/verifikasi">Verifikasi keaslian</a></li>
        <li><a href="/terima">Portal penerima surat</a></li>
      </ul>
    </div>
    <div>
      <h4>Kontak</h4>
      <ul class="foot-links">
        <li>${icon('phone')} ${esc(settings.telepon)}</li>
        <li>${icon('mail')} ${esc(settings.email)}</li>
        <li>${icon('clock')} ${esc(settings.jam_layanan)}</li>
      </ul>
    </div>
    <div>
      <h4>Akses</h4>
      <ul class="foot-links">
        <li><a href="/masuk">Masuk mahasiswa</a></li>
        <li><a href="/penerima/masuk">Portal penerima (akun)</a></li>
        <li><a href="/admin/masuk">Masuk admin</a></li>
        <li><a href="/terima/demo-penerima-elektro">Contoh portal penerima</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap foot-bottom">
    <span>© ${new Date().getFullYear()} Jurusan Teknik Elektro FT UNCEN. Seluruh hak cipta dilindungi.</span>
    <span class="foot-tag">${icon('shield')} Surat terverifikasi digital</span>
  </div>
</footer>
</body>
</html>`;
}

/* ── layout admin ──────────────────────────────────────────────────────── */

const ADMIN_NAV = [
  { group: 'Ringkasan', items: [{ key: 'dash', href: '/admin', label: 'Dashboard', ic: 'grid' }] },
  {
    group: 'Persuratan',
    items: [
      { key: 'surat', href: '/admin/surat', label: 'Kelola surat', ic: 'inbox' },
      { key: 'baru', href: '/admin/surat?status=baru', label: 'Perlu verifikasi', ic: 'bell' },
      { key: 'jenis', href: '/admin/jenis', label: 'Jenis surat', ic: 'file' },
      { key: 'arsip', href: '/admin/arsip', label: 'Arsip digital', ic: 'archive' },
    ],
  },
  {
    group: 'Sistem',
    items: [
      { key: 'pengguna', href: '/admin/pengguna', label: 'Pengguna', ic: 'users', super: true },
      { key: 'penerima', href: '/admin/penerima', label: 'Akun penerima', ic: 'inbox', super: true },
      { key: 'wa', href: '/admin/wa', label: 'Notifikasi WhatsApp', ic: 'whatsapp' },
      { key: 'pengaturan', href: '/admin/pengaturan', label: 'Pengaturan', ic: 'settings', super: true },
      { key: 'log', href: '/admin/log', label: 'Log aktivitas', ic: 'clock', super: true },
    ],
  },
];

export function adminLayout({ settings, user, title, subtitle, body, active = '', counts = {} }) {
  const nav = ADMIN_NAV.map(
    (g) => `<div class="side-group">
      <p class="side-label">${g.group}</p>
      ${g.items
        .filter((it) => !it.super || user.role === 'superadmin')
        .map((it) => {
          const badge = it.key === 'baru' && counts.baru ? `<span class="nav-badge">${counts.baru}</span>` : '';
          return `<a href="${it.href}" class="side-link ${active === it.key ? 'is-active' : ''}">
            ${icon(it.ic)}<span>${it.label}</span>${badge}</a>`;
        })
        .join('')}
    </div>`
  ).join('');

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Admin SIPREL</title>
<meta name="robots" content="noindex">
<link rel="icon" href="${BASE}/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${BASE}/styles.css">
<script src="${BASE}/app.js" defer></script>
</head>
<body class="admin">
<div class="admin-shell">
  <aside class="sidebar" id="sidebar">
    <div class="side-brand">
      <a class="brand brand-side" href="/admin">
        <span class="brand-mark">${icon('bolt')}</span>
        <span class="brand-text"><strong>SIPREL</strong><small>Admin Panel</small></span>
      </a>
      <button class="side-close" type="button" data-menu aria-label="Tutup menu">${icon('x')}</button>
    </div>
    <nav class="side-nav" aria-label="Navigasi admin">${nav}</nav>
    <div class="side-foot">
      <div class="side-card">
        <p class="side-card-t">Butuh bantuan?</p>
        <p class="side-card-p">${user.role === 'superadmin' ? 'Panduan pengelolaan surat dan gateway WhatsApp tersedia di menu Pengaturan.' : 'Pengaturan gateway WhatsApp dan identitas surat dikelola oleh Admin Utama.'}</p>
        <a class="side-card-a" href="${user.role === 'superadmin' ? '/admin/pengaturan' : '/admin/wa'}">${icon('info')} ${user.role === 'superadmin' ? 'Buka pengaturan' : 'Notifikasi WhatsApp'}</a>
      </div>
      <a class="side-user" href="/admin/keluar">
        ${avatar(user.nama)}
        <span class="side-user-t"><strong>${esc(user.nama)}</strong><small>${esc(user.role === 'superadmin' ? 'Admin Utama' : user.role === 'admin' ? 'Admin Jurusan' : user.role)}</small></span>
        ${icon('logout')}
      </a>
    </div>
  </aside>
  <div class="admin-main">
    <header class="topbar">
      <button class="menu-btn menu-btn-admin" type="button" data-menu aria-label="Buka menu">${icon('grid')}</button>
      <div class="topbar-title">
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ''}
      </div>
      <div class="topbar-actions">
        <a class="btn btn-ghost btn-sm" href="/" target="_blank" rel="noopener">${icon('external')} Lihat situs</a>
        <a class="icon-btn" href="/admin/surat?status=baru" aria-label="Pengajuan baru">
          ${icon('bell')}${counts.baru ? `<span class="ping">${counts.baru}</span>` : ''}
        </a>
        ${avatar(user.nama, 'avatar-sm')}
      </div>
    </header>
    <main class="admin-content" id="main">${body}</main>
    <footer class="admin-foot">
      <span>${esc(settings.dept)} · ${esc(settings.fakultas)}</span>
      <span>SIPREL v1.0 · ${new Date().getFullYear()}</span>
    </footer>
  </div>
</div>
</body>
</html>`;
}

/* ── layout portal penerima ────────────────────────────────────────────── */

export function recipientLayout({ settings, title, body, letter, user, active = '', noindex = true }) {
  const nav = user
    ? `<nav class="rec-nav" aria-label="Navigasi portal penerima">
        <a href="/penerima" class="${active === 'surat' ? 'is-active' : ''}">${icon('inbox')} Surat saya</a>
        <a href="/penerima/verifikasi" class="${active === 'verifikasi' ? 'is-active' : ''}">${icon('shield')} Verifikasi</a>
        <a href="/penerima/keluar" class="rec-exit">${icon('logout')} Keluar</a>
      </nav>`
    : `<div class="rec-head-meta">
        <span class="pill pill-dark">${icon('shield')} Dokumen terverifikasi</span>
        ${letter?.kode ? `<span class="pill pill-dark mono">${esc(letter.kode)}</span>` : ''}
      </div>`;
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(settings.dept)}</title>
${noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="icon" href="${BASE}/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${BASE}/styles.css">
<style>@media print{@page{size:A5 portrait;margin:0}}</style>
<script src="${BASE}/app.js" defer></script>
</head>
<body class="recipient">
<header class="rec-head">
  <div class="wrap rec-head-in">
    <a class="brand brand-light" href="/penerima">
      <span class="brand-mark">${icon('bolt')}</span>
      <span class="brand-text"><strong>SIPREL</strong><small>Portal Penerima Surat</small></span>
    </a>
    ${nav}
  </div>
</header>
${body}
<footer class="rec-foot">
  <div class="wrap rec-foot-in">
    <p>${esc(settings.instansi2)} · ${esc(settings.fakultas)} · ${esc(settings.dept)}</p>
    <p>${esc(settings.alamat)}</p>
  </div>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
</body>
</html>`;
}

/* ── layout kosong (login) ─────────────────────────────────────────────── */

export function authLayout({ settings, title, body, side }) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · SIPREL Elektro</title>
<link rel="icon" href="${BASE}/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${BASE}/styles.css">
<script src="${BASE}/app.js" defer></script>
</head>
<body class="auth">
<div class="auth-split">
  <aside class="auth-side">
    <a class="brand brand-light" href="/">
      <span class="brand-mark">${icon('bolt')}</span>
      <span class="brand-text"><strong>SIPREL</strong><small>Teknik Elektro · UNCEN</small></span>
    </a>
    <div class="auth-side-body">
      <h2>${side?.judul || 'Layanan persuratan digital Jurusan Teknik Elektro.'}</h2>
      <p>${side?.teks || 'Ajukan surat kapan saja, pantau prosesnya, dan terima notifikasi langsung melalui WhatsApp.'}</p>
      <ul class="auth-points">
        <li>${icon('check')} 10 jenis surat jurusan dalam satu portal</li>
        <li>${icon('check')} Kode verifikasi surat melalui WhatsApp</li>
        <li>${icon('check')} Surat terverifikasi dengan kode unik</li>
      </ul>
    </div>
    <p class="auth-side-foot">${esc(settings.fakultas)} · ${esc(settings.instansi2)}</p>
  </aside>
  <main class="auth-main">
    <div class="auth-box">${body}</div>
    <p class="auth-copy">© ${new Date().getFullYear()} ${esc(settings.dept)} · <a href="/">Kembali ke beranda</a></p>
  </main>
</div>
</body>
</html>`;
}
