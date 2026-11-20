import fs from 'node:fs';
import path from 'node:path';
import { db, getSettings, setSetting, nextNomor, buatToken, buatKode, catatLog, BATAS_AKUN, jumlahAkun } from './db.js';
import { JENIS, JENIS_LIST, jenisByKode, pesanWA, pesanWAPenerima, pca } from './letters.js';
import { adminLayout, authLayout, statusBadge, icon, flash, emptyState, avatar } from './ui.js';
import { esc, todayID, tanggalID, tanggalJamID, waCantik, normalisasiWA, hashPassword, verifyPassword, nowISO, randomCode } from './util.js';
import { html, redirect, json, readBody, csrfField, csrfValid } from './http.js';
import { cookieSet, cookieClear, makeSession, rateLimit, ipDari } from './auth.js';
import { halamanSurat, lembarSurat, dataSurat } from './surat.js';
import { kirimWA, waLink } from './wa.js';

/* ── helpers ───────────────────────────────────────────────────────────── */

function getJson(id) {
  const row = db.prepare('SELECT * FROM letters WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, data: dataSurat(row) };
}

function counts() {
  const g = (q, ...p) => db.prepare(q).get(...p)?.n || 0;
  return {
    baru: g("SELECT COUNT(*) n FROM letters WHERE status = 'baru'"),
    diproses: g("SELECT COUNT(*) n FROM letters WHERE status = 'diproses'"),
    selesai: g("SELECT COUNT(*) n FROM letters WHERE status = 'selesai'"),
    ditolak: g("SELECT COUNT(*) n FROM letters WHERE status = 'ditolak'"),
    total: g('SELECT COUNT(*) n FROM letters'),
    arsip: g('SELECT COUNT(*) n FROM arsip'),
    pengguna: g('SELECT COUNT(*) n FROM users'),
    wa: g("SELECT COUNT(*) n FROM letters WHERE wa_status = 'terkirim'"),
  };
}

function queryString(base, params = {}) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== '' && v !== null && v !== undefined) u.set(k, v);
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

function pager(total, page, per, base, params) {
  const pages = Math.max(1, Math.ceil(total / per));
  if (pages <= 1) return '';
  const items = [];
  const cur = Math.min(Math.max(1, page), pages);
  const add = (n, label = String(n), active = false, disabled = false) =>
    items.push(
      disabled
        ? `<span class="pg is-disabled">${label}</span>`
        : `<a class="pg ${active ? 'is-active' : ''}" href="${esc(queryString(base, { ...params, page: n }))}">${label}</a>`
    );
  add(1, '‹', false, cur === 1);
  const start = Math.max(1, cur - 2);
  const end = Math.min(pages, cur + 2);
  if (start > 1) items.push('<span class="pg-dots">…</span>');
  for (let i = start; i <= end; i += 1) add(i, String(i), i === cur);
  if (end < pages) items.push('<span class="pg-dots">…</span>');
  add(pages, '›', false, cur === pages);
  return `<nav class="pager" aria-label="Navigasi halaman">${items.join('')}
    <span class="pg-info">Halaman ${cur} dari ${pages} · ${total} data</span></nav>`;
}

const PERAN_ADMIN = {
  superadmin: 'Admin Utama',
  admin: 'Admin Jurusan',
  mahasiswa: 'Mahasiswa',
  penerima: 'Penerima',
};

function labelPeran(role) {
  return PERAN_ADMIN[role] || role;
}

/**
 * Admin Utama (superadmin): semua menu.
 * Admin Jurusan (admin): operasional surat, arsip, akun penerima.
 * Menu sistem (pengguna, pengaturan, log) hanya Admin Utama.
 */
function adminGuard(ctx, perluSuper = false) {
  const user = ctx.user;
  if (user && (user.role === 'admin' || user.role === 'superadmin')) {
    if (!perluSuper || user.role === 'superadmin') return true;
    redirect(ctx.res, '/admin');
    return false;
  }
  redirect(ctx.res, '/admin/masuk?next=' + encodeURIComponent(ctx.pathname + (ctx.url.search || '')));
  return false;
}

function jenisLabel(kode) {
  return JENIS[kode]?.nama || kode;
}

function waBadge(status) {
  const map = {
    terkirim: ['Terkirim', 'st-selesai'],
    tautan: ['Tautan siap', 'st-proses'],
    gagal: ['Gagal', 'st-tolak'],
    belum: ['Belum dikirim', 'st-baru'],
  };
  const [label, cls] = map[status] || ['—', 'st-baru'];
  return `<span class="badge ${cls}"><i class="dot"></i>${label}</span>`;
}

/* ── login admin ───────────────────────────────────────────────────────── */

function adminLogin(ctx, pesan = '') {
  const body = `
    <p class="eyebrow">Panel administrator</p>
    <h1>Masuk ke dashboard</h1>
    <p class="auth-sub">Khusus petugas Jurusan Teknik Elektro.</p>
    ${flash(pesan, 'err')}
    <form method="post" action="/admin/masuk" class="auth-form">
      <div class="field full"><label for="email">Email petugas</label>
        <input class="input" id="email" name="email" type="email" required value="${esc(ctx.query.email || '')}" placeholder="admin@elektro.uncen.ac.id" autocomplete="username"></div>
      <div class="field full"><label for="password">Kata sandi</label>
        <div class="input-wrap"><input class="input" id="password" name="password" type="password" required autocomplete="current-password" placeholder="••••••••">
        <button type="button" class="reveal" data-reveal aria-label="Tampilkan kata sandi">${icon('lock')}</button></div></div>
      <button class="btn btn-primary btn-block" type="submit">Masuk sebagai admin</button>
    </form>
    <p class="auth-alt"><a href="/masuk">Masuk sebagai mahasiswa →</a></p>`;
  return html(
    ctx.res,
    authLayout({
      settings: ctx.settings,
      title: 'Masuk Admin',
      body,
      side: { judul: 'Kelola persuratan jurusan.', teks: 'Verifikasi pengajuan, terbitkan surat, kirim notifikasi WhatsApp, dan pantau seluruh arsip digital.' },
    })
  );
}

/* ── dashboard ─────────────────────────────────────────────────────────── */

function dashboard(ctx) {
  const c = counts();
  const s = ctx.settings;
  const antrian = db.prepare("SELECT * FROM letters WHERE status IN ('baru','diproses') ORDER BY created_at ASC LIMIT 6").all();
  const totalPct = Math.max(1, c.total);
  const seg = (n) => Math.round((n / totalPct) * 1000) / 10;
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000);
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jayapura' }).format(d);
    const n = db.prepare('SELECT COUNT(*) n FROM letters WHERE substr(created_at, 1, 10) = ?').get(iso)?.n || 0;
    days.push({ iso, n, label: new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'Asia/Jayapura' }).format(d) });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.n));
  const perJenis = db.prepare('SELECT jenis, COUNT(*) n FROM letters GROUP BY jenis ORDER BY n DESC').all();
  const maxJenis = Math.max(1, ...perJenis.map((r) => r.n));
  const logs = db.prepare('SELECT * FROM log ORDER BY id DESC LIMIT 7').all();
  const terbaru = db.prepare("SELECT * FROM letters WHERE status = 'selesai' AND token IS NOT NULL ORDER BY updated_at DESC LIMIT 4").all();

  const body = `
  <div class="page-intro">
    <div>
      <h2>${new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jayapura' }).format(new Date())}</h2>
      <p>Ringkasan pengajuan dan distribusi surat Jurusan Teknik Elektro.</p>
    </div>
    <div class="intro-actions">
      <a class="btn btn-ghost btn-sm" href="/admin/surat">${icon('inbox')} Semua surat</a>
      <a class="btn btn-primary btn-sm" href="/admin/surat?status=baru">${icon('check')} Verifikasi ${c.baru ? `(${c.baru})` : ''}</a>
    </div>
  </div>

  <div class="stat-row">
    <div class="stat-card">
      <span class="stat-ic teal">${icon('inbox')}</span>
      <div class="stat-body"><span>Total pengajuan</span><strong>${c.total}</strong><small>${c.baru} menunggu verifikasi</small></div>
    </div>
    <div class="stat-card">
      <span class="stat-ic amber">${icon('clock')}</span>
      <div class="stat-body"><span>Sedang diproses</span><strong>${c.diproses}</strong><small>${c.baru} belum ditindak</small></div>
    </div>
    <div class="stat-card">
      <span class="stat-ic green">${icon('check')}</span>
      <div class="stat-body"><span>Surat terbit</span><strong>${c.selesai}</strong><small>${c.wa} notifikasi WA terkirim</small></div>
    </div>
    <div class="stat-card">
      <span class="stat-ic blue">${icon('archive')}</span>
      <div class="stat-body"><span>Arsip digital</span><strong>${c.arsip.toLocaleString('id-ID')}</strong><small>Impor dokumen Word 2026</small></div>
    </div>
  </div>

  <div class="grid-main">
    <section class="card">
      <div class="card-head">
        <div><h2>Antrian pengajuan</h2><p class="muted-sm">Diurutkan dari yang paling lama menunggu.</p></div>
        <a class="link-arrow" href="/admin/surat?status=baru">Lihat semua ${icon('chevron')}</a>
      </div>
      ${antrian.length
        ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Pemohon</th><th>Jenis surat</th><th>Diajukan</th><th>Status</th><th></th></tr></thead>
            <tbody>${antrian
              .map(
                (l) => `<tr>
                <td><div class="u-cell">${avatar(l.nama || 'Mahasiswa')}<div><span class="t-strong">${esc(l.nama || 'Tanpa nama')}</span><small class="t-sub">${esc(l.nim || l.tiket)}</small></div></div></td>
                <td>${esc(jenisLabel(l.jenis))}<small class="t-sub">${esc(l.tiket)}</small></td>
                <td>${esc(tanggalJamID(l.created_at))}</td>
                <td>${statusBadge(l.status)}</td>
                <td class="t-right"><a class="btn btn-sm btn-outline" href="/admin/surat/${l.id}">Proses</a></td>
              </tr>`
              )
              .join('')}</tbody></table></div>`
        : emptyState('Tidak ada antrian', 'Semua pengajuan telah diproses. Kerja bagus!')}
    </section>

    <aside class="grid-side">
      <section class="card">
        <div class="card-head"><h2>Distribusi status</h2></div>
        <div class="donut-wrap">
          <div class="donut" style="background:conic-gradient(var(--green) 0 ${seg(c.selesai)}%, var(--blue) ${seg(c.selesai)}% ${seg(c.selesai) + seg(c.diproses)}%, var(--amber) ${seg(c.selesai) + seg(c.diproses)}% ${seg(c.selesai) + seg(c.diproses) + seg(c.baru)}%, var(--red) ${seg(c.selesai) + seg(c.diproses) + seg(c.baru)}% 100%)">
            <div class="donut-in"><strong>${c.total}</strong><span>surat</span></div>
          </div>
          <ul class="legend">
            <li><i class="lg green"></i>Terbit <b>${c.selesai}</b></li>
            <li><i class="lg blue"></i>Diproses <b>${c.diproses}</b></li>
            <li><i class="lg amber"></i>Menunggu <b>${c.baru}</b></li>
            <li><i class="lg red"></i>Ditolak <b>${c.ditolak}</b></li>
          </ul>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Aktivitas terbaru</h2><a class="link-arrow" href="/admin/log">Semua ${icon('chevron')}</a></div>
        <ul class="activity">
          ${logs
            .map(
              (l) => `<li><span class="act-dot"></span><div><b>${esc(String(l.aksi || '').replaceAll('_', ' '))}</b><small>${esc(l.detail || l.entitas || '')}</small></div><time>${esc(tanggalJamID(l.at))}</time></li>`
            )
            .join('') || '<li class="muted-sm">Belum ada aktivitas.</li>'}
        </ul>
      </section>
    </aside>
  </div>

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><div><h2>Pengajuan 7 hari terakhir</h2><p class="muted-sm">Volume pengajuan harian.</p></div><span class="chip">${days.reduce((a, b) => a + b.n, 0)} pengajuan</span></div>
      <div class="bars">
        ${days
          .map(
            (d) => `<div class="bar-col"><div class="bar" style="height:${Math.max(4, Math.round((d.n / maxDay) * 100))}%"><span>${d.n}</span></div><small>${esc(d.label)}</small></div>`
          )
          .join('')}
      </div>
    </section>
    <section class="card">
      <div class="card-head"><h2>Surat per jenis</h2></div>
      <div class="hbars">
        ${perJenis
          .map(
            (r) => `<div class="hbar"><span class="hb-label">${esc(JENIS[r.jenis]?.nama || r.jenis)}</span>
              <div class="hb-track"><i style="width:${Math.max(6, Math.round((r.n / maxJenis) * 100))}%"></i></div>
              <b>${r.n}</b></div>`
          )
          .join('') || '<p class="muted-sm">Belum ada data.</p>'}
      </div>
    </section>
  </div>

  <section class="card">
    <div class="card-head"><div><h2>Surat terbit terakhir</h2><p class="muted-sm">Tautan portal penerima siap dibagikan.</p></div></div>
    ${terbaru.length
      ? `<div class="issued-list">${terbaru
          .map(
            (l) => `<div class="issued">
              <div class="issued-ic">${icon('file')}</div>
              <div class="issued-body"><b>${esc(jenisLabel(l.jenis))}</b><small>${esc(l.nomor)} · ${esc(l.nama || '-')}</small></div>
              <a class="btn btn-sm btn-ghost" href="/admin/surat/${l.id}">Detail</a>
              <a class="btn btn-sm btn-outline" href="/terima/${esc(l.token)}" target="_blank" rel="noopener">Portal</a>
            </div>`
          )
          .join('')}</div>`
      : emptyState('Belum ada surat terbit', 'Terbitkan surat dari halaman detail pengajuan.')}
  </section>`;

  return html(ctx.res, adminLayout({ settings: s, user: ctx.user, title: 'Dashboard', subtitle: 'Ringkasan operasional persuratan', body, active: 'dash', counts: c }));
}

/* ── daftar surat ──────────────────────────────────────────────────────── */

function daftarSurat(ctx) {
  const c = counts();
  const status = String(ctx.query.status || '').trim();
  const jenis = String(ctx.query.jenis || '').trim();
  const q = String(ctx.query.q || '').trim();
  const page = Math.max(1, Number(ctx.query.page || 1));
  const per = 15;

  const where = [];
  const params = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (jenis) {
    where.push('jenis = ?');
    params.push(jenis);
  }
  if (q) {
    where.push('(tiket LIKE ? OR nama LIKE ? OR nim LIKE ? OR nomor LIKE ?)');
    for (let i = 0; i < 4; i += 1) params.push(`%${q}%`);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) n FROM letters ${w}`).get(...params).n;
  const rows = db
    .prepare(`SELECT * FROM letters ${w} ORDER BY id DESC LIMIT ${per} OFFSET ${(page - 1) * per}`)
    .all(...params);

  const tab = (key, label, n) =>
    `<a class="tab ${status === key ? 'is-active' : ''}" href="${esc(queryString('/admin/surat', { status: key, jenis, q }))}">${label}${n !== null ? `<span>${n}</span>` : ''}</a>`;

  const body = `
  <div class="page-intro">
    <div><h2>Kelola surat</h2><p>Verifikasi, terbitkan, dan kirim notifikasi WhatsApp kepada pemohon.</p></div>
    <a class="btn btn-primary btn-sm" href="/admin/arsip">${icon('archive')} Buka arsip</a>
  </div>

  <div class="tabs">
    ${tab('', 'Semua', c.total)}
    ${tab('baru', 'Menunggu', c.baru)}
    ${tab('diproses', 'Diproses', c.diproses)}
    ${tab('selesai', 'Terbit', c.selesai)}
    ${tab('ditolak', 'Ditolak', c.ditolak)}
  </div>

  <section class="card">
    <div class="filter-bar">
      <form class="search" method="get" action="/admin/surat">
        ${status ? `<input type="hidden" name="status" value="${esc(status)}">` : ''}
        <span class="search-ic">${icon('search')}</span>
        <input class="input" name="q" value="${esc(q)}" placeholder="Cari tiket, nama, NIM, atau nomor surat…">
      </form>
      <form class="filter-select" method="get" action="/admin/surat">
        ${status ? `<input type="hidden" name="status" value="${esc(status)}">` : ''}
        ${q ? `<input type="hidden" name="q" value="${esc(q)}">` : ''}
        <select class="input" name="jenis" onchange="this.form.submit()">
          <option value="">Semua jenis surat</option>
          ${JENIS_LIST.map((j) => `<option value="${j.kode}" ${jenis === j.kode ? 'selected' : ''}>${esc(j.nama)}</option>`).join('')}
        </select>
      </form>
    </div>
    ${rows.length
      ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Pemohon</th><th>Jenis / Tiket</th><th>Nomor surat</th><th>Status</th><th>WA</th><th class="t-right">Aksi</th></tr></thead>
        <tbody>${rows
          .map(
            (l) => `<tr>
            <td><div class="u-cell">${avatar(l.nama || 'M')}<div><span class="t-strong">${esc(l.nama || '-')}</span><small class="t-sub">${esc(l.nim || '-')}</small></div></div></td>
            <td>${esc(jenisLabel(l.jenis))}<small class="t-sub">${esc(l.tiket)} · ${esc(tanggalID((l.created_at || '').slice(0, 10)))}</small></td>
            <td class="mono">${esc(l.nomor || '—')}</td>
            <td>${statusBadge(l.status)}</td>
            <td>${waBadge(l.wa_status)}</td>
            <td class="t-right"><a class="btn btn-sm btn-outline" href="/admin/surat/${l.id}">Buka</a></td>
          </tr>`
          )
          .join('')}</tbody></table></div>
        ${pager(total, page, per, '/admin/surat', { status, jenis, q })}`
      : emptyState('Belum ada surat', 'Pengajuan baru dari mahasiswa akan muncul di sini.')}
  </section>`;

  return html(ctx.res, adminLayout({ settings: ctx.settings, user: ctx.user, title: 'Kelola Surat', subtitle: `${total} pengajuan ditemukan`, body, active: status === 'baru' ? 'baru' : 'surat', counts: c }));
}

/* ── detail surat ──────────────────────────────────────────────────────── */

function detailSuratAdmin(ctx, letter) {
  const c = counts();
  const s = ctx.settings;
  const jenis = jenisByKode(letter.jenis);
  const d = letter.data;
  const autoNomor = letter.nomor || nextNomor(s).nomor;
  const tanggal = letter.tanggal || todayID();
  const peran = letter.penandatangan || jenis?.penandatangan || 'ketua';
  const pesan = letter.status === 'selesai' ? pesanWA(letter, s, ctx.baseUrl) : '';
  const akunPenerima = db.prepare('SELECT id, nama, email, wa FROM penerima WHERE aktif = 1 ORDER BY nama').all();
  const penerimaTertaut = letter.penerima_id
    ? db.prepare('SELECT id, nama, email, wa FROM penerima WHERE id = ?').get(letter.penerima_id)
    : null;
  const tautanPortal = letter.token ? `${ctx.baseUrl}/terima/${letter.token}` : '';
  const fieldRows = (jenis?.fields || [])
    .map((f) => {
      let v = d[f.name] ?? '';
      if (f.name === 'peserta') v = pca(d.peserta).map((p) => `${p.nama} — ${p.nim}`).join('\n');
      return `<tr><th>${esc(f.label)}</th><td>${esc(String(v).split('\n').filter(Boolean).join(' · ') || '—')}</td></tr>`;
    })
    .join('');

  const body = `
  <div class="detail-top">
    <a class="back-link" href="/admin/surat">← Kelola surat</a>
    <div class="head-row">
      <div>
        <h2>${esc(letter.tiket)} <span class="muted-sm mono">${esc(letter.nomor || 'nomor belum ditetapkan')}</span></h2>
        <p class="muted">${esc(jenis?.nama || letter.jenis)} · diajukan ${esc(tanggalJamID(letter.created_at))}</p>
      </div>
      <div class="head-actions">${statusBadge(letter.status)}${waBadge(letter.wa_status)}</div>
    </div>
  </div>

  ${flash(ctx.query.ok, 'ok')}${flash(ctx.query.err, 'err')}

  <div class="detail-grid">
    <div class="detail-col">
      <section class="card">
        <div class="card-head"><h2>Data pemohon</h2><span class="muted-sm">${esc(letter.sumber === 'admin' ? 'Input petugas' : 'Pengajuan daring')}</span></div>
        <div class="u-cell big">${avatar(letter.nama || 'M')}<div><span class="t-strong">${esc(letter.nama || '-')}</span><small class="t-sub">${esc(letter.nim || '-')} · ${esc(waCantik(letter.wa) || 'WhatsApp belum diisi')}</small></div></div>
        <table class="kv mt">${fieldRows}
          <tr><th>Tiket</th><td class="mono">${esc(letter.tiket)}</td></tr>
          <tr><th>Catatan pemohon</th><td>${esc(letter.catatan_pemohon || '—')}</td></tr>
        </table>
      </section>

      <section class="card">
        <div class="card-head"><h2>Penerbitan surat</h2><span class="chip">${letter.status === 'selesai' ? 'Surat terbit' : 'Draft'}</span></div>
        <form method="post" action="/admin/surat/${letter.id}" class="form-grid-1">
          ${csrfField(ctx.user)}
          <div class="fields">
            <div class="field"><label>Nomor surat</label><input class="input mono" name="nomor" value="${esc(autoNomor)}"></div>
            <div class="field"><label>Tanggal surat</label><input class="input" type="date" name="tanggal" value="${esc(tanggal)}"></div>
            <div class="field"><label>Penandatangan</label>
              <select class="input" name="penandatangan">
                <option value="ketua" ${peran === 'ketua' ? 'selected' : ''}>Ketua Jurusan — ${esc(s.ketua_nama)}</option>
                <option value="sekretaris" ${peran === 'sekretaris' ? 'selected' : ''}>Sekretaris Jurusan — ${esc(s.sekretaris_nama)}</option>
              </select>
            </div>
            <div class="field"><label>Perihal surat</label><input class="input" name="perihal" value="${esc(letter.perihal || jenis?.perihal || '')}"></div>
            <div class="field"><label>Catatan petugas <span class="opt">(tampil ke pemohon)</span></label>
              <textarea class="input" name="catatan_admin" rows="2">${esc(letter.catatan_admin || '')}</textarea></div>
          </div>
          <div class="action-row">
            <button class="btn btn-ghost" name="action" value="simpan" type="submit">${icon('check')} Simpan</button>
            <button class="btn btn-outline" name="action" value="verifikasi" type="submit">${icon('clock')} Tandai diverifikasi</button>
            <button class="btn btn-primary" name="action" value="terbitkan" type="submit">${icon('file')} Terbitkan surat</button>
            <button class="btn btn-danger-ghost" name="action" value="tolak" type="submit" onclick="return confirm('Tolak pengajuan ini? Pemohon akan melihat alasan penolakan.')">Tolak</button>
          </div>
        </form>
      </section>

      <section class="card">
        <div class="card-head"><h2>Distribusi &amp; notifikasi</h2></div>
        ${letter.status === 'selesai' && letter.token
          ? `<div class="link-box"><span class="mono">${esc(tautanPortal)}</span>
              <button class="btn btn-sm btn-outline" type="button" data-copy="${esc(tautanPortal)}">${icon('copy')} Salin</button>
              <a class="btn btn-sm btn-ghost" href="/terima/${esc(letter.token)}" target="_blank" rel="noopener">${icon('external')} Buka</a></div>
            <div class="wa-panel">
              <div class="wa-panel-head">${icon('whatsapp')}<div><b>Notifikasi WhatsApp</b><small>${esc(waCantik(letter.wa) || 'Nomor belum diisi')}</small></div>${waBadge(letter.wa_status)}</div>
              <pre class="wa-preview">${esc(pesan)}</pre>
              <div class="action-row">
                <button class="btn btn-wa" type="button" data-wa data-token="${esc(letter.token)}">${icon('whatsapp')} Kirim sekarang</button>
                <a class="btn btn-outline" href="${esc(waLink(letter.wa, pesan))}" target="_blank" rel="noopener">Buka wa.me</a>
                <button class="btn btn-ghost" type="button" data-copy="${esc(pesan)}">${icon('copy')} Salin pesan</button>
              </div>
              <p class="help">${s.wa_provider ? `Gateway aktif: <b>${esc(s.wa_provider)}</b>.` : 'Gateway belum diatur — tombol akan membuka WhatsApp dengan pesan siap kirim.'}</p>
            </div>`
          : `<p class="muted">Distribusi aktif setelah surat diterbitkan. Nomor dan tautan portal penerima dibuat otomatis saat penerbitan.</p>`}
      </section>

      <section class="card">
        <div class="card-head">
          <div><h2>Kirim ke akun penerima</h2><p class="muted-sm">Surat akan tampil di portal penerima yang dipilih. Notifikasi WhatsApp dikirim ke nomor akun penerima, bukan nomor pemohon.</p></div>
          ${penerimaTertaut ? `<span class="badge st-selesai"><i class="dot"></i>${esc(penerimaTertaut.nama)}</span>` : '<span class="chip">Belum ditautkan</span>'}
        </div>
        ${akunPenerima.length
          ? `<form method="post" action="/admin/surat/${letter.id}" class="form-grid-1">
              ${csrfField(ctx.user)}
              <div class="fields">
                <div class="field full"><label>Akun penerima</label>
                  <select class="input" name="penerima_id">
                    <option value="">— pilih akun penerima —</option>
                    ${akunPenerima.map((a) => `<option value="${a.id}" ${letter.penerima_id === a.id ? 'selected' : ''}>${esc(a.nama)} — ${esc(a.email)}${a.wa ? ` (${esc(waCantik(a.wa))})` : ''}</option>`).join('')}
                  </select>
                  <p class="help">Daftar ini berasal dari menu Akun penerima (dibuat Admin Utama).</p>
                </div>
              </div>
              <div class="action-row">
                <button class="btn btn-primary" name="action" value="tautkan_penerima" type="submit">${icon('users')} Tautkan ke portal</button>
                <button class="btn btn-wa" name="action" value="tautkan_kirim" type="submit" ${letter.status === 'selesai' ? '' : 'disabled'}>${icon('whatsapp')} Tautkan &amp; kirim WhatsApp</button>
              </div>
              ${letter.status === 'selesai' ? '' : '<p class="help">Tombol kirim WhatsApp aktif setelah surat diterbitkan.</p>'}
            </form>
            ${penerimaTertaut ? `<div class="action-row" style="margin-top:10px">
              <form method="post" action="/admin/surat/${letter.id}">
                ${csrfField(ctx.user)}
                <input type="hidden" name="action" value="kirim_wa_penerima">
                <button class="btn btn-wa btn-sm" type="submit">${icon('whatsapp')} Kirim ulang WhatsApp ke penerima</button>
              </form>
              <form method="post" action="/admin/surat/${letter.id}">
                ${csrfField(ctx.user)}
                <input type="hidden" name="action" value="lepas_penerima">
                <button class="btn btn-ghost btn-sm" type="submit">Lepas tautan penerima</button>
              </form>
            </div>` : ''}`
          : `<div class="alert alert-err" style="margin-bottom:0">${icon('info')}<div><strong>Belum ada akun penerima</strong><p>Admin Utama perlu membuat akun penerima terlebih dahulu di menu <a href="/admin/penerima">Akun penerima</a>.</p></div></div>`}
      </section>

      <section class="card">
        <div class="card-head"><h2>Verifikasi &amp; jejak</h2></div>
        <table class="kv">
          <tr><th>Kode verifikasi</th><td class="mono">${esc(letter.kode || '—')}</td></tr>
          <tr><th>Dicetak penerima</th><td>${esc(letter.dicetak_at ? tanggalJamID(letter.dicetak_at) : 'Belum dicetak')}</td></tr>
          <tr><th>Notifikasi WA terakhir</th><td>${esc(letter.wa_at ? tanggalJamID(letter.wa_at) : '—')}</td></tr>
          <tr><th>Terakhir diperbarui</th><td>${esc(tanggalJamID(letter.updated_at))}</td></tr>
        </table>
        ${letter.kode ? `<a class="link-arrow mt" href="/verifikasi/${esc(letter.kode)}" target="_blank" rel="noopener">Buka halaman verifikasi publik ${icon('chevron')}</a>` : ''}
      </section>
    </div>

    <aside class="detail-preview">
      <div class="preview-head"><h2>Pratinjau surat</h2><a class="btn btn-sm btn-ghost" href="/admin/surat/${letter.id}/cetak" target="_blank" rel="noopener">${icon('print')} Cetak / PDF</a></div>
      <div class="preview-stage"><div class="preview-scaler">${lembarSurat(letter, s, '')}</div></div>
      <p class="help">Pratinjau mengikuti format surat resmi jurusan (A4). Nomor dan tanggal mengikuti isian di samping.</p>
    </aside>
  </div>`;

  return html(ctx.res, adminLayout({ settings: s, user: ctx.user, title: 'Detail Surat', subtitle: letter.tiket, body, active: 'surat', counts: c }));
}

/* ── jenis surat ───────────────────────────────────────────────────────── */

function halamanJenis(ctx) {
  const c = counts();
  const s = ctx.settings;
  const disabled = String(s.jenis_nonaktif || '').split(',').map((x) => x.trim()).filter(Boolean);
  const perJenis = db.prepare('SELECT jenis, COUNT(*) n FROM letters GROUP BY jenis').all();
  const map = Object.fromEntries(perJenis.map((r) => [r.jenis, r.n]));
  const body = `
  <div class="page-intro"><div><h2>Jenis surat</h2><p>Layanan aktif pada portal pengajuan mahasiswa. Nonaktifkan layanan yang sedang tidak dibuka.</p></div></div>
  ${flash(ctx.query.ok, 'ok')}
  <div class="jenis-list">
    ${JENIS_LIST.map((j) => {
      const off = disabled.includes(j.kode);
      return `<div class="jenis-row ${off ? 'is-off' : ''}">
        <span class="type-ic type-${j.warna}">${icon(j.ikon)}</span>
        <div class="jenis-main"><div class="jenis-title"><h3>${esc(j.nama)}</h3><span class="chip">${esc(j.kategori)}</span>${off ? '<span class="chip chip-off">Nonaktif</span>' : ''}</div>
          <p>${esc(j.singkat)}</p>
          <code class="jenis-kode">${esc(j.kode)}</code>
        </div>
        <div class="jenis-meta"><strong>${map[j.kode] || 0}</strong><span>pengajuan</span></div>
        <form method="post" action="/admin/jenis">
          ${csrfField(ctx.user)}
          <input type="hidden" name="kode" value="${esc(j.kode)}">
          <input type="hidden" name="aktif" value="${off ? '1' : '0'}">
          <button class="btn btn-sm ${off ? 'btn-primary' : 'btn-ghost'}" type="submit">${off ? 'Aktifkan' : 'Nonaktifkan'}</button>
        </form>
      </div>`;
    }).join('')}
  </div>
  <p class="help">Formulir setiap jenis surat mengikuti format dokumen resmi jurusan. Perubahan definisi dilakukan pada kode sumber (<code>src/letters.js</code>).</p>`;
  return html(ctx.res, adminLayout({ settings: s, user: ctx.user, title: 'Jenis Surat', subtitle: `${JENIS_LIST.length} layanan`, body, active: 'jenis', counts: c }));
}

/* ── arsip ─────────────────────────────────────────────────────────────── */

function halamanArsip(ctx) {
  const c = counts();
  const q = String(ctx.query.q || '').trim();
  const jenis = String(ctx.query.jenis || '').trim();
  const page = Math.max(1, Number(ctx.query.page || 1));
  const per = 20;
  const where = [];
  const params = [];
  if (q) {
    where.push('(nama LIKE ? OR nim LIKE ? OR nomor LIKE ? OR instansi LIKE ?)');
    for (let i = 0; i < 4; i += 1) params.push(`%${q}%`);
  }
  if (jenis) {
    where.push('jenis = ?');
    params.push(jenis);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) n FROM arsip ${w}`).get(...params).n;
  const rows = db.prepare(`SELECT * FROM arsip ${w} ORDER BY tanggal DESC, id DESC LIMIT ${per} OFFSET ${(page - 1) * per}`).all(...params);
  const statJenis = db.prepare('SELECT jenis, COUNT(*) n FROM arsip GROUP BY jenis ORDER BY n DESC').all();
  const maxJ = Math.max(1, ...statJenis.map((r) => r.n));

  const body = `
  <div class="page-intro"><div><h2>Arsip digital</h2><p>${c.arsip} surat lama yang diimpor dari dokumen Word jurusan (tahun 2025–2026).</p></div>
    <a class="btn btn-ghost btn-sm" href="/admin/surat">${icon('inbox')} Surat aktif</a></div>
  <div class="grid-2 arsip-top">
    <section class="card">
      <div class="card-head"><h2>Komposisi arsip</h2></div>
      <div class="hbars">
        ${statJenis.map(
          (r) => `<div class="hbar"><span class="hb-label">${esc(JENIS[r.jenis]?.nama || r.jenis)}</span>
          <div class="hb-track"><i style="width:${Math.max(5, Math.round((r.n / maxJ) * 100))}%"></i></div><b>${r.n}</b></div>`
        ).join('')}
      </div>
    </section>
    <section class="card arsip-search">
      <div class="card-head"><h2>Telusuri arsip</h2></div>
      <form method="get" action="/admin/arsip" class="form-grid-1">
        <div class="field"><label>Cari nama, NIM, nomor, instansi</label><input class="input" name="q" value="${esc(q)}" placeholder="cth. Renaldi atau 601/UN20"></div>
        <div class="field"><label>Jenis surat</label>
          <select class="input" name="jenis"><option value="">Semua jenis</option>
          ${JENIS_LIST.map((j) => `<option value="${j.kode}" ${jenis === j.kode ? 'selected' : ''}>${esc(j.nama)}</option>`).join('')}</select></div>
        <button class="btn btn-primary" type="submit">${icon('search')} Telusuri</button>
      </form>
    </section>
  </div>
  <section class="card">
    ${rows.length
      ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Nomor</th><th>Nama / NIM</th><th>Jenis surat</th><th>Perihal</th><th>Tanggal</th><th>Peserta</th></tr></thead>
        <tbody>${rows
          .map((r) => {
            let peserta = 0;
            try {
              peserta = JSON.parse(r.peserta || '[]').length;
            } catch {
              peserta = 0;
            }
            return `<tr>
              <td class="mono">${esc(r.nomor || '—')}</td>
              <td><span class="t-strong">${esc(r.nama || '—')}</span><small class="t-sub">${esc(r.nim || '')}</small></td>
              <td>${esc(JENIS[r.jenis]?.nama || r.jenis || '—')}</td>
              <td class="t-clamp">${esc(r.hal || '—')}${r.instansi ? `<small class="t-sub">${esc(r.instansi)}</small>` : ''}</td>
              <td>${esc(tanggalID(r.tanggal))}</td>
              <td>${peserta ? `<span class="chip">${peserta} orang</span>` : '—'}</td>
            </tr>`;
          })
          .join('')}</tbody></table></div>
        ${pager(total, page, per, '/admin/arsip', { q, jenis })}`
      : emptyState('Arsip tidak ditemukan', 'Coba kata kunci lain atau pilih jenis surat berbeda.')}
  </section>`;
  return html(ctx.res, adminLayout({ settings: ctx.settings, user: ctx.user, title: 'Arsip Digital', subtitle: `${total} hasil`, body, active: 'arsip', counts: c }));
}

/* ── pengguna ──────────────────────────────────────────────────────────── */

function halamanPengguna(ctx) {
  const c = counts();
  const q = String(ctx.query.q || '').trim();
  const users = q
    ? db.prepare('SELECT * FROM users WHERE nama LIKE ? OR email LIKE ? OR nim LIKE ? ORDER BY id DESC').all(`%${q}%`, `%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM users ORDER BY id DESC').all();
  const jumlahSurat = db.prepare('SELECT pemohon_id, COUNT(*) n FROM letters GROUP BY pemohon_id').all();
  const map = Object.fromEntries(jumlahSurat.map((r) => [r.pemohon_id, r.n]));

  const body = `
  <div class="page-intro"><div><h2>Pengguna</h2><p>Akun mahasiswa dan administrator SIPREL.</p></div></div>
  ${flash(ctx.query.ok, 'ok')}${flash(ctx.query.err, 'err')}
  <div class="grid-main">
    <section class="card">
      <div class="card-head"><div><h2>Daftar pengguna</h2><p class="muted-sm">${users.length} akun · ${jumlahAkun()} / ${BATAS_AKUN} total</p></div>
        <form class="search small" method="get" action="/admin/pengguna"><span class="search-ic">${icon('search')}</span>
        <input class="input" name="q" value="${esc(q)}" placeholder="Cari nama, email, NIM…"></form></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Nama</th><th>Kontak</th><th>Peran</th><th>Pengajuan</th><th>Status</th><th class="t-right">Aksi</th></tr></thead>
        <tbody>${users
          .map(
            (u) => `<tr>
            <td><div class="u-cell">${avatar(u.nama)}<div><span class="t-strong">${esc(u.nama)}</span><small class="t-sub">${esc(u.nim || '—')}</small></div></div></td>
            <td>${esc(u.email)}<small class="t-sub">${esc(waCantik(u.wa) || '—')}</small></td>
            <td><span class="chip ${['admin', 'superadmin'].includes(u.role) ? 'chip-dark' : ''}">${esc(labelPeran(u.role))}</span></td>
            <td>${map[u.id] || 0}</td>
            <td>${u.aktif ? '<span class="badge st-selesai"><i class="dot"></i>Aktif</span>' : '<span class="badge st-tolak"><i class="dot"></i>Nonaktif</span>'}</td>
            <td class="t-right">
              <a class="btn btn-sm btn-outline" href="/admin/pengguna/${u.id}">Edit</a>
              <form method="post" action="/admin/pengguna" class="inline-form">
                ${csrfField(ctx.user)}
                <input type="hidden" name="id" value="${u.id}">
                <button class="btn btn-sm btn-ghost" name="action" value="toggle" type="submit">${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button class="btn btn-sm btn-ghost" name="action" value="reset" type="submit" onclick="return confirm('Reset kata sandi pengguna ini?')">Reset sandi</button>
              </form>
            </td>
          </tr>`
          )
          .join('')}</tbody></table></div>
    </section>
    <aside class="grid-side">
      <section class="card">
        <div class="card-head"><h2>Tambah petugas</h2></div>
        <form method="post" action="/admin/pengguna" class="form-grid-1">
          ${csrfField(ctx.user)}
          <input type="hidden" name="action" value="tambah">
          <div class="field"><label>Nama lengkap</label><input class="input" name="nama" required></div>
          <div class="field"><label>Email</label><input class="input" name="email" type="email" required></div>
          <div class="field"><label>Peran</label><select class="input" name="role"><option value="mahasiswa">Mahasiswa</option><option value="admin">Admin Jurusan</option><option value="superadmin">Admin Utama</option></select></div>
          <div class="field"><label>Kata sandi awal</label><input class="input" name="password" type="text" value="${esc(randomCode(10))}" required></div>
          <button class="btn btn-primary" type="submit">${icon('users')} Simpan pengguna</button>
        </form>
      </section>
      <section class="card side-card tone">
        <h3>Keamanan akun</h3>
        <p>Gunakan kata sandi minimal 8 karakter. Reset kata sandi akan menampilkan sandi baru satu kali di layar.</p>
      </section>
    </aside>
  </div>`;
  return html(ctx.res, adminLayout({ settings: ctx.settings, user: ctx.user, title: 'Pengguna', subtitle: `${users.length} akun terdaftar`, body, active: 'pengguna', counts: c }));
}

function halamanEditPengguna(ctx, target) {
  const c = counts();
  const jumlah = db.prepare('SELECT COUNT(*) AS n FROM letters WHERE pemohon_id = ?').get(target.id)?.n || 0;
  const diriSendiri = target.id === ctx.user.id;
  const opsiPeran = [
    ['mahasiswa', 'Mahasiswa'],
    ['admin', 'Admin Jurusan'],
    ['superadmin', 'Admin Utama'],
  ]
    .map(([v, l]) => `<option value="${v}" ${target.role === v ? 'selected' : ''}>${l}</option>`)
    .join('');

  const body = `
  <div class="detail-top">
    <a class="back-link" href="/admin/pengguna">← Daftar pengguna</a>
    <div class="head-row">
      <div>
        <h2>${esc(target.nama)}</h2>
        <p class="muted">Username login: <span class="mono">${esc(target.email)}</span> · terdaftar ${esc(tanggalJamID(target.created_at))}</p>
      </div>
      <div class="head-actions">
        ${target.aktif ? '<span class="badge st-selesai"><i class="dot"></i>Aktif</span>' : '<span class="badge st-tolak"><i class="dot"></i>Nonaktif</span>'}
        <span class="chip">${esc(target.role)}</span>
      </div>
    </div>
  </div>

  ${flash(ctx.query.ok, 'ok')}${flash(ctx.query.err, 'err')}

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><h2>Data akun</h2><span class="muted-sm">ID #${target.id}</span></div>
      <form method="post" action="/admin/pengguna/${target.id}" class="form-grid-1">
        ${csrfField(ctx.user)}
        <div class="fields">
          <div class="field half"><label>Nama lengkap</label>
            <input class="input" name="nama" value="${esc(target.nama)}" required></div>
          <div class="field half"><label>Email (username login)</label>
            <input class="input" name="email" type="email" value="${esc(target.email)}" required></div>
          <div class="field half"><label>Peran</label>
            ${diriSendiri
              ? `<input class="input" value="Administrator (akun sendiri)" disabled><input type="hidden" name="role" value="${esc(target.role)}">`
              : `<select class="input" name="role">${opsiPeran}</select>`}</div>
          <div class="field half"><label>Status akun</label>
            ${diriSendiri
              ? `<input class="input" value="Aktif (akun sendiri)" disabled><input type="hidden" name="aktif" value="1">`
              : `<select class="input" name="aktif"><option value="1" ${target.aktif ? 'selected' : ''}>Aktif</option><option value="0" ${!target.aktif ? 'selected' : ''}>Nonaktif</option></select>`}</div>
          <div class="field half"><label>NIM <span class="opt">(opsional)</span></label>
            <input class="input" name="nim" value="${esc(target.nim || '')}"></div>
          <div class="field half"><label>Nomor WhatsApp</label>
            <input class="input" name="wa" type="tel" value="${esc(target.wa || '')}" placeholder="cth. 082199255839"></div>
        </div>

        <div class="card-head mt"><h2>${icon('lock')} Kata sandi</h2></div>
        <div class="alert alert-ok" style="margin-bottom:14px">
          ${icon('lock')}
          <div><strong>Sandi lama tidak dapat ditampilkan</strong>
          <p>Tersimpan dalam bentuk terenkripsi (scrypt) sehingga tidak bisa dibaca — ini standar keamanan. Isi kolom di bawah untuk menetapkan sandi baru; sandi lama otomatis tidak berlaku.</p></div>
        </div>
        <div class="fields">
          <div class="field half"><label>Sandi baru</label>
            <div class="input-wrap">
              <input class="input" id="sandi-baru" name="password" type="password" minlength="6" autocomplete="new-password" placeholder="Kosongkan bila tidak diubah">
              <button class="reveal" type="button" data-reveal aria-label="Tampilkan kata sandi">${icon('search')}</button>
            </div>
            <p class="help">Minimal 6 karakter. Setelah disimpan, sampaikan sandi ini kepada pengguna.</p></div>
          <div class="field half"><label>Ulangi sandi baru</label>
            <input class="input" name="password2" type="password" minlength="6" autocomplete="new-password" placeholder="Ketik ulang sandi baru"></div>
        </div>

        <div class="form-foot">
          <a class="btn btn-ghost" href="/admin/pengguna">Batal</a>
          <button class="btn btn-primary" type="submit">${icon('check')} Simpan perubahan</button>
        </div>
      </form>
    </section>

    <aside class="grid-side">
      <section class="card side-card">
        <h3>Ringkasan akun</h3>
        <div class="mini-list">
          <div><span>Username</span><b class="mono">${esc(target.email)}</b></div>
          <div><span>Peran</span><b>${esc(target.role)}</b></div>
          <div><span>Status</span><b>${target.aktif ? 'Aktif' : 'Nonaktif'}</b></div>
          <div><span>Pengajuan surat</span><b>${jumlah}</b></div>
          <div><span>Nomor WhatsApp</span><b>${esc(waCantik(target.wa) || '—')}</b></div>
        </div>
      </section>
      <section class="card side-card tone">
        <h3>Buat sandi acak</h3>
        <p>Jika tidak ingin mengetik sandi sendiri, buat sandi acak. Sandi akan ditampilkan satu kali di layar setelah dibuat.</p>
        <form method="post" action="/admin/pengguna">
          ${csrfField(ctx.user)}
          <input type="hidden" name="id" value="${target.id}">
          <button class="btn btn-outline btn-block" name="action" value="reset" type="submit" onclick="return confirm('Buat sandi acak baru untuk pengguna ini?')">${icon('lock')} Buat sandi acak</button>
        </form>
      </section>
      ${target.id === ctx.user.id ? '' : `<section class="card side-card" style="border-color:#f3c6c6">
        <h3 style="color:#b91c1c">Hapus akun</h3>
        <p>Akun dihapus permanen. Surat yang pernah diajukan tetap tersimpan di arsip jurusan.</p>
        <form method="post" action="/admin/pengguna/${target.id}" onsubmit="return confirm('Hapus akun ini secara permanen?')">
          ${csrfField(ctx.user)}
          <input type="hidden" name="action" value="hapus">
          <button class="btn btn-danger-ghost btn-block" type="submit">${icon('logout')} Hapus akun</button>
        </form>
      </section>`}
      <section class="card side-card">
        <h3>Tips</h3>
        <p>Username adalah email. Jika pengguna lupa sandi, buka halaman ini dan tetapkan sandi baru. Untuk menonaktifkan sementara, ubah Status akun menjadi Nonaktif.</p>
      </section>
    </aside>
  </div>`;

  return html(
    ctx.res,
    adminLayout({
      settings: ctx.settings,
      user: ctx.user,
      title: 'Edit Pengguna',
      subtitle: target.nama,
      body,
      active: 'pengguna',
      counts: c,
    })
  );
}


function halamanAkunPenerima(ctx) {
  const c = counts();
  const q = String(ctx.query.q || '').trim();
  const rows = q
    ? db
        .prepare('SELECT * FROM penerima WHERE nama LIKE ? OR email LIKE ? OR wa LIKE ? ORDER BY id DESC')
        .all(`%${q}%`, `%${q}%`, `%${q}%`)
    : db.prepare('SELECT * FROM penerima ORDER BY id DESC').all();
  const suratMap = Object.fromEntries(
    db.prepare('SELECT wa, COUNT(*) AS n FROM letters GROUP BY wa').all().map((r) => [r.wa, r.n])
  );
  const total = db.prepare('SELECT COUNT(*) AS n FROM penerima').get().n;
  const aktif = db.prepare('SELECT COUNT(*) AS n FROM penerima WHERE aktif = 1').get().n;

  const body = `
  <div class="page-intro">
    <div><h2>Akun penerima surat</h2><p>Akun khusus portal penerima — <strong>terpisah</strong> dari akun pengajuan mahasiswa. Hanya Admin Utama yang dapat menambah atau menghapus.</p></div>
    <a class="btn btn-outline btn-sm" href="/admin/pengguna">${icon('users')} Akun pengguna</a>
  </div>
  ${flash(ctx.query.ok, 'ok')}${flash(ctx.query.err, 'err')}

  <div class="stat-row">
    <div class="stat-card"><span class="stat-ic teal">${icon('users')}</span><div class="stat-body"><span>Total akun penerima</span><strong>${total}</strong><small>login di /penerima</small></div></div>
    <div class="stat-card"><span class="stat-ic green">${icon('check')}</span><div class="stat-body"><span>Aktif</span><strong>${aktif}</strong><small>${total - aktif} nonaktif</small></div></div>
    <div class="stat-card"><span class="stat-ic blue">${icon('inbox')}</span><div class="stat-body"><span>Surat tertaut</span><strong>${rows.reduce((a, r) => a + (suratMap[r.wa] || 0), 0)}</strong><small>berdasarkan nomor WhatsApp</small></div></div>
  </div>

  <div class="grid-main">
    <section class="card">
      <div class="card-head">
        <div><h2>Daftar akun penerima</h2><p class="muted-sm">${rows.length} akun · ${jumlahAkun()} / ${BATAS_AKUN} total</p></div>
        <form class="search small" method="get" action="/admin/penerima">
          <span class="search-ic">${icon('search')}</span>
          <input class="input" name="q" value="${esc(q)}" placeholder="Cari nama, email, WhatsApp…">
        </form>
      </div>
      ${rows.length
        ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Nama</th><th>Username login</th><th>WhatsApp</th><th>Surat</th><th>Status</th><th class="t-right">Aksi</th></tr></thead>
        <tbody>${rows
          .map(
            (u) => `<tr>
            <td><div class="u-cell">${avatar(u.nama)}<div><span class="t-strong">${esc(u.nama)}</span><small class="t-sub">${esc(u.nim || '—')}</small></div></div></td>
            <td>${esc(u.email)}</td>
            <td>${esc(waCantik(u.wa) || '—')}</td>
            <td>${suratMap[u.wa] || 0}</td>
            <td>${u.aktif ? '<span class="badge st-selesai"><i class="dot"></i>Aktif</span>' : '<span class="badge st-tolak"><i class="dot"></i>Nonaktif</span>'}</td>
            <td class="t-right"><a class="btn btn-sm btn-outline" href="/admin/penerima/${u.id}">Edit</a></td>
          </tr>`
          )
          .join('')}</tbody></table></div>`
        : emptyState('Belum ada akun penerima', 'Tambahkan akun lewat formulir di samping. Pendaftaran mandiri dinonaktifkan — hanya Admin Utama yang dapat membuat akun penerima.')}
    </section>

    <aside class="grid-side">
      <section class="card">
        <div class="card-head"><h2>Tambah akun penerima</h2></div>
        <form method="post" action="/admin/penerima" class="form-grid-1">
          ${csrfField(ctx.user)}
          <input type="hidden" name="action" value="tambah">
          <div class="field"><label>Nama lengkap</label><input class="input" name="nama" required></div>
          <div class="field"><label>Email (username login)</label><input class="input" name="email" type="email" required></div>
          <div class="field"><label>Nomor WhatsApp</label><input class="input" name="wa" type="tel" required placeholder="cth. 082199255839"></div>
          <div class="field"><label>NIM <span class="opt">(opsional)</span></label><input class="input" name="nim"></div>
          <div class="field"><label>Kata sandi awal</label><input class="input" name="password" type="text" value="${esc(randomCode(10))}" required></div>
          <button class="btn btn-primary" type="submit">${icon('users')} Simpan akun penerima</button>
        </form>
        <p class="help">Akun ini hanya bisa dipakai di portal penerima, tidak bisa masuk ke portal pengajuan.</p>
      </section>
      <section class="card side-card tone">
        <h3>Cara kerja</h3>
        <p>Surat dicocokkan dari <strong>nomor WhatsApp</strong>. Pastikan nomor akun penerima sama dengan nomor yang dipakai saat mengajukan surat.</p>
        <p class="side-contact">${icon('shield')} Login: /penerima</p>
      </section>
    </aside>
  </div>`;

  return html(
    ctx.res,
    adminLayout({ settings: ctx.settings, user: ctx.user, title: 'Akun Penerima', subtitle: `${total} akun terdaftar`, body, active: 'penerima', counts: c })
  );
}

function halamanEditPenerima(ctx, target) {
  const c = counts();
  const jumlah = db.prepare('SELECT COUNT(*) AS n FROM letters WHERE wa = ?').get(target.wa)?.n || 0;
  const body = `
  <div class="detail-top">
    <a class="back-link" href="/admin/penerima">← Akun penerima</a>
    <div class="head-row">
      <div>
        <h2>${esc(target.nama)}</h2>
        <p class="muted">Username: <span class="mono">${esc(target.email)}</span> · terdaftar ${esc(tanggalJamID(target.created_at))}</p>
      </div>
      <div class="head-actions">
        ${target.aktif ? '<span class="badge st-selesai"><i class="dot"></i>Aktif</span>' : '<span class="badge st-tolak"><i class="dot"></i>Nonaktif</span>'}
        <span class="chip">penerima</span>
      </div>
    </div>
  </div>
  ${flash(ctx.query.ok, 'ok')}${flash(ctx.query.err, 'err')}

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><h2>Data akun penerima</h2><span class="muted-sm">ID #${target.id}</span></div>
      <form method="post" action="/admin/penerima/${target.id}" class="form-grid-1">
        ${csrfField(ctx.user)}
        <div class="fields">
          <div class="field half"><label>Nama lengkap</label><input class="input" name="nama" value="${esc(target.nama)}" required></div>
          <div class="field half"><label>Email (username login)</label><input class="input" name="email" type="email" value="${esc(target.email)}" required></div>
          <div class="field half"><label>Nomor WhatsApp</label><input class="input" name="wa" type="tel" value="${esc(target.wa || '')}" required></div>
          <div class="field half"><label>NIM <span class="opt">(opsional)</span></label><input class="input" name="nim" value="${esc(target.nim || '')}"></div>
          <div class="field half"><label>Status akun</label>
            <select class="input" name="aktif"><option value="1" ${target.aktif ? 'selected' : ''}>Aktif</option><option value="0" ${!target.aktif ? 'selected' : ''}>Nonaktif</option></select></div>
        </div>

        <div class="card-head mt"><h2>${icon('lock')} Kata sandi</h2></div>
        <div class="alert alert-ok" style="margin-bottom:14px">${icon('lock')}<div><strong>Sandi tersimpan terenkripsi</strong><p>Tidak dapat ditampilkan. Isi kolom di bawah untuk menetapkan sandi baru bagi penerima.</p></div></div>
        <div class="fields">
          <div class="field half"><label>Sandi baru</label>
            <div class="input-wrap"><input class="input" id="sandi-baru" name="password" type="password" minlength="6" placeholder="Kosongkan bila tetap"><button class="reveal" type="button" data-reveal aria-label="Tampilkan kata sandi">${icon('search')}</button></div>
            <p class="help">Minimal 6 karakter.</p></div>
          <div class="field half"><label>Ulangi sandi baru</label><input class="input" name="password2" type="password" minlength="6" placeholder="Ketik ulang"></div>
        </div>
        <div class="form-foot"><a class="btn btn-ghost" href="/admin/penerima">Batal</a><button class="btn btn-primary" type="submit">${icon('check')} Simpan perubahan</button></div>
      </form>
    </section>
    <aside class="grid-side">
      <section class="card side-card">
        <h3>Ringkasan</h3>
        <div class="mini-list">
          <div><span>Username</span><b class="mono">${esc(target.email)}</b></div>
          <div><span>WhatsApp</span><b>${esc(waCantik(target.wa) || '—')}</b></div>
          <div><span>Surat tertaut</span><b>${jumlah}</b></div>
          <div><span>Status</span><b>${target.aktif ? 'Aktif' : 'Nonaktif'}</b></div>
        </div>
      </section>
      <section class="card side-card" style="border-color:#f3c6c6">
        <h3 style="color:#b91c1c">Hapus akun penerima</h3>
        <p>Akun dihapus permanen. Surat yang tertaut tetap tersimpan.</p>
        <form method="post" action="/admin/penerima/${target.id}" onsubmit="return confirm('Hapus akun penerima ini secara permanen?')">
          ${csrfField(ctx.user)}
          <input type="hidden" name="action" value="hapus">
          <button class="btn btn-danger-ghost btn-block" type="submit">${icon('logout')} Hapus akun</button>
        </form>
      </section>
      <section class="card side-card tone">
        <h3>Buat sandi acak</h3>
        <form method="post" action="/admin/penerima">
          ${csrfField(ctx.user)}
          <input type="hidden" name="id" value="${target.id}">
          <button class="btn btn-outline btn-block" name="action" value="reset" type="submit">${icon('lock')} Buat sandi acak</button>
        </form>
      </section>
    </aside>
  </div>`;
  return html(
    ctx.res,
    adminLayout({ settings: ctx.settings, user: ctx.user, title: 'Edit Akun Penerima', subtitle: target.nama, body, active: 'penerima', counts: c })
  );
}


/* ── WhatsApp ──────────────────────────────────────────────────────────── */

function halamanWA(ctx) {
  const c = counts();
  const s = ctx.settings;
  const logs = db.prepare('SELECT * FROM wa_log ORDER BY id DESC LIMIT 30').all();
  const siap = Boolean(s.wa_provider && s.wa_token);
  const body = `
  <div class="page-intro"><div><h2>Notifikasi WhatsApp</h2><p>Status pengiriman dan konfigurasi gateway.</p></div>
    <a class="btn btn-outline btn-sm" href="/admin/pengaturan#wa">${icon('settings')} Atur gateway</a></div>
  ${flash(ctx.query.ok, 'ok')}${flash(ctx.query.err, 'err')}
  <div class="wa-status ${siap ? 'is-on' : ''}">
    <span class="wa-status-ic">${icon('whatsapp')}</span>
    <div><b>${siap ? `Gateway ${esc(s.wa_provider)} aktif` : 'Gateway otomatis belum aktif'}</b>
      <p>${siap ? 'Surat yang diterbitkan dapat langsung mengirim notifikasi ke WhatsApp penerima.' : 'Saat ini notifikasi dikirim melalui tautan wa.me (kirim manual dari perangkat petugas). Aktifkan gateway pada Pengaturan untuk pengiriman otomatis.'}</p></div>
    <div class="wa-status-stat"><strong>${c.wa}</strong><span>terkirim</span></div>
  </div>
  <div class="grid-main">
    <section class="card">
      <div class="card-head"><h2>Riwayat pengiriman</h2></div>
      ${logs.length
        ? `<div class="table-wrap"><table class="table">
          <thead><tr><th>Waktu</th><th>Tujuan</th><th>Provider</th><th>Status</th><th>Respons</th></tr></thead>
          <tbody>${logs
            .map(
              (l) => `<tr><td>${esc(tanggalJamID(l.at))}</td><td class="mono">${esc(waCantik(l.tujuan))}</td><td>${esc(l.provider || '—')}</td>
              <td>${waBadge(l.status)}</td><td class="t-clamp"><small>${esc((l.respons || '').slice(0, 120))}</small></td></tr>`
            )
            .join('')}</tbody></table></div>`
        : emptyState('Belum ada pengiriman', 'Notifikasi WhatsApp akan tercatat di sini.')}
    </section>
    <aside class="grid-side">
      <section class="card">
        <div class="card-head"><h2>Uji pengiriman</h2></div>
        <form method="post" action="/admin/wa/uji" class="form-grid-1">
          ${csrfField(ctx.user)}
          <div class="field"><label>Nomor WhatsApp tujuan</label><input class="input" name="nomor" value="${esc(s.admin_wa || '')}" placeholder="cth. 082199255839" required></div>
          <button class="btn btn-wa" type="submit">${icon('send')} Kirim pesan uji</button>
        </form>
        <p class="help">Pengujian memakai gateway yang tersimpan pada Pengaturan.</p>
      </section>
      <section class="card side-card">
        <h3>Format pesan</h3>
        <p>Pesan berisi perihal, nomor surat, tanggal, dan <strong>kode verifikasi</strong>. Tautan surat tidak dikirim melalui WhatsApp. Contoh:</p>
        <pre class="wa-preview small">PEMBERITAHUAN SURAT — JURUSAN TEKNIK ELEKTRO

Halo *Renaldi*, pengajuan surat Anda telah selesai diproses.
📄 Surat Keterangan Aktif Kuliah
🔢 No: 601/UN20.1.6.7.2/PP/2026
✅ Status: SELESAI

Kode verifikasi: *ELK-AB12CD34*

Simpan kode verifikasi tersebut. Surat hanya dapat dilihat
dan dicetak oleh penerima melalui Portal Penerima.</pre>
      </section>
    </aside>
  </div>`;
  return html(ctx.res, adminLayout({ settings: s, user: ctx.user, title: 'Notifikasi WhatsApp', subtitle: siap ? `Gateway ${s.wa_provider}` : 'Mode tautan manual', body, active: 'wa', counts: c }));
}

/* ── pengaturan ────────────────────────────────────────────────────────── */

function ttdPreview(judul, file) {
  const berkas = String(file || '').trim();
  const ada = berkas && fs.existsSync(path.join(process.cwd(), 'public', berkas));
  return `<div class="ttd-card">
    <span>${esc(judul)}</span>
    ${ada ? `<img src="/assets/${esc(berkas)}" alt="${esc(judul)}">` : '<small class="muted-sm">Belum ada berkas tanda tangan</small>'}
  </div>`;
}

function halamanPengaturan(ctx) {
  const c = counts();
  const s = ctx.settings;
  const input = (key, label, help = '', type = 'text', half = true) => `<div class="field ${half ? 'half' : 'full'}">
    <label for="set-${key}">${esc(label)}</label>
    <input class="input" id="set-${key}" name="${key}" type="${type}" value="${esc(s[key] ?? '')}">
    ${help ? `<p class="help">${esc(help)}</p>` : ''}</div>`;
  const area = (key, label, help = '') => `<div class="field full"><label for="set-${key}">${esc(label)}</label>
    <textarea class="input" id="set-${key}" name="${key}" rows="2">${esc(s[key] ?? '')}</textarea>${help ? `<p class="help">${esc(help)}</p>` : ''}</div>`;

  const body = `
  <div class="page-intro"><div><h2>Pengaturan sistem</h2><p>Identitas instansi, pejabat penandatangan, penomoran, dan gateway WhatsApp.</p></div></div>
  ${flash(ctx.query.ok, 'ok')}
  <form method="post" action="/admin/pengaturan" class="settings-form">
    ${csrfField(ctx.user)}
    <section class="card">
      <div class="card-head"><h2>${icon('location')} Identitas instansi</h2><span class="muted-sm">Muncul pada kop surat &amp; notifikasi</span></div>
      <div class="fields">
        ${input('instansi1', 'Baris kementerian', '', 'text', false)}
        ${input('instansi2', 'Universitas')}
        ${input('fakultas', 'Fakultas')}
        ${input('dept', 'Jurusan')}
        ${input('alamat', 'Alamat', '', 'text', false)}
        ${input('kota', 'Kota penerbitan')}
        ${input('telepon', 'Telepon')}
        ${input('email', 'Email')}
        ${input('website', 'Situs web')}
        ${input('jam_layanan', 'Jam layanan')}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>${icon('users')} Pejabat penandatangan</h2></div>
      <div class="fields">
        ${input('ketua_nama', 'Nama Ketua Jurusan')}
        ${input('ketua_nip', 'NIP Ketua Jurusan')}
        ${input('sekretaris_nama', 'Nama Sekretaris Jurusan')}
        ${input('sekretaris_nip', 'NIP Sekretaris Jurusan')}
        ${input('ketua_jabatan', 'Jabatan ketua', '', 'text', false)}
        ${input('sekretaris_jabatan', 'Jabatan sekretaris', '', 'text', false)}
        ${input('ttd_sekretaris', 'Berkas tanda tangan sekretaris', 'Nama file di folder public, cth. ttd-ekawati.png')}
        ${input('ttd_ketua', 'Berkas tanda tangan ketua', 'Kosongkan bila belum tersedia')}
        <div class="field half"><label class="check"><input type="checkbox" name="ttd_aktif" value="1" ${s.ttd_aktif !== '0' ? 'checked' : ''}> Cetak tanda tangan pada surat</label></div>
      </div>
      <div class="ttd-cards">
        ${ttdPreview('Tanda tangan Sekretaris', s.ttd_sekretaris)}
        ${ttdPreview('Tanda tangan Ketua', s.ttd_ketua)}
      </div>
    </section>

    <section class="card">
      <div class="card-head"><h2>${icon('file')} Penomoran surat</h2></div>
      <div class="fields">
        ${input('nomor_format', 'Format nomor', 'Placeholder: {seq} {prefix} {tahun}')}
        ${input('nomor_prefix', 'Kode unit / prefix')}
        ${input('nomor_pad', 'Jumlah digit urutan', '', 'number')}
        <div class="field half"><label>Nomor berikutnya</label><input class="input" value="${esc(nextNomor(s).nomor)}" disabled></div>
      </div>
    </section>

    <section class="card" id="wa">
      <div class="card-head"><h2>${icon('whatsapp')} Gateway WhatsApp</h2><span class="chip">${s.wa_provider && s.wa_token ? 'Aktif' : 'Mode tautan'}</span></div>
      <div class="fields">
        <div class="field half"><label for="set-wa_provider">Provider</label>
          <select class="input" id="set-wa_provider" name="wa_provider">
            <option value="">Tanpa gateway (tautan wa.me)</option>
            <option value="fonnte" ${s.wa_provider === 'fonnte' ? 'selected' : ''}>Fonnte</option>
            <option value="wablas" ${s.wa_provider === 'wablas' ? 'selected' : ''}>Wablas</option>
            <option value="custom" ${s.wa_provider === 'custom' ? 'selected' : ''}>Custom API</option>
          </select></div>
        ${input('wa_token', 'Token / API key', 'Disimpan di database. Gunakan variabel lingkungan untuk produksi.', 'password')}
        ${input('wa_sender', 'Nomor pengirim (opsional)')}
        ${input('wa_api_url', 'URL API (khusus custom)', 'Placeholder {token} dan {target}')}
        <div class="field half"><label class="check"><input type="checkbox" name="wa_auto" value="1" ${s.wa_auto === '1' ? 'checked' : ''}> Kirim otomatis saat surat diterbitkan</label></div>
      </div>
      <p class="help">Tanpa token, sistem tetap menyediakan tautan wa.me berisi pesan siap kirim.</p>
    </section>

    <section class="card">
      <div class="card-head"><h2>${icon('print')} Notifikasi &amp; loket</h2></div>
      <div class="fields">
        ${area('loket', 'Alamat loket pengambilan')}
        ${area('print_note', 'Catatan pada notifikasi')}
        ${area('syarat', 'Ketentuan pada formulir pengajuan')}
        ${input('base_url', 'URL publik aplikasi', 'cth. https://siprel-elektro.up.railway.app — dipakai pada tautan WhatsApp.', 'text', false)}
        ${input('admin_wa', 'Nomor WhatsApp petugas (uji kirim)')}
      </div>
    </section>

    <div class="settings-actions">
      <button class="btn btn-primary" type="submit">${icon('check')} Simpan pengaturan</button>
      <p class="help">Perubahan langsung berlaku untuk surat dan notifikasi berikutnya.</p>
    </div>
  </form>`;
  return html(ctx.res, adminLayout({ settings: s, user: ctx.user, title: 'Pengaturan', subtitle: 'Konfigurasi SIPREL', body, active: 'pengaturan', counts: c }));
}

/* ── log ───────────────────────────────────────────────────────────────── */

function halamanLog(ctx) {
  const c = counts();
  const logs = db.prepare('SELECT * FROM log ORDER BY id DESC LIMIT 60').all();
  const body = `
  <div class="page-intro"><div><h2>Log aktivitas</h2><p>Jejak audit pengajuan, penerbitan, dan pengiriman notifikasi.</p></div></div>
  <div class="grid-main">
    <section class="card">
      <div class="card-head"><h2>Aktivitas sistem</h2><span class="chip">${logs.length} terbaru</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead>
        <tbody>${logs
          .map(
            (l) => `<tr><td class="nowrap">${esc(tanggalJamID(l.at))}</td><td>${esc(l.aktor || '—')}</td>
            <td><span class="chip">${esc(String(l.aksi || '').replaceAll('_', ' '))}</span></td>
            <td>${esc(l.entitas || '—')}${l.entitas_id ? ` <small class="muted-sm">#${esc(l.entitas_id)}</small>` : ''}</td>
            <td class="t-clamp">${esc(l.detail || '—')}</td></tr>`
          )
          .join('')}</tbody></table></div>
    </section>
    <aside class="grid-side">
      <section class="card side-card">
        <h3>Ringkasan</h3>
        <div class="mini-list">
          <div><span>Total pengajuan</span><b>${c.total}</b></div>
          <div><span>Surat terbit</span><b>${c.selesai}</b></div>
          <div><span>Notifikasi WA terkirim</span><b>${c.wa}</b></div>
          <div><span>Akun terdaftar</span><b>${c.pengguna}</b></div>
          <div><span>Arsip digital</span><b>${c.arsip}</b></div>
        </div>
      </section>
    </aside>
  </div>`;
  return html(ctx.res, adminLayout({ settings: ctx.settings, user: ctx.user, title: 'Log Aktivitas', subtitle: 'Audit trail', body, active: 'log', counts: c }));
}

/* ── rute admin ────────────────────────────────────────────────────────── */

export const adminRoutes = [
  { method: 'GET', path: '/admin/masuk', handler: (ctx) => (['admin', 'superadmin'].includes(ctx.user?.role) ? redirect(ctx.res, '/admin') : adminLogin(ctx)) },
  {
    method: 'POST',
    path: '/admin/masuk',
    handler: async (ctx) => {
      const { fields } = await readBody(ctx.req);
      const lim = rateLimit(`admin-login:${ipDari(ctx.req)}`, 8, 10 * 60 * 1000);
      if (!lim.allowed) return adminLogin(ctx, 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
      const email = String(fields.email || '').trim().toLowerCase();
      const password = String(fields.password || '');
      const user = db.prepare("SELECT * FROM users WHERE email = ? AND role IN ('admin','superadmin')").get(email);
      if (!user || !user.aktif || !verifyPassword(password, user.password)) {
        catatLog(email, 'admin_login_gagal', 'user', email, `IP ${ipDari(ctx.req)}`);
        return html(ctx.res, adminLogin(ctx, 'Email atau kata sandi administrator tidak sesuai.'), 401);
      }
      catatLog(email, 'admin_login', 'user', user.id, `IP ${ipDari(ctx.req)}`);
      const next = String(fields.next || '');
      const tujuan = next.startsWith('/admin') ? next : '/admin';
      return redirect(ctx.res, tujuan, cookieSet(makeSession(user), ctx.secure));
    },
  },
  { method: 'GET', path: '/admin/keluar', handler: (ctx) => redirect(ctx.res, '/admin/masuk', cookieClear(ctx.secure)) },

  { method: 'GET', path: '/admin', handler: (ctx) => (adminGuard(ctx) ? dashboard(ctx) : null) },
  { method: 'GET', path: '/admin/surat', handler: (ctx) => (adminGuard(ctx) ? daftarSurat(ctx) : null) },
  {
    method: 'GET',
    path: '/admin/surat/:id',
    handler: (ctx) => {
      if (!adminGuard(ctx)) return null;
      const letter = getJson(Number(ctx.params.id));
      if (!letter) return redirect(ctx.res, '/admin/surat');
      return detailSuratAdmin(ctx, letter);
    },
  },
  {
    method: 'GET',
    path: '/admin/surat/:id/cetak',
    handler: (ctx) => {
      if (!adminGuard(ctx)) return null;
      const letter = getJson(Number(ctx.params.id));
      if (!letter) return redirect(ctx.res, '/admin/surat');
      const settings = getSettings();
      return html(
        ctx.res,
        halamanSurat({ letter, settings, baseUrl: ctx.baseUrl, kembali: `/admin/surat/${letter.id}`, mode: 'admin' })
      );
    },
  },
  {
    method: 'POST',
    path: '/admin/surat/:id',
    handler: async (ctx) => {
      if (!adminGuard(ctx)) return null;
      const letter = getJson(Number(ctx.params.id));
      if (!letter) return redirect(ctx.res, '/admin/surat');
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.user, fields)) return redirect(ctx.res, `/admin/surat/${letter.id}?err=${encodeURIComponent('Sesi kedaluwarsa. Muat ulang halaman.')}`);
      const action = String(fields.action || 'simpan');
      const nomor = String(fields.nomor || '').trim();
      const tanggal = String(fields.tanggal || '').trim();
      const penandatangan = String(fields.penandatangan || 'ketua');
      const perihal = String(fields.perihal || '').trim();
      const catatan = String(fields.catatan_admin || '').trim();
      const now = nowISO();

      if (action === 'tautkan_penerima' || action === 'tautkan_kirim') {
        const pid = Number(fields.penerima_id);
        const akun = db.prepare('SELECT * FROM penerima WHERE id = ? AND aktif = 1').get(pid);
        if (!akun) {
          return redirect(ctx.res, `/admin/surat/${letter.id}?err=${encodeURIComponent('Pilih akun penerima yang valid.')}`);
        }
        db.prepare('UPDATE letters SET penerima_id = ?, updated_at = ? WHERE id = ?').run(akun.id, now, letter.id);
        catatLog(ctx.user.email, 'tautkan_penerima', 'letter', letter.id, `${letter.tiket} → ${akun.email}`);
        if (action === 'tautkan_kirim') {
          if (letter.status !== 'selesai') {
            return redirect(ctx.res, `/admin/surat/${letter.id}?err=${encodeURIComponent('Terbitkan surat terlebih dahulu sebelum mengirim WhatsApp.')}`);
          }
          const settings = getSettings();
          const baru = getJson(letter.id);
          const hasil = await kirimWA({
            nomor: akun.wa,
            pesan: pesanWAPenerima(baru, akun, settings, ctx.baseUrl),
            settings,
            letterId: letter.id,
          });
          if (hasil.mode === 'tautan' && hasil.link) {
            return redirect(ctx.res, hasil.link);
          }
          return redirect(ctx.res, `/admin/surat/${letter.id}?${hasil.ok ? 'ok' : 'err'}=${encodeURIComponent(hasil.pesan)}`);
        }
        return redirect(ctx.res, `/admin/surat/${letter.id}?ok=${encodeURIComponent(`Surat ditautkan ke akun penerima ${akun.nama}.`)}`);
      }

      if (action === 'kirim_wa_penerima') {
        const akun = letter.penerima_id
          ? db.prepare('SELECT * FROM penerima WHERE id = ? AND aktif = 1').get(letter.penerima_id)
          : null;
        if (!akun) {
          return redirect(ctx.res, `/admin/surat/${letter.id}?err=${encodeURIComponent('Tautkan akun penerima terlebih dahulu.')}`);
        }
        if (letter.status !== 'selesai') {
          return redirect(ctx.res, `/admin/surat/${letter.id}?err=${encodeURIComponent('Terbitkan surat terlebih dahulu.')}`);
        }
        const settings = getSettings();
        const hasil = await kirimWA({
          nomor: akun.wa,
          pesan: pesanWAPenerima(letter, akun, settings, ctx.baseUrl),
          settings,
          letterId: letter.id,
        });
        if (hasil.mode === 'tautan' && hasil.link) {
          return redirect(ctx.res, hasil.link);
        }
        return redirect(ctx.res, `/admin/surat/${letter.id}?${hasil.ok ? 'ok' : 'err'}=${encodeURIComponent(hasil.pesan)}`);
      }

      if (action === 'lepas_penerima') {
        db.prepare('UPDATE letters SET penerima_id = NULL, updated_at = ? WHERE id = ?').run(now, letter.id);
        catatLog(ctx.user.email, 'lepas_penerima', 'letter', letter.id, letter.tiket);
        return redirect(ctx.res, `/admin/surat/${letter.id}?ok=${encodeURIComponent('Tautan penerima dilepas.')}`);
      }

      if (action === 'tolak') {
        db.prepare("UPDATE letters SET status = 'ditolak', catatan_admin = ?, updated_at = ? WHERE id = ?").run(catatan || 'Pengajuan ditolak oleh petugas.', now, letter.id);
        catatLog(ctx.user.email, 'tolak_surat', 'letter', letter.id, letter.tiket);
        return redirect(ctx.res, `/admin/surat/${letter.id}?ok=${encodeURIComponent('Pengajuan ditolak. Pemohon dapat melihat alasannya.')}`);
      }

      if (action === 'terbitkan') {
        const token = letter.token || buatToken();
        const kode = letter.kode || buatKode();
        db.prepare(`UPDATE letters SET nomor = ?, tanggal = ?, penandatangan = ?, perihal = ?, catatan_admin = ?,
          status = 'selesai', token = ?, kode = ?, updated_at = ? WHERE id = ?`)
          .run(nomor || letter.nomor || nextNomor(getSettings()).nomor, tanggal || todayID(), penandatangan, perihal || letter.perihal || jenisByKode(letter.jenis)?.perihal || '', catatan, token, kode, now, letter.id);
        const baru = getJson(letter.id);
        catatLog(ctx.user.email, 'terbitkan_surat', 'letter', letter.id, `${baru.nomor} · ${baru.tiket}`);
        let pesanOk = 'Surat berhasil diterbitkan. Tautan portal penerima sudah aktif.';
        const settings = getSettings();
        if (settings.wa_auto === '1' && settings.wa_provider && settings.wa_token) {
          const hasil = await kirimWA({
            nomor: baru.wa,
            pesan: pesanWA(baru, settings, ctx.baseUrl),
            settings,
            letterId: baru.id,
          });
          pesanOk = hasil.ok ? 'Surat diterbitkan dan notifikasi WhatsApp terkirim.' : `Surat diterbitkan, namun WhatsApp gagal: ${hasil.pesan}`;
        }
        return redirect(ctx.res, `/admin/surat/${letter.id}?ok=${encodeURIComponent(pesanOk)}`);
      }

      if (action === 'kirim_wa') {
        const settings = getSettings();
        if (letter.status !== 'selesai') {
          return redirect(ctx.res, `/admin/surat/${letter.id}?err=${encodeURIComponent('Terbitkan surat terlebih dahulu sebelum mengirim notifikasi.')}`);
        }
        const hasil = await kirimWA({
          nomor: letter.wa,
          pesan: pesanWA(letter, settings, ctx.baseUrl),
          settings,
          letterId: letter.id,
        });
        catatLog(ctx.user.email, 'kirim_notifikasi', 'letter', letter.id, `${letter.tiket}: ${hasil.mode}`);
        return redirect(ctx.res, `/admin/surat/${letter.id}?${hasil.ok ? 'ok' : 'err'}=${encodeURIComponent(hasil.pesan)}`);
      }

      const newStatus = action === 'verifikasi' && letter.status === 'baru' ? 'diproses' : letter.status;
      db.prepare(`UPDATE letters SET nomor = ?, tanggal = ?, penandatangan = ?, perihal = ?, catatan_admin = ?, status = ?, updated_at = ? WHERE id = ?`)
        .run(nomor || letter.nomor, tanggal || letter.tanggal, penandatangan, perihal || letter.perihal, catatan, newStatus, now, letter.id);
      catatLog(ctx.user.email, action === 'verifikasi' ? 'verifikasi_surat' : 'ubah_surat', 'letter', letter.id, letter.tiket);
      return redirect(ctx.res, `/admin/surat/${letter.id}?ok=${encodeURIComponent(action === 'verifikasi' ? 'Pengajuan ditandai telah diverifikasi.' : 'Perubahan surat disimpan.')}`);
    },
  },

  { method: 'GET', path: '/admin/jenis', handler: (ctx) => (adminGuard(ctx) ? halamanJenis(ctx) : null) },
  {
    method: 'POST',
    path: '/admin/jenis',
    handler: async (ctx) => {
      if (!adminGuard(ctx)) return null;
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.user, fields)) return redirect(ctx.res, '/admin/jenis');
      const kode = String(fields.kode || '');
      const aktif = String(fields.aktif || '1') === '1';
      const settings = getSettings();
      const list = String(settings.jenis_nonaktif || '').split(',').map((x) => x.trim()).filter(Boolean);
      const next = aktif ? list.filter((k) => k !== kode) : [...new Set([...list, kode])];
      setSetting('jenis_nonaktif', next.join(','));
      catatLog(ctx.user.email, 'ubah_jenis', 'jenis', kode, aktif ? 'diaktifkan' : 'dinonaktifkan');
      return redirect(ctx.res, `/admin/jenis?ok=${encodeURIComponent(`Layanan ${kode} ${aktif ? 'diaktifkan' : 'dinonaktifkan'}.`)}`);
    },
  },

  { method: 'GET', path: '/admin/arsip', handler: (ctx) => (adminGuard(ctx) ? halamanArsip(ctx) : null) },
  { method: 'GET', path: '/admin/pengguna', handler: (ctx) => (adminGuard(ctx, true) ? halamanPengguna(ctx) : null) },
  {
    method: 'POST',
    path: '/admin/pengguna',
    handler: async (ctx) => {
      if (!adminGuard(ctx, true)) return null;
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.user, fields)) return redirect(ctx.res, '/admin/pengguna');
      const action = String(fields.action || '');
      if (action === 'tambah') {
        const nama = String(fields.nama || '').trim();
        const email = String(fields.email || '').trim().toLowerCase();
        const password = String(fields.password || '');
        let role = String(fields.role || 'mahasiswa');
        if (!['mahasiswa', 'admin', 'superadmin'].includes(role)) role = 'mahasiswa';
        if (!nama || !email || password.length < 6) return redirect(ctx.res, `/admin/pengguna?err=${encodeURIComponent('Lengkapi nama, email, dan kata sandi minimal 6 karakter.')}`);
        if (db.prepare('SELECT 1 AS x FROM users WHERE email = ?').get(email)) return redirect(ctx.res, `/admin/pengguna?err=${encodeURIComponent('Email sudah terdaftar.')}`);
        if (jumlahAkun() >= BATAS_AKUN) {
          return redirect(ctx.res, `/admin/pengguna?err=${encodeURIComponent(`Kapasitas akun penuh (${BATAS_AKUN} akun).`)}`);
        }
        db.prepare('INSERT INTO users (nama, email, password, role, aktif, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(nama, email, hashPassword(password), role, nowISO());
        catatLog(ctx.user.email, 'tambah_pengguna', 'user', email, role);
        return redirect(ctx.res, `/admin/pengguna?ok=${encodeURIComponent(`Pengguna ${nama} ditambahkan dengan sandi awal: ${password}`)}`);
      }
      const id = Number(fields.id);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!target) return redirect(ctx.res, `/admin/pengguna?err=${encodeURIComponent('Pengguna tidak ditemukan.')}`);
      if (target.id === ctx.user.id && action === 'toggle') return redirect(ctx.res, `/admin/pengguna?err=${encodeURIComponent('Anda tidak dapat menonaktifkan akun sendiri.')}`);
      if (action === 'toggle') {
        db.prepare('UPDATE users SET aktif = ? WHERE id = ?').run(target.aktif ? 0 : 1, id);
        catatLog(ctx.user.email, 'ubah_status_pengguna', 'user', id, target.aktif ? 'nonaktif' : 'aktif');
        return redirect(ctx.res, `/admin/pengguna?ok=${encodeURIComponent('Status pengguna diperbarui.')}`);
      }
      if (action === 'reset') {
        const sandi = `Siprel-${randomCode(6)}`;
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(sandi), id);
        catatLog(ctx.user.email, 'reset_sandi', 'user', id, '');
        return redirect(ctx.res, `/admin/pengguna?ok=${encodeURIComponent(`Kata sandi baru untuk ${target.nama}: ${sandi} (catat sekarang)`)}`);
      }
      return redirect(ctx.res, '/admin/pengguna');
    },
  },


  {
    method: 'GET',
    path: '/admin/pengguna/:id',
    handler: (ctx) => {
      if (!adminGuard(ctx, true)) return null;
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(ctx.params.id));
      if (!target) return redirect(ctx.res, '/admin/pengguna');
      return halamanEditPengguna(ctx, target);
    },
  },
  {
    method: 'POST',
    path: '/admin/pengguna/:id',
    handler: async (ctx) => {
      if (!adminGuard(ctx, true)) return null;
      const id = Number(ctx.params.id);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!target) return redirect(ctx.res, '/admin/pengguna');
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.user, fields)) {
        return redirect(ctx.res, `/admin/pengguna/${id}?err=${encodeURIComponent('Sesi kedaluwarsa. Muat ulang halaman.')}`);
      }

      if (String(fields.action || '') === 'hapus') {
        if (id === ctx.user.id) {
          return redirect(ctx.res, `/admin/pengguna/${id}?err=${encodeURIComponent('Anda tidak dapat menghapus akun sendiri.')}`);
        }
        const jumlahSuper = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'").get().n;
        if (target.role === 'superadmin' && jumlahSuper <= 1) {
          return redirect(ctx.res, `/admin/pengguna/${id}?err=${encodeURIComponent('Admin Utama terakhir tidak boleh dihapus.')}`);
        }
        db.prepare('UPDATE letters SET pemohon_id = NULL WHERE pemohon_id = ?').run(id);
        db.prepare('DELETE FROM users WHERE id = ?').run(id);
        catatLog(ctx.user.email, 'hapus_pengguna', 'user', id, target.email);
        return redirect(ctx.res, `/admin/pengguna?ok=${encodeURIComponent(`Akun ${target.email} dihapus.`)}`);
      }

      const nama = String(fields.nama || '').trim();
      const email = String(fields.email || '').trim().toLowerCase();
      const nim = String(fields.nim || '').replace(/\D/g, '');
      const wa = normalisasiWA(fields.wa);
      const password = String(fields.password || '');
      const password2 = String(fields.password2 || '');
      const diriSendiri = target.id === ctx.user.id;
      let role = diriSendiri ? target.role : String(fields.role || 'mahasiswa');
      if (!['mahasiswa', 'admin', 'superadmin'].includes(role)) role = 'mahasiswa';
      const aktif = diriSendiri ? 1 : (String(fields.aktif ?? '1') === '1' ? 1 : 0);

      const kembali = `/admin/pengguna/${id}`;
      if (!nama) return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Nama tidak boleh kosong.')}`);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Format email/username tidak valid.')}`);
      }
      if (db.prepare('SELECT 1 AS x FROM users WHERE email = ? AND id <> ?').get(email, id)) {
        return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Email tersebut sudah dipakai akun lain.')}`);
      }
      if (password) {
        if (password.length < 6) return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Sandi baru minimal 6 karakter.')}`);
        if (password !== password2) return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Ulangi sandi baru dengan tepat.')}`);
      }

      db.prepare('UPDATE users SET nama = ?, email = ?, nim = ?, wa = ?, role = ?, aktif = ? WHERE id = ?')
        .run(nama, email, nim, wa, role, aktif, id);
      if (password) {
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(password), id);
      }
      catatLog(ctx.user.email, 'edit_pengguna', 'user', id, password ? 'data + sandi diperbarui' : 'data diperbarui');
      const pesan = password ? 'Perubahan disimpan dan kata sandi baru telah ditetapkan.' : 'Perubahan data pengguna disimpan.';
      return redirect(ctx.res, `${kembali}?ok=${encodeURIComponent(pesan)}`);
    },
  },


  { method: 'GET', path: '/admin/penerima', handler: (ctx) => (adminGuard(ctx, true) ? halamanAkunPenerima(ctx) : null) },
  {
    method: 'POST',
    path: '/admin/penerima',
    handler: async (ctx) => {
      if (!adminGuard(ctx, true)) return null;
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.user, fields)) return redirect(ctx.res, '/admin/penerima');
      const action = String(fields.action || 'tambah');

      if (action === 'tambah') {
        const nama = String(fields.nama || '').trim();
        const email = String(fields.email || '').trim().toLowerCase();
        const wa = normalisasiWA(fields.wa);
        const nim = String(fields.nim || '').replace(/\D/g, '');
        const password = String(fields.password || '').trim() || randomCode(10);
        if (!nama || !email || !wa) {
          return redirect(ctx.res, `/admin/penerima?err=${encodeURIComponent('Nama, email, dan WhatsApp wajib diisi.')}`);
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          return redirect(ctx.res, `/admin/penerima?err=${encodeURIComponent('Format email tidak valid.')}`);
        }
        if (jumlahAkun() >= BATAS_AKUN) {
          return redirect(ctx.res, `/admin/penerima?err=${encodeURIComponent(`Kapasitas akun penuh (${BATAS_AKUN} akun).`)}`);
        }
        if (db.prepare('SELECT 1 AS x FROM penerima WHERE email = ?').get(email)) {
          return redirect(ctx.res, `/admin/penerima?err=${encodeURIComponent('Email sudah dipakai akun penerima lain.')}`);
        }
        if (password.length < 6) {
          return redirect(ctx.res, `/admin/penerima?err=${encodeURIComponent('Kata sandi minimal 6 karakter.')}`);
        }
        db.prepare('INSERT INTO penerima (nama, email, nim, wa, password, aktif, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
          .run(nama, email, nim, wa, hashPassword(password), nowISO());
        catatLog(ctx.user.email, 'tambah_penerima', 'penerima', email, 'Akun portal penerima dibuat.');
        return redirect(ctx.res, `/admin/penerima?ok=${encodeURIComponent(`Akun penerima ${nama} dibuat. Sandi awal: ${password}`)}`);
      }

      const id = Number(fields.id);
      const target = db.prepare('SELECT * FROM penerima WHERE id = ?').get(id);
      if (!target) return redirect(ctx.res, `/admin/penerima?err=${encodeURIComponent('Akun penerima tidak ditemukan.')}`);
      if (action === 'toggle') {
        db.prepare('UPDATE penerima SET aktif = ? WHERE id = ?').run(target.aktif ? 0 : 1, id);
        catatLog(ctx.user.email, 'ubah_status_penerima', 'penerima', id, target.aktif ? 'nonaktif' : 'aktif');
        return redirect(ctx.res, `/admin/penerima?ok=${encodeURIComponent('Status akun penerima diperbarui.')}`);
      }
      if (action === 'reset') {
        const sandi = `Penerima-${randomCode(6)}`;
        db.prepare('UPDATE penerima SET password = ? WHERE id = ?').run(hashPassword(sandi), id);
        catatLog(ctx.user.email, 'reset_sandi_penerima', 'penerima', id, '');
        return redirect(ctx.res, `/admin/penerima?ok=${encodeURIComponent(`Sandi baru untuk ${target.nama}: ${sandi} (catat sekarang)`)}`);
      }
      return redirect(ctx.res, '/admin/penerima');
    },
  },
  {
    method: 'GET',
    path: '/admin/penerima/:id',
    handler: (ctx) => {
      if (!adminGuard(ctx, true)) return null;
      const target = db.prepare('SELECT * FROM penerima WHERE id = ?').get(Number(ctx.params.id));
      if (!target) return redirect(ctx.res, '/admin/penerima');
      return halamanEditPenerima(ctx, target);
    },
  },
  {
    method: 'POST',
    path: '/admin/penerima/:id',
    handler: async (ctx) => {
      if (!adminGuard(ctx, true)) return null;
      const id = Number(ctx.params.id);
      const target = db.prepare('SELECT * FROM penerima WHERE id = ?').get(id);
      if (!target) return redirect(ctx.res, '/admin/penerima');
      const { fields } = await readBody(ctx.req);
      const kembali = `/admin/penerima/${id}`;
      if (!csrfValid(ctx.req, ctx.user, fields)) return redirect(ctx.res, `/admin/penerima/${id}`);
      if (String(fields.action || '') === 'hapus') {
        db.prepare('DELETE FROM penerima WHERE id = ?').run(id);
        catatLog(ctx.user.email, 'hapus_penerima', 'penerima', id, target.email);
        return redirect(ctx.res, `/admin/penerima?ok=${encodeURIComponent(`Akun penerima ${target.email} dihapus.`)}`);
      }
      const nama = String(fields.nama || '').trim();
      const email = String(fields.email || '').trim().toLowerCase();
      const wa = normalisasiWA(fields.wa);
      const nim = String(fields.nim || '').replace(/\D/g, '');
      const aktif = String(fields.aktif ?? '1') === '1' ? 1 : 0;
      const password = String(fields.password || '');
      const password2 = String(fields.password2 || '');
      if (!nama || !wa) return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Nama dan WhatsApp wajib diisi.')}`);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Format email tidak valid.')}`);
      if (db.prepare('SELECT 1 AS x FROM penerima WHERE email = ? AND id <> ?').get(email, id)) {
        return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Email sudah dipakai akun penerima lain.')}`);
      }
      if (password) {
        if (password.length < 6) return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Sandi baru minimal 6 karakter.')}`);
        if (password !== password2) return redirect(ctx.res, `${kembali}?err=${encodeURIComponent('Ulangi sandi baru dengan tepat.')}`);
      }
      db.prepare('UPDATE penerima SET nama = ?, email = ?, wa = ?, nim = ?, aktif = ? WHERE id = ?')
        .run(nama, email, wa, nim, aktif, id);
      if (password) db.prepare('UPDATE penerima SET password = ? WHERE id = ?').run(hashPassword(password), id);
      catatLog(ctx.user.email, 'edit_penerima', 'penerima', id, password ? 'data + sandi diperbarui' : 'data diperbarui');
      return redirect(ctx.res, `${kembali}?ok=${encodeURIComponent(password ? 'Perubahan disimpan dan sandi baru ditetapkan.' : 'Perubahan akun penerima disimpan.')}`);
    },
  },

  { method: 'GET', path: '/admin/wa', handler: (ctx) => (adminGuard(ctx) ? halamanWA(ctx) : null) },
  {
    method: 'POST',
    path: '/admin/wa/uji',
    handler: async (ctx) => {
      if (!adminGuard(ctx)) return null;
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.user, fields)) return redirect(ctx.res, '/admin/wa');
      const nomor = normalisasiWA(fields.nomor);
      if (!nomor) return redirect(ctx.res, `/admin/wa?err=${encodeURIComponent('Nomor WhatsApp tidak valid.')}`);
      const settings = getSettings();
      const pesan = `*Uji koneksi SIPREL* ✅\n\nGateway WhatsApp ${settings.wa_provider || 'tautan'} berhasil terhubung ke SIPREL ${settings.dept}.\nWaktu: ${tanggalJamID(nowISO())}`;
      const hasil = await kirimWA({ nomor, pesan, settings, letterId: null });
      return redirect(ctx.res, `/admin/wa?${hasil.ok ? 'ok' : 'err'}=${encodeURIComponent(hasil.pesan)}`);
    },
  },

  { method: 'GET', path: '/admin/pengaturan', handler: (ctx) => (adminGuard(ctx, true) ? halamanPengaturan(ctx) : null) },
  {
    method: 'POST',
    path: '/admin/pengaturan',
    handler: async (ctx) => {
      if (!adminGuard(ctx, true)) return null;
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.user, fields)) return redirect(ctx.res, '/admin/pengaturan');
      const keys = [
        'instansi1', 'instansi2', 'fakultas', 'dept', 'alamat', 'kota', 'telepon', 'email', 'website', 'jam_layanan',
        'ketua_nama', 'ketua_nip', 'ketua_jabatan', 'sekretaris_nama', 'sekretaris_nip', 'sekretaris_jabatan',
        'ttd_sekretaris', 'ttd_ketua',
        'nomor_format', 'nomor_prefix', 'nomor_pad', 'wa_provider', 'wa_token', 'wa_sender', 'wa_api_url',
        'loket', 'print_note', 'syarat', 'base_url', 'admin_wa',
      ];
      for (const k of keys) {
        if (fields[k] === undefined) continue;
        setSetting(k, String(fields[k]).trim());
      }
      setSetting('wa_auto', fields.wa_auto === '1' ? '1' : '0');
      setSetting('ttd_aktif', fields.ttd_aktif === '1' ? '1' : '0');
      catatLog(ctx.user.email, 'ubah_pengaturan', 'settings', '', Object.keys(fields).filter((k) => k !== '_csrf').join(','));
      return redirect(ctx.res, `/admin/pengaturan?ok=${encodeURIComponent('Pengaturan berhasil disimpan.')}`);
    },
  },

  { method: 'GET', path: '/admin/log', handler: (ctx) => (adminGuard(ctx, true) ? halamanLog(ctx) : null) },
];
