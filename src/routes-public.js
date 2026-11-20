import { db, BATAS_AKUN, jumlahAkun, buatTiket, catatLog } from './db.js';
import { JENIS, jenisAktif, jenisByKode, validasiData, ringkasSurat, pesanWA, pca } from './letters.js';
import { publicLayout, authLayout, recipientLayout, statusBadge, statusLabel, icon, flash, emptyState, avatar } from './ui.js';
import { esc, todayID, tanggalID, tanggalJamID, normalisasiWA, waCantik, hashPassword, verifyPassword, nowISO } from './util.js';
import { html, redirect, json, readBody, csrfField, csrfValid } from './http.js';
import { cookieSet, cookieClear, makeSession, currentUser, rateLimit, ipDari } from './auth.js';
import { lembarSurat, halamanSurat, lembarNotifikasi, dataSurat } from './surat.js';
import { kirimWA, waLink } from './wa.js';

/* ── util internal ─────────────────────────────────────────────────────── */

const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function getJson(id) {
  const row = db.prepare('SELECT * FROM letters WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, data: dataSurat(row) };
}

function statistikPublik() {
  const totalArsip = db.prepare('SELECT COUNT(*) AS n FROM arsip').get().n;
  const selesai = db.prepare("SELECT COUNT(*) AS n FROM letters WHERE status = 'selesai'").get().n;
  const diproses = db.prepare("SELECT COUNT(*) AS n FROM letters WHERE status IN ('baru','diproses')").get().n;
  const perJenis = {};
  for (const r of db.prepare('SELECT jenis, COUNT(*) AS n FROM letters GROUP BY jenis').all()) perJenis[r.jenis] = (perJenis[r.jenis] || 0) + r.n;
  for (const r of db.prepare('SELECT jenis, COUNT(*) AS n FROM arsip GROUP BY jenis').all()) perJenis[r.jenis] = (perJenis[r.jenis] || 0) + r.n;
  const rows = db.prepare("SELECT created_at, updated_at FROM letters WHERE status = 'selesai'").all();
  let hari = 0;
  let n = 0;
  for (const r of rows) {
    const a = Date.parse(r.created_at);
    const b = Date.parse(r.updated_at);
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      hari += (b - a) / 86400000;
      n += 1;
    }
  }
  return {
    total: totalArsip + selesai,
    arsip: totalArsip,
    selesai,
    diproses,
    perJenis,
    rataHari: n ? Math.max(1, Math.round(hari / n)) : 1,
  };
}

function kartuJenis(jenis, jumlah, cta = 'Ajukan') {
  return `<a class="type-card type-${esc(jenis.warna)}" href="/saya/ajukan?jenis=${esc(jenis.kode)}">
    <div class="type-ic">${icon(jenis.ikon)}</div>
    <div class="type-body">
      <div class="type-top"><h3>${esc(jenis.nama)}</h3><span class="type-cat">${esc(jenis.kategori)}</span></div>
      <p>${esc(jenis.singkat)}</p>
      <div class="type-foot"><span>${jumlah ? `${jumlah} surat tercatat` : 'Layanan tersedia'}</span><span class="type-go">${cta} ${icon('chevron')}</span></div>
    </div>
  </a>`;
}

function timelineSurat(letter) {
  const steps = [
    { key: 'diajukan', label: 'Pengajuan diterima', at: letter.created_at, ket: `Tiket ${letter.tiket}` },
    { key: 'verifikasi', label: 'Verifikasi petugas', at: letter.status !== 'baru' ? letter.updated_at : null, ket: letter.status === 'baru' ? 'Menunggu pemeriksaan berkas' : 'Berkas telah diperiksa' },
    { key: 'terbit', label: 'Surat terbit', at: letter.status === 'selesai' ? letter.updated_at : null, ket: letter.nomor ? `Nomor ${letter.nomor}` : 'Nomor surat belum ditetapkan' },
    { key: 'diambil', label: 'Notifikasi & pengambilan', at: letter.dicetak_at || null, ket: letter.dicetak_at ? 'Notifikasi telah dicetak' : 'Cetak notifikasi melalui portal penerima' },
  ];
  return `<ol class="timeline">
    ${steps
      .map((s, i) => {
        const done = Boolean(s.at) || (i === 0);
        const aktif = !s.at && (i === 0 || steps[i - 1]?.at);
        return `<li class="tl-item ${done ? 'is-done' : ''} ${aktif && !done ? 'is-now' : ''}">
          <span class="tl-dot">${done ? icon('check') : i + 1}</span>
          <div class="tl-body"><strong>${s.label}</strong><small>${esc(s.ket)}</small></div>
          <span class="tl-time">${s.at ? tanggalJamID(s.at) : '—'}</span>
        </li>`;
      })
      .join('')}
  </ol>`;
}

function fieldInput(f, value, idPrefix = '') {
  const id = `${idPrefix}${f.name}`;
  const val = value ?? f.default ?? '';
  const common = `id="${id}" name="${f.name}" ${f.required ? 'required' : ''}`;
  if (f.type === 'textarea') {
    return `<textarea class="input" ${common} rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(val)}</textarea>`;
  }
  if (f.type === 'select') {
    return `<select class="input" ${common}>
      ${(f.options || [])
        .map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
        })
        .join('')}
    </select>`;
  }
  return `<input class="input" ${common} type="${f.type === 'number' ? 'number' : f.type === 'tel' ? 'tel' : 'text'}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}">`;
}

function formSurat({ jenis, values = {}, errors = [], user, settings, editId = null }) {
  return `<div class="form-grid">
    <form class="card form-card" method="post" action="${editId ? `/saya/surat/${editId}/ubah` : '/saya/ajukan'}" novalidate>
      ${csrfField(user)}
      <input type="hidden" name="jenis" value="${esc(jenis.kode)}">
      <div class="form-head">
        <div class="type-ic type-${esc(jenis.warna)}">${icon(jenis.ikon)}</div>
        <div>
          <h2>${esc(jenis.nama)}</h2>
          <p>${esc(jenis.singkat)}</p>
        </div>
      </div>
      ${errors.length ? `<div class="alert alert-err"><strong>Periksa kembali isian Anda</strong><ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
      <div class="fields">
        ${jenis.fields
          .map(
            (f) => `<div class="field ${f.half ? 'half' : 'full'}">
              <label for="${f.name}">${esc(f.label)}${f.required ? ' <em>*</em>' : ''}</label>
              ${fieldInput(f, values[f.name])}
              ${f.help ? `<p class="help">${esc(f.help)}</p>` : ''}
            </div>`
          )
          .join('')}
        <div class="field full">
          <label for="wa">Nomor WhatsApp aktif <em>*</em></label>
          <input class="input" id="wa" name="wa" type="tel" required value="${esc(values.wa || user.wa || '')}" placeholder="cth. 082199255839">
          <p class="help">Notifikasi dan tautan cetak notifikasi akan dikirim ke nomor ini.</p>
        </div>
        <div class="field full">
          <label for="catatan_pemohon">Catatan tambahan <span class="opt">(opsional)</span></label>
          <textarea class="input" id="catatan_pemohon" name="catatan_pemohon" rows="2" placeholder="cth. surat dibutuhkan sebelum 20 November">${esc(values.catatan_pemohon || '')}</textarea>
        </div>
      </div>
      <div class="form-foot">
        <p class="form-consent">${icon('shield')} Data hanya digunakan untuk penerbitan surat jurusan.</p>
        <button class="btn btn-primary" type="submit">${icon('send')} Kirim pengajuan</button>
      </div>
    </form>
    <aside class="form-side">
      <div class="card side-card">
        <h3>Persyaratan &amp; ketentuan</h3>
        <p>${esc(settings.syarat)}</p>
        <ul class="check-list">
          <li>${icon('check')} Data mahasiswa sesuai SIAKAD</li>
          <li>${icon('check')} Nomor WhatsApp aktif</li>
          <li>${icon('check')} Proses 1–2 hari kerja</li>
        </ul>
      </div>
      <div class="card side-card tone">
        <h3>Butuh bantuan?</h3>
        <p>Hubungi admin jurusan pada jam layanan.</p>
        <p class="side-contact">${icon('clock')} ${esc(settings.jam_layanan)}</p>
        <p class="side-contact">${icon('mail')} ${esc(settings.email)}</p>
        <p class="side-contact">${icon('phone')} ${esc(settings.telepon)}</p>
      </div>
    </aside>
  </div>`;
}

function suratSayaTable(rows) {
  if (!rows.length) {
    return emptyState('Belum ada pengajuan', 'Ajukan surat pertama Anda — prosesnya hanya beberapa menit.', '<a class="btn btn-primary" href="/saya/ajukan">Ajukan surat</a>');
  }
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>Pengajuan</th><th>Jenis surat</th><th>Nomor</th><th>Status</th><th class="t-right">Aksi</th></tr></thead>
    <tbody>${rows
      .map(
        (l) => `<tr>
        <td><a class="t-strong" href="/saya/surat/${l.id}">${esc(l.tiket)}</a><small class="t-sub">${esc(tanggalID((l.created_at || '').slice(0, 10)))}</small></td>
        <td>${esc(JENIS[l.jenis]?.nama || l.jenis)}<small class="t-sub">${esc(ringkasSurat(l))}</small></td>
        <td class="mono">${esc(l.nomor || '—')}</td>
        <td>${statusBadge(l.status)}</td>
        <td class="t-right">
          <a class="btn btn-sm btn-ghost" href="/saya/surat/${l.id}">Detail</a>
        </td>
      </tr>`
      )
      .join('')}</tbody>
  </table></div>`;
}

/* ── halaman ───────────────────────────────────────────────────────────── */

function beranda(ctx) {
  const s = ctx.settings;
  const st = statistikPublik();
  const daftar = jenisAktif(s);
  const unggulan = ['AKTIF', 'KP', 'DATA_MHS', 'UKT_POTONG', 'KKN', 'PINDAH']
    .map((k) => JENIS[k])
    .filter((j) => daftar.some((x) => x.kode === j.kode));
  const body = `
  <section class="hero">
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <span class="eyebrow"><i class="pulse"></i> Layanan persuratan digital · ${esc(s.fakultas)}</span>
        <h1>Urus surat jurusan<br><span class="grad">tanpa antre.</span></h1>
        <p class="lede">Ajukan surat keterangan aktif kuliah, pengantar kerja praktek, pengambilan data, hingga pemotongan UKT dari mana saja. Pantau prosesnya dan terima notifikasi WhatsApp begitu surat terbit.</p>
        <div class="hero-cta">
          <a class="btn btn-primary btn-lg" href="${ctx.user ? '/saya/ajukan' : '/daftar'}">${icon('send')} Ajukan surat sekarang</a>
          <a class="btn btn-outline btn-lg" href="/lacak">${icon('search')} Lacak pengajuan</a>
        </div>
        <ul class="hero-points">
          <li>${icon('check')} 10 jenis surat jurusan</li>
          <li>${icon('check')} Notifikasi WhatsApp</li>
          <li>${icon('check')} Cetak notifikasi mandiri</li>
        </ul>
        <div class="hero-metrics">
          <div><strong>${st.total.toLocaleString('id-ID')}</strong><span>surat tercatat</span></div>
          <div><strong>${daftar.length}</strong><span>jenis layanan</span></div>
          <div><strong>${st.rataHari} hari</strong><span>rata-rata proses</span></div>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="art-letter">
          <div class="art-kop">
            <img src="/assets/logo-uncen.png" alt="">
            <div><b>UNIVERSITAS CENDERAWASIH</b><span>Fakultas Teknik · Jurusan Teknik Elektro</span></div>
          </div>
          <div class="art-rule"></div>
          <div class="art-meta"><span>Nomor: 601/UN20.1.6.7.2/PP/2026</span><span>18 November 2026</span></div>
          <div class="art-lines">
            <i style="width:34%"></i><i style="width:88%"></i><i style="width:96%"></i><i style="width:72%"></i>
            <i style="width:90%"></i><i style="width:64%"></i>
          </div>
          <div class="art-sign"><span></span><b>Ir. Suparno, S.T., M.Eng</b><small>NIP. 19699909 200112 1 001</small></div>
          <div class="art-stamp">${icon('check')} SIAP DIAMBIL</div>
        </div>
        <div class="art-wa">
          <span class="art-wa-ic">${icon('whatsapp')}</span>
          <div><b>Notifikasi WhatsApp terkirim</b><small>Halo Renaldi, surat Anda telah terbit.</small></div>
        </div>
        <div class="art-chip art-chip-1">${icon('shield')} Kode terverifikasi</div>
        <div class="art-chip art-chip-2">${icon('clock')} Proses 1–2 hari</div>
      </div>
    </div>
  </section>

  <section class="section section-tight">
    <div class="wrap">
      <div class="sec-head">
        <div><p class="eyebrow">Layanan</p><h2>Surat yang bisa Anda ajukan</h2></div>
        <a class="link-arrow" href="/layanan">Lihat semua layanan ${icon('chevron')}</a>
      </div>
      <div class="type-grid">
        ${unggulan.map((j) => kartuJenis(j, st.perJenis[j.kode] || 0)).join('')}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="sec-head center">
        <p class="eyebrow">Alur layanan</p>
        <h2>Empat langkah, surat siap diambil</h2>
        <p class="sec-sub">Seluruh proses tercatat dan dapat dilacak menggunakan nomor tiket pengajuan.</p>
      </div>
      <div class="steps">
        ${[
          ['01', 'Ajukan daring', 'Isi formulir sesuai jenis surat, lampirkan data mahasiswa, dan tentukan nomor WhatsApp aktif.'],
          ['02', 'Verifikasi petugas', 'Petugas jurusan memeriksa kelengkapan data. Anda dapat memantau status melalui halaman lacak.'],
          ['03', 'Surat diterbitkan', 'Surat resmi diberi nomor, tanggal, dan penandatangan berwenang beserta kode verifikasi unik.'],
          ['04', 'Cetak &amp; terima', 'Notifikasi dikirim ke WhatsApp. Cetak notifikasi dari mana saja atau ambil surat di loket jurusan.'],
        ]
          .map(
            ([no, judul, teks]) => `<div class="step">
              <span class="step-no">${no}</span>
              <h3>${judul}</h3>
              <p>${teks}</p>
            </div>`
          )
          .join('')}
      </div>
    </div>
  </section>

  <section class="section portal-band">
    <div class="wrap portal-grid">
      <div class="portal-copy">
        <p class="eyebrow light">Portal penerima</p>
        <h2>Satu tautan untuk penerima surat.<br>Cetak notifikasi, langsung.</h2>
        <p>Setiap surat yang terbit memiliki portal penerima tersendiri. Penerima dapat melihat ringkasan surat, mencetak notifikasi resmi tanpa aplikasi tambahan, dan menerima kode verifikasi melalui WhatsApp.</p>
        <ul class="portal-list">
          <li>${icon('print')} <div><b>Cetak notifikasi sekali klik</b><span>Format A5 rapi, siap dicetak atau disimpan sebagai PDF.</span></div></li>
          <li>${icon('whatsapp')} <div><b>Notifikasi WhatsApp</b><span>Kirim otomatis melalui gateway, atau melalui tautan wa.me.</span></div></li>
          <li>${icon('shield')} <div><b>Verifikasi keaslian</b><span>Setiap dokumen memiliki kode unik yang dapat diperiksa publik.</span></div></li>
        </ul>
        <a class="btn btn-light" href="/terima/demo-penerima-elektro">Lihat contoh portal penerima ${icon('chevron')}</a>
      </div>
      <div class="portal-art">
        <div class="notif-mini">
          <div class="nm-head"><img src="/assets/logo-uncen.png" alt=""><span>UNIVERSITAS CENDERAWASIH</span></div>
          <div class="nm-title">Notifikasi Penerimaan Surat</div>
          <div class="nm-row"><i></i><span></span></div>
          <div class="nm-row"><i></i><span></span></div>
          <div class="nm-row"><i></i><span></span></div>
          <div class="nm-row"><i></i><span></span></div>
          <div class="nm-code">ELK-DEMO2026</div>
        </div>
        <div class="nm-badge">${icon('print')} Siap dicetak</div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap faq-grid">
      <div class="faq-copy">
        <p class="eyebrow">Pertanyaan umum</p>
        <h2>Hal yang sering ditanyakan</h2>
        <p class="sec-sub">Belum menemukan jawaban? Hubungi admin jurusan melalui kontak di halaman ini.</p>
        <a class="btn btn-outline" href="/lacak">Cek status pengajuan</a>
      </div>
      <div class="faq-list">
        ${[
          ['Berapa lama surat saya diproses?', 'Rata-rata 1–2 hari kerja setelah data dinyatakan lengkap. Anda akan menerima notifikasi WhatsApp begitu surat terbit.'],
          ['Apakah saya harus datang ke jurusan?', 'Tidak. Notifikasi dan surat dapat dicetak sendiri dari portal penerima. Pengambilan fisik hanya diperlukan bila instansi tujuan meminta dokumen bertanda tangan basah.'],
          ['Bagaimana cara melacak pengajuan?', 'Gunakan nomor tiket (contoh ELK-2026-0001) pada menu Lacak Surat. Simpan nomor tersebut setelah mengajukan.'],
          ['Apakah surat bisa diverifikasi keasliannya?', 'Ya. Setiap surat memiliki kode verifikasi, misalnya ELK-AB12CD34, yang dapat diperiksa pada menu Verifikasi.'],
        ]
          .map(
            ([q, a], i) => `<details class="faq" ${i === 0 ? 'open' : ''}>
              <summary>${esc(q)}<span class="faq-ic">${icon('chevron')}</span></summary>
              <p>${esc(a)}</p>
            </details>`
          )
          .join('')}
      </div>
    </div>
  </section>

  <section class="cta-band">
    <div class="wrap cta-in">
      <div>
        <h2>Mulai ajukan surat Anda hari ini.</h2>
        <p>Gratis, tanpa antre, dan dapat dipantau kapan saja.</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn-light" href="${ctx.user ? '/saya/ajukan' : '/daftar'}">Buat akun mahasiswa</a>
        <a class="btn btn-ghost-light" href="/layanan">Jelajahi layanan</a>
      </div>
    </div>
  </section>`;

  return html(ctx.res, publicLayout({ settings: s, user: ctx.user, title: 'Beranda', body, active: 'beranda' }));
}

function layanan(ctx) {
  const s = ctx.settings;
  const st = statistikPublik();
  const body = `<section class="page-head">
    <div class="wrap">
      <p class="eyebrow">Layanan surat</p>
      <h1>${jenisAktif(s).length} layanan persuratan jurusan</h1>
      <p class="lede narrow">Pilih jenis surat yang Anda butuhkan. Setiap layanan memiliki formulir khusus agar data yang diterima petugas langsung lengkap.</p>
    </div>
  </section>
  <section class="section section-tight">
    <div class="wrap">
      <div class="type-grid">
        ${jenisAktif(s).map((j) => kartuJenis(j, st.perJenis[j.kode] || 0)).join('')}
      </div>
      <div class="info-band">
        ${icon('info')}
        <p>Belum yakin jenis surat yang tepat? Hubungi admin jurusan di <strong>${esc(s.email)}</strong> atau datang ke ${esc(s.loket)}.</p>
      </div>
    </div>
  </section>`;
  return html(ctx.res, publicLayout({ settings: s, user: ctx.user, title: 'Layanan Surat', body, active: 'layanan' }));
}

/* ── autentikasi ───────────────────────────────────────────────────────── */

function halamanMasuk(ctx, pesan = '', tipe = 'err') {
  const body = `
    <h1>Masuk ke akun</h1>
    <p class="auth-sub">Gunakan email kampus atau email yang Anda daftarkan.</p>
    ${flash(pesan, tipe)}
    <form method="post" action="/masuk" class="auth-form">
      <div class="field full"><label for="email">Email</label>
        <input class="input" id="email" name="email" type="email" required autocomplete="username" placeholder="nama@student.uncen.ac.id" value="${esc(ctx.query.email || '')}"></div>
      <div class="field full"><label for="password">Kata sandi</label>
        <div class="input-wrap"><input class="input" id="password" name="password" type="password" required autocomplete="current-password" placeholder="••••••••">
        <button type="button" class="reveal" data-reveal aria-label="Tampilkan kata sandi">${icon('search')}</button></div></div>
      <button class="btn btn-primary btn-block" type="submit">Masuk</button>
    </form>
    <p class="auth-alt">Belum punya akun? <a href="/daftar">Daftar sebagai mahasiswa</a></p>
    <p class="auth-alt"><a href="/penerima/masuk">Masuk sebagai penerima surat →</a></p>
    <p class="auth-alt"><a href="/admin/masuk">Masuk sebagai administrator →</a></p>`;
  return html(
    ctx.res,
    authLayout({ settings: ctx.settings, title: 'Masuk', body, side: { judul: 'Selamat datang kembali.', teks: 'Lanjutkan pengajuan surat dan pantau statusnya. Kode verifikasi akan dikirim melalui WhatsApp.' } })
  );
}

function halamanDaftar(ctx, values = {}, pesan = '', tipe = 'err') {
  const body = `
    <h1>Daftar akun mahasiswa</h1>
    <p class="auth-sub">Satu akun untuk semua layanan persuratan jurusan.</p>
    ${flash(pesan, tipe)}
    <form method="post" action="/daftar" class="auth-form">
      <div class="field full"><label for="nama">Nama lengkap</label>
        <input class="input" id="nama" name="nama" required value="${esc(values.nama || '')}" placeholder="Sesuai Kartu Tanda Mahasiswa"></div>
      <div class="grid-2">
        <div class="field full"><label for="nim">NIM</label>
          <input class="input" id="nim" name="nim" required value="${esc(values.nim || '')}" placeholder="cth. 2023061024063"></div>
        <div class="field full"><label for="wa">Nomor WhatsApp</label>
          <input class="input" id="wa" name="wa" type="tel" required value="${esc(values.wa || '')}" placeholder="cth. 082199255839"></div>
      </div>
      <div class="field full"><label for="email">Email</label>
        <input class="input" id="email" name="email" type="email" required value="${esc(values.email || '')}" placeholder="nama@student.uncen.ac.id"></div>
      <div class="field full"><label for="password">Kata sandi</label>
        <div class="input-wrap"><input class="input" id="password" name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Minimal 8 karakter">
        <button type="button" class="reveal" data-reveal aria-label="Tampilkan kata sandi">${icon('search')}</button></div></div>
      <button class="btn btn-primary btn-block" type="submit">Buat akun</button>
    </form>
    <p class="auth-alt">Sudah punya akun? <a href="/masuk">Masuk di sini</a></p>`;
  return html(
    ctx.res,
    authLayout({ settings: ctx.settings, title: 'Daftar', body, side: { judul: 'Satu akun, semua layanan.', teks: 'Daftar sekali untuk mengajukan surat apa pun, melacak status, dan menerima notifikasi WhatsApp.' } })
  );
}

/* ── dashboard mahasiswa ───────────────────────────────────────────────── */

function dashboardSaya(ctx) {
  const s = ctx.settings;
  const rows = db.prepare('SELECT * FROM letters WHERE pemohon_id = ? ORDER BY id DESC').all(ctx.user.id);
  const selesai = rows.filter((r) => r.status === 'selesai').length;
  const proses = rows.filter((r) => r.status === 'baru' || r.status === 'diproses').length;
  const body = `
  <section class="dash-head">
    <div class="wrap dash-head-in">
      <div>
        <p class="eyebrow">Dashboard mahasiswa</p>
        <h1>Selamat datang, ${esc(ctx.user.nama.split(' ')[0])} 👋</h1>
        <p class="muted">Kelola pengajuan surat dan pantau statusnya di satu tempat.</p>
      </div>
      <a class="btn btn-primary" href="/saya/ajukan">${icon('send')} Ajukan surat baru</a>
    </div>
  </section>
  <section class="section section-tight">
    <div class="wrap">
      <div class="mini-stats">
        <div class="mini-stat"><span class="ms-ic teal">${icon('inbox')}</span><div><strong>${rows.length}</strong><span>Total pengajuan</span></div></div>
        <div class="mini-stat"><span class="ms-ic amber">${icon('clock')}</span><div><strong>${proses}</strong><span>Sedang diproses</span></div></div>
        <div class="mini-stat"><span class="ms-ic green">${icon('check')}</span><div><strong>${selesai}</strong><span>Surat terbit</span></div></div>
        <div class="mini-stat"><span class="ms-ic blue">${icon('whatsapp')}</span><div><strong>${esc(waCantik(ctx.user.wa) || '—')}</strong><span>WhatsApp terdaftar</span></div></div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="card-head"><h2>Riwayat pengajuan</h2><a class="link-arrow" href="/lacak">Lacak dengan tiket ${icon('chevron')}</a></div>
          ${suratSayaTable(rows)}
        </div>
        <aside class="dash-side">
          <div class="card side-card">
            <h3>Layanan cepat</h3>
            <div class="quick-list">
              ${jenisAktif(s).slice(0, 4)
                .map(
                  (j) => `<a class="quick-item" href="/saya/ajukan?jenis=${j.kode}">
                    <span class="type-ic type-${j.warna}">${icon(j.ikon)}</span>
                    <span><b>${esc(j.nama)}</b><small>${esc(j.kategori)}</small></span>
                    ${icon('chevron')}
                  </a>`
                )
                .join('')}
            </div>
          </div>
          <div class="card side-card tone">
            <h3>Profil saya</h3>
            <div class="profile-row">${avatar(ctx.user.nama)}<div><b>${esc(ctx.user.nama)}</b><small>${esc(ctx.user.nim || ctx.user.email)}</small></div></div>
            <p class="side-contact">${icon('mail')} ${esc(ctx.user.email)}</p>
            <p class="side-contact">${icon('whatsapp')} ${esc(waCantik(ctx.user.wa) || 'Belum diisi')}</p>
            <a class="btn btn-outline btn-sm btn-block" href="/saya/profil">Ubah profil</a>
          </div>
        </aside>
      </div>
    </div>
  </section>`;
  return html(ctx.res, publicLayout({ settings: s, user: ctx.user, title: 'Dashboard Saya', body, active: 'saya' }));
}

function pilihJenis(ctx) {
  const s = ctx.settings;
  const st = statistikPublik();
  const body = `<section class="page-head">
    <div class="wrap">
      <p class="eyebrow">Pengajuan baru</p>
      <h1>Pilih jenis surat</h1>
      <p class="lede narrow">Tentukan layanan yang Anda butuhkan, lalu lengkapi formulirnya.</p>
    </div>
  </section>
  <section class="section section-tight"><div class="wrap">
    <div class="type-grid">${jenisAktif(s).map((j) => kartuJenis(j, st.perJenis[j.kode] || 0, 'Pilih')).join('')}</div>
  </div></section>`;
  return html(ctx.res, publicLayout({ settings: s, user: ctx.user, title: 'Pilih Jenis Surat', body, active: 'saya' }));
}

function formPengajuan(ctx, jenis, values = {}, errors = []) {
  const s = ctx.settings;
  const body = `<section class="page-head compact">
    <div class="wrap">
      <a class="back-link" href="/saya/ajukan">← Semua jenis surat</a>
      <h1>${esc(jenis.nama)}</h1>
    </div>
  </section>
  <section class="section section-tight"><div class="wrap">
    ${formSurat({ jenis, values, errors, user: ctx.user, settings: s })}
  </div></section>`;
  return html(ctx.res, publicLayout({ settings: s, user: ctx.user, title: jenis.nama, body, active: 'saya' }));
}

function detailSuratSaya(ctx, letter) {
  const s = ctx.settings;
  const jenis = jenisByKode(letter.jenis);
  const d = letter.data;
  const body = `<section class="page-head compact">
    <div class="wrap">
      <a class="back-link" href="/saya">← Dashboard</a>
      ${ctx.query.ok ? flash(ctx.query.ok) : ''}
      <div class="head-row">
        <div><h1>${esc(letter.tiket)}</h1><p class="muted">${esc(jenis?.nama || letter.jenis)}</p></div>
        ${statusBadge(letter.status)}
      </div>
    </div>
  </section>
  <section class="section section-tight"><div class="wrap detail-grid">
    <div class="card">
      <div class="card-head"><h2>Progres pengajuan</h2><span class="muted-sm">Diajukan ${esc(tanggalJamID(letter.created_at))}</span></div>
      ${timelineSurat(letter)}
      ${letter.status === 'ditolak' && letter.catatan_admin ? `<div class="alert alert-err"><strong>Pengajuan ditolak</strong><p>${esc(letter.catatan_admin)}</p></div>` : ''}
      ${letter.status === 'selesai' && letter.kode ? `<div class="alert alert-ok"><strong>Surat telah terbit</strong><p>Nomor ${esc(letter.nomor)} · ${esc(tanggalID(letter.tanggal))}.</p><p>Kode verifikasi: <b class="mono">${esc(letter.kode)}</b></p><p>Simpan kode ini. Surat hanya dapat dilihat dan dicetak oleh penerima melalui Portal Penerima dengan akun penerima.</p></div>` : ''}
      ${letter.catatan_admin && letter.status !== 'ditolak' ? `<div class="note-box"><strong>Catatan petugas</strong><p>${esc(letter.catatan_admin)}</p></div>` : ''}
      <div class="card-head mt"><h2>Data pengajuan</h2></div>
      <table class="kv">
        ${jenis.fields
          .map((f) => {
            let v = d[f.name] || '—';
            if (f.name === 'peserta') v = pca(d.peserta).map((p) => `${p.nama} (${p.nim})`).join(', ');
            if (f.name === 'data') v = String(d.data || '').split('\n').filter(Boolean).join(' · ');
            return `<tr><th>${esc(f.label)}</th><td>${esc(v)}</td></tr>`;
          })
          .join('')}
        <tr><th>WhatsApp</th><td>${esc(waCantik(letter.wa))}</td></tr>
        <tr><th>Nomor surat</th><td>${esc(letter.nomor || 'Belum ditetapkan')}</td></tr>
        <tr><th>Tanggal surat</th><td>${esc(tanggalID(letter.tanggal))}</td></tr>
      </table>
    </div>
    <aside class="dash-side">
      <div class="card side-card">
        <h3>Butuh bantuan?</h3>
        <p>Hubungi admin jurusan bila pengajuan Anda belum diproses lebih dari 2 hari kerja.</p>
        <p class="side-contact">${icon('mail')} ${esc(s.email)}</p>
        <p class="side-contact">${icon('clock')} ${esc(s.jam_layanan)}</p>
      </div>
      <div class="card side-card tone">
        <h3>Simpan nomor tiket</h3>
        <div class="ticket-box"><span class="mono big">${esc(letter.tiket)}</span><button class="btn btn-sm btn-outline" type="button" data-copy="${esc(letter.tiket)}">${icon('copy')} Salin</button></div>
        <p>Tiket ini dapat dipakai pada menu Lacak Surat.</p>
      </div>
    </aside>
  </div></section>`;
  return html(ctx.res, publicLayout({ settings: s, user: ctx.user, title: letter.tiket, body, active: 'saya' }));
}

/* ── pelacakan & verifikasi ────────────────────────────────────────────── */

function lacakPage(ctx, hasil = null, notFound = false, tiket = '') {
  const body = `<section class="page-head">
    <div class="wrap">
      <p class="eyebrow">Pelacakan</p>
      <h1>Lacak pengajuan surat</h1>
      <p class="lede narrow">Masukkan nomor tiket yang Anda terima saat mengajukan surat.</p>
      <form class="track-form" method="get" action="/lacak">
        <input class="input" name="tiket" value="${esc(tiket)}" placeholder="cth. ELK-2026-0001" aria-label="Nomor tiket" required>
        <button class="btn btn-primary" type="submit">${icon('search')} Cari</button>
      </form>
      ${notFound ? `<div class="alert alert-err" style="margin-top:20px">Tiket <strong>${esc(tiket)}</strong> tidak ditemukan. Periksa kembali penulisan nomor tiket.</div>` : ''}
    </div>
  </section>`;
  let hasilHtml = '';
  if (hasil) {
    const jenis = jenisByKode(hasil.jenis);
    hasilHtml = `<section class="section section-tight"><div class="wrap narrow">
      <div class="card">
        <div class="card-head"><div><h2>${esc(hasil.tiket)}</h2><p class="muted-sm">${esc(jenis?.nama || hasil.jenis)}</p></div>${statusBadge(hasil.status)}</div>
        ${timelineSurat(hasil)}
        <table class="kv">
          <tr><th>Pemohon</th><td>${esc(hasil.nama || '-')}</td></tr>
          <tr><th>Nomor surat</th><td>${esc(hasil.nomor || 'Belum ditetapkan')}</td></tr>
          <tr><th>Tanggal surat</th><td>${esc(tanggalID(hasil.tanggal))}</td></tr>
          <tr><th>Diajukan</th><td>${esc(tanggalJamID(hasil.created_at))}</td></tr>
        </table>
        ${hasil.status === 'selesai' && hasil.kode ? `<div class="alert alert-ok"><strong>Surat selesai</strong><p>Kode verifikasi: <b class="mono">${esc(hasil.kode)}</b></p><p>Surat hanya dapat dilihat dan dicetak oleh penerima melalui Portal Penerima.</p></div>` : ''}
      </div>
    </div></section>`;
  }
  return html(ctx.res, publicLayout({ settings: ctx.settings, user: ctx.user, title: 'Lacak Surat', body: body + hasilHtml, active: 'lacak' }));
}

function verifikasiPage(ctx, hasil = null, notFound = false, kode = '') {
  const body = `<section class="page-head">
    <div class="wrap">
      <p class="eyebrow">Verifikasi dokumen</p>
      <h1>Periksa keaslian surat</h1>
      <p class="lede narrow">Masukkan kode verifikasi yang tercantum pada surat atau notifikasi untuk memastikan dokumen diterbitkan oleh jurusan.</p>
      <form class="track-form" method="get" action="/verifikasi">
        <input class="input mono" name="kode" value="${esc(kode)}" placeholder="cth. ELK-AB12CD34" aria-label="Kode verifikasi" required>
        <button class="btn btn-primary" type="submit">${icon('shield')} Verifikasi</button>
      </form>
      ${notFound ? `<div class="alert alert-err" style="margin-top:20px">Kode <strong>${esc(kode)}</strong> tidak terdaftar pada basis data surat jurusan.</div>` : ''}
    </div>
  </section>`;
  let hasilHtml = '';
  if (hasil) {
    const jenis = jenisByKode(hasil.jenis);
    hasilHtml = `<section class="section section-tight"><div class="wrap narrow">
      <div class="verify-card">
        <div class="verify-badge">${icon('shield')}</div>
        <h2>Dokumen terverifikasi</h2>
        <p>Surat berikut tercatat sebagai dokumen resmi Jurusan Teknik Elektro, Fakultas Teknik, Universitas Cenderawasih.</p>
        <table class="kv">
          <tr><th>Nomor surat</th><td class="mono">${esc(hasil.nomor || '-')}</td></tr>
          <tr><th>Jenis</th><td>${esc(jenis?.nama || hasil.jenis)}</td></tr>
          <tr><th>Perihal</th><td>${esc(hasil.perihal || jenis?.perihal || '-')}</td></tr>
          <tr><th>Tanggal</th><td>${esc(tanggalID(hasil.tanggal))}</td></tr>
          <tr><th>Pemohon</th><td>${esc(hasil.nama || '-')}</td></tr>
          <tr><th>Status</th><td>${statusBadge(hasil.status)}</td></tr>
        </table>
        <p class="verify-foot">Kode ${esc(hasil.kode)} · Terakhir diperbarui ${esc(tanggalJamID(hasil.updated_at))}</p>
      </div>
    </div></section>`;
  }
  return html(ctx.res, publicLayout({ settings: ctx.settings, user: ctx.user, title: 'Verifikasi Surat', body: body + hasilHtml, active: 'verifikasi' }));
}

/* ── portal penerima ───────────────────────────────────────────────────── */

function halamanCariPenerima(ctx, pesan = '', kode = '') {
  const s = ctx.settings;
  const body = `<main class="rec-main">
    <section class="rec-hero">
      <div class="wrap rec-hero-grid">
        <div class="rec-copy">
          <span class="pill pill-soft">${icon('inbox')} Portal penerima surat</span>
          <h1>Cetak notifikasi surat<br><span class="grad">dalam satu langkah.</span></h1>
          <p>Masukkan kode verifikasi, nomor tiket, atau nomor surat yang tertera pada pesan WhatsApp untuk membuka notifikasi resmi, mencetaknya, dan mengunduh surat lengkap.</p>
          <p class="rec-hint">${icon('info')} Tanpa akun. Cukup satu kode dari pesan WhatsApp yang Anda terima.</p>
        </div>
        <aside class="rec-card">
          <h2 style="font-size:17px;margin-bottom:6px">Buka notifikasi surat</h2>
          <p class="muted-sm" style="margin-bottom:16px">Kode contoh: <span class="mono">ELK-DEMO2026</span> atau tiket <span class="mono">ELK-2026-0001</span>.</p>
          <form method="post" action="/terima" class="form-grid-1">
            <div class="field"><label for="kunci">Kode / nomor tiket</label>
              <input class="input mono" id="kunci" name="kunci" value="${esc(kode)}" placeholder="ELK-XXXXXXXX" required autofocus></div>
            <button class="btn btn-primary btn-block" type="submit">${icon('search')} Cari notifikasi</button>
          </form>
          ${pesan ? `<p class="lookup-err">${esc(pesan)}</p>` : ''}
        </aside>
      </div>
    </section>
    <section class="rec-info">
      <div class="wrap rec-info-grid">
        <div class="rec-info-card"><h3>${icon('print')} Cetak mandiri</h3><p>Notifikasi berformat A5 dapat langsung dicetak dari ponsel atau komputer, tanpa perlu datang ke jurusan.</p></div>
        <div class="rec-info-card"><h3>${icon('whatsapp')} Notifikasi WhatsApp</h3><p>Pesan berisi tautan portal dikirim ke nomor WhatsApp yang Anda daftarkan saat mengajukan surat.</p></div>
        <div class="rec-info-card"><h3>${icon('shield')} Keaslian terjamin</h3><p>Setiap notifikasi memuat kode unik yang dapat diperiksa kapan saja melalui halaman verifikasi.</p></div>
      </div>
    </section>
  </main>`;
  return html(ctx.res, recipientLayout({ settings: s, body, title: 'Portal Penerima Surat' }));
}

function portalPenerima(ctx, letter) {
  const s = ctx.settings;
  const d = letter.data;
  const jenis = jenisByKode(letter.jenis);
  const nama = d.nama || letter.nama || (String(d.peserta || '').split('|')[0] || '').trim() || 'Penerima';
  const pesan = pesanWA(letter, s, ctx.baseUrl);
  const tautan = waLink(letter.wa, pesan);
  const perluCetak = ctx.query.cetak === '1';

  const body = `<main class="rec-main">
    <section class="rec-hero">
      <div class="wrap rec-hero-grid">
        <div class="rec-copy">
          <span class="pill pill-soft">${icon('bell')} Notifikasi resmi</span>
          <h1>Surat Anda sudah siap,<br><span class="grad">${esc(nama.split(' ').slice(0, 2).join(' '))}.</span></h1>
          <p>${esc(jenis?.nama || letter.jenis)} dengan nomor <strong>${esc(letter.nomor || '-')}</strong> telah selesai diproses dan ditandatangani. Cetak notifikasi di bawah ini sebagai bukti penerimaan, atau buka surat lengkapnya.</p>
          <div class="rec-actions">
            <button class="btn btn-primary btn-lg" type="button" data-print-notif data-token="${esc(letter.token)}">${icon('print')} Cetak notifikasi</button>
            <a class="btn btn-outline btn-lg" href="/surat/${esc(letter.token)}">${icon('file')} Lihat surat lengkap</a>
            <button class="btn btn-wa btn-lg" type="button" data-wa data-token="${esc(letter.token)}">${icon('whatsapp')} Kirim ke WhatsApp</button>
          </div>
          <p class="rec-hint">${icon('info')} Notifikasi dapat dicetak dari ponsel maupun komputer. Gunakan opsi “Simpan sebagai PDF” bila ingin mengarsipkan dokumen.</p>
        </div>
        <aside class="rec-card">
          <div class="rec-card-top">
            <span class="badge st-selesai"><i class="dot"></i> Surat terbit</span>
            <span class="mono muted-sm">${esc(letter.kode)}</span>
          </div>
          <table class="kv tight">
            <tr><th>Nomor surat</th><td class="mono">${esc(letter.nomor || '-')}</td></tr>
            <tr><th>Tanggal</th><td>${esc(tanggalID(letter.tanggal))}</td></tr>
            <tr><th>Perihal</th><td>${esc(letter.perihal || jenis?.perihal || '-')}</td></tr>
            <tr><th>WhatsApp</th><td>${esc(waCantik(letter.wa) || 'Belum tersedia')}</td></tr>
          </table>
          ${letter.dicetak_at ? `<p class="rec-printed">${icon('check')} Notifikasi telah dicetak ${esc(tanggalJamID(letter.dicetak_at))}</p>` : ''}
        </aside>
      </div>
    </section>

    <section class="rec-sheet-section">
      <div class="wrap">
        <div class="rec-sheet-head">
          <h2>Pratinjau notifikasi</h2>
          <div class="rec-sheet-tools">
            <button class="btn btn-sm btn-outline" type="button" data-print-notif data-token="${esc(letter.token)}">${icon('print')} Cetak</button>
            <button class="btn btn-sm btn-ghost" type="button" data-copy="${esc(pesan)}">${icon('copy')} Salin pesan WhatsApp</button>
          </div>
        </div>
        <div class="notif-stage">${lembarNotifikasi(letter, s, ctx.baseUrl)}</div>
      </div>
    </section>

    <section class="rec-info">
      <div class="wrap rec-info-grid">
        <div class="rec-info-card">
          <h3>${icon('location')} Pengambilan surat</h3>
          <p>${esc(s.loket)}</p>
          <p class="muted-sm">Jam layanan: ${esc(s.jam_layanan)}</p>
        </div>
        <div class="rec-info-card">
          <h3>${icon('whatsapp')} Pesan WhatsApp</h3>
          <pre class="wa-preview" id="wa-preview">${esc(pesan)}</pre>
          <a class="btn btn-wa btn-block" href="${esc(tautan)}" target="_blank" rel="noopener">${icon('whatsapp')} Buka WhatsApp</a>
        </div>
        <div class="rec-info-card">
          <h3>${icon('shield')} Verifikasi</h3>
          <p>Kode <strong class="mono">${esc(letter.kode)}</strong></p>
          <p class="muted-sm">Siapa pun dapat memeriksa keaslian surat ini melalui halaman verifikasi publik.</p>
          <a class="btn btn-outline btn-block" href="/verifikasi/${esc(letter.kode)}">Periksa keaslian</a>
        </div>
      </div>
    </section>

    <section class="rec-timeline">
      <div class="wrap">
        <h2>Riwayat surat</h2>
        ${timelineSurat(letter)}
      </div>
    </section>
  </main>
  <div class="print-watermark">${esc(s.dept)} · ${esc(letter.kode || '')}</div>
  ${perluCetak ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},700);});</script>' : ''}`;

  return html(ctx.res, recipientLayout({ settings: s, letter, body, title: `Notifikasi ${letter.nomor || letter.tiket}` }));
}

/* ── portal penerima berbasis akun ─────────────────────────────────────── */

function suratUntukPenerima(user) {
  const wa = normalisasiWA(user.wa);
  const nim = String(user.nim || '').trim();
  const rows = db
    .prepare(
      `SELECT * FROM letters
       WHERE (wa = ? AND ? <> '') OR (nim = ? AND ? <> '') OR penerima_id = ?
       ORDER BY id DESC`
    )
    .all(wa, wa, nim, nim, user.id);
  const unik = new Map();
  for (const r of rows) unik.set(r.id, r);
  return [...unik.values()].map((r) => ({ ...r, data: dataSurat(r) }));
}

function perluPenerima(ctx) {
  if (!ctx.penerima) {
    redirect(ctx.res, `/penerima/masuk?next=${encodeURIComponent(ctx.pathname)}`);
    return false;
  }
  return true;
}

function halamanMasukPenerima(ctx, pesan = '') {
  const body = `
    <p class="eyebrow">Portal penerima</p>
    <h1>Masuk untuk melihat surat Anda</h1>
    <p class="auth-sub">Gunakan email dan kata sandi yang terdaftar. Surat akan tampil otomatis sesuai nomor WhatsApp Anda.</p>
    ${flash(pesan, 'err')}
    <form method="post" action="/penerima/masuk" class="auth-form">
      <input type="hidden" name="next" value="${esc(ctx.query.next || '')}">
      <div class="field full"><label for="email">Email</label>
        <input class="input" id="email" name="email" type="email" required autocomplete="username" placeholder="nama@email.com" value="${esc(ctx.query.email || '')}"></div>
      <div class="field full"><label for="password">Kata sandi</label>
        <div class="input-wrap"><input class="input" id="password" name="password" type="password" required autocomplete="current-password" placeholder="••••••••">
        <button type="button" class="reveal" data-reveal aria-label="Tampilkan kata sandi">${icon('search')}</button></div></div>
      <button class="btn btn-primary btn-block" type="submit">Masuk ke portal penerima</button>
    </form>
    <p class="auth-alt">Akun penerima dibuat oleh <strong>Admin Utama</strong>. Hubungi petugas bila belum memiliki akun.</p>
    <p class="auth-alt"><a href="/">← Kembali ke beranda</a> · <a href="/admin/masuk">Masuk admin</a></p>`;
  return html(
    ctx.res,
    authLayout({
      settings: ctx.settings,
      title: 'Masuk Portal Penerima',
      body,
      side: {
        judul: 'Semua surat Anda, dalam satu portal.',
        teks: 'Lihat surat lengkap, cetak notifikasi resmi, dan periksa keasliannya kapan saja tanpa perlu mengantre di jurusan.',
      },
    })
  );
}

function halamanDaftarPenerima(ctx, values = {}, pesan = '') {
  const body = `
    <p class="eyebrow">Portal penerima</p>
    <h1>Daftar akun penerima</h1>
    <p class="auth-sub">Gunakan nomor WhatsApp yang Anda daftarkan saat mengajukan surat agar surat otomatis muncul di portal.</p>
    ${flash(pesan, 'err')}
    <form method="post" action="/penerima/daftar" class="auth-form">
      <div class="field full"><label for="nama">Nama lengkap</label>
        <input class="input" id="nama" name="nama" required value="${esc(values.nama || '')}" placeholder="Sesuai dokumen surat"></div>
      <div class="grid-2">
        <div class="field full"><label for="wa">Nomor WhatsApp</label>
          <input class="input" id="wa" name="wa" type="tel" required value="${esc(values.wa || '')}" placeholder="cth. 082199255839"></div>
        <div class="field full"><label for="nim">NIM <span class="opt">(opsional)</span></label>
          <input class="input" id="nim" name="nim" value="${esc(values.nim || '')}" placeholder="cth. 2023061024063"></div>
      </div>
      <div class="field full"><label for="email">Email</label>
        <input class="input" id="email" name="email" type="email" required value="${esc(values.email || '')}" placeholder="nama@email.com"></div>
      <div class="field full"><label for="password">Kata sandi</label>
        <div class="input-wrap"><input class="input" id="password" name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Minimal 8 karakter">
        <button type="button" class="reveal" data-reveal aria-label="Tampilkan kata sandi">${icon('search')}</button></div></div>
      <button class="btn btn-primary btn-block" type="submit">Buat akun penerima</button>
    </form>
    <p class="auth-alt">Sudah punya akun? <a href="/penerima/masuk">Masuk di sini</a></p>`;
  return html(
    ctx.res,
    authLayout({
      settings: ctx.settings,
      title: 'Daftar Portal Penerima',
      body,
      side: { judul: 'Satu akun untuk semua surat Anda.', teks: 'Daftar sekali, lalu surat yang ditujukan ke nomor WhatsApp Anda akan tampil otomatis.' },
    })
  );
}

function halamanDaftarPenerimaTutup(ctx, ditolak = false) {
  const body = `
    <p class="eyebrow">Portal penerima</p>
    <h1>Akun dibuat oleh admin</h1>
    <p class="auth-sub">Pendaftaran mandiri dinonaktifkan. Akun portal penerima hanya dapat dibuat oleh Admin Utama melalui dashboard.</p>
    ${ditolak ? '<div class="alert alert-err">Pendaftaran tidak dapat dilakukan dari halaman ini.</div>' : ''}
    <div class="alert alert-ok">
      ${icon('info')}
      <div><strong>Belum punya akun?</strong>
      <p>Hubungi Admin Utama jurusan dan sampaikan nama serta nomor WhatsApp yang Anda pakai saat mengajukan surat. Admin akan membuatkan akun dan mengirimkan sandi awalnya.</p></div>
    </div>
    <a class="btn btn-primary btn-block" href="/penerima/masuk">Ke halaman masuk</a>
    <p class="auth-alt"><a href="/">← Kembali ke beranda</a></p>`;
  return html(
    ctx.res,
    authLayout({
      settings: ctx.settings,
      title: 'Akun Penerima',
      body,
      side: { judul: 'Akun penerima dibuat oleh petugas.', teks: 'Demi keamanan data surat, pembuatan akun portal penerima dikelola langsung oleh Admin Jurusan.' },
    }),
    ditolak ? 403 : 200
  );
}

function dashboardPenerima(ctx) {
  const s = ctx.settings;
  const daftar = suratUntukPenerima(ctx.penerima);
  const siap = daftar.filter((l) => l.status === 'selesai').length;
  const dicetak = daftar.filter((l) => l.dicetak_at).length;
  const wa = waCantik(ctx.penerima.wa);

  const kartu = daftar.length
    ? daftar
        .map((l) => {
          const jenis = jenisByKode(l.jenis);
          const selesai = l.status === 'selesai' && l.token;
          return `<article class="rec-letter">
            <span class="rl-ic type-${esc(jenis?.warna || 'teal')}">${icon(jenis?.ikon || 'file')}</span>
            <div class="rl-main">
              <div class="rl-top">
                <h3>${esc(jenis?.nama || l.jenis)}</h3>
                ${statusBadge(l.status)}
              </div>
              <p class="rl-meta"><span class="mono">${esc(l.nomor || l.tiket)}</span> · ${esc(tanggalID(l.tanggal || (l.created_at || '').slice(0, 10)))}</p>
              <p class="rl-sub">${esc(ringkasSurat(l))}</p>
            </div>
            <div class="rl-actions">
              ${selesai
                ? `<a class="btn btn-primary btn-sm" href="/surat/${esc(l.token)}">${icon('file')} Lihat</a>
                   <a class="btn btn-outline btn-sm" href="/terima/${esc(l.token)}?cetak=1">${icon('print')} Cetak</a>
                   <a class="btn btn-ghost btn-sm" href="/penerima/verifikasi?kode=${esc(l.kode || '')}">${icon('shield')} Verifikasi</a>`
                : `<span class="rl-wait">${icon('clock')} ${esc(statusLabel(l.status))}</span>`}
            </div>
          </article>`;
        })
        .join('')
    : `<div class="rec-empty-card">
        <span class="re-ic">${icon('inbox')}</span>
        <h3>Belum ada surat untuk nomor WhatsApp Anda</h3>
        <p>${ctx.penerima.wa ? `Belum ada surat yang diterbitkan untuk nomor <strong>${esc(wa)}</strong>. Surat akan muncul otomatis setelah petugas jurusan menerbitkannya.` : 'Nomor WhatsApp belum diisi pada profil Anda, sehingga surat tidak dapat dicocokkan. Lengkapi nomor terlebih dahulu.'}</p>
        <a class="btn btn-primary" href="/penerima/profil">${ctx.penerima.wa ? 'Perbarui profil' : 'Isi nomor WhatsApp'}</a>
      </div>`;

  const body = `<main class="rec-main">
    <section class="rec-hero rec-hero-short">
      <div class="wrap rec-hero-grid">
        <div class="rec-copy">
          <span class="pill pill-soft">${icon('inbox')} Portal penerima</span>
          <h1>Halo, ${esc(String(ctx.penerima.nama).split(' ')[0])}.<br><span class="grad">Surat Anda ada di sini.</span></h1>
          <p>Menampilkan surat yang ditujukan ke nomor WhatsApp <strong>${esc(wa)}</strong>. Buka surat lengkap, cetak notifikasi, atau periksa keasliannya.</p>
          <div class="rec-actions">
            <a class="btn btn-light" href="/penerima/verifikasi">${icon('shield')} Verifikasi surat</a>
            <a class="btn btn-ghost-light" href="/penerima/profil">${icon('users')} Ubah profil</a>
          </div>
        </div>
        <aside class="rec-card">
          <div class="rec-card-top">
            <span class="badge st-selesai"><i class="dot"></i> ${selesaiTotal(daftar)} surat terbit</span>
            <span class="mono muted-sm">${esc(ctx.penerima.email)}</span>
          </div>
          <div class="rec-stats">
            <div><strong>${daftar.length}</strong><span>total surat</span></div>
            <div><strong>${siap}</strong><span>siap diambil</span></div>
            <div><strong>${dicetak}</strong><span>sudah dicetak</span></div>
          </div>
        </aside>
      </div>
    </section>

    <section class="rec-section">
      <div class="wrap">
        <div class="rec-list-head">
          <div><h2>Daftar surat</h2><p class="muted-sm">Diurutkan dari yang terbaru.</p></div>
          <span class="chip">${daftar.length} surat</span>
        </div>
        <div class="rec-letter-list">${kartu}</div>
      </div>
    </section>

    <section class="rec-info">
      <div class="wrap rec-info-grid">
        <div class="rec-info-card"><h3>${icon('file')} Lihat</h3><p>Buka lembar surat resmi A4 lengkap dengan nomor, tanggal, penandatangan, dan kode verifikasi.</p></div>
        <div class="rec-info-card"><h3>${icon('print')} Cetak</h3><p>Cetak notifikasi A5 sebagai bukti penerimaan surat, atau simpan sebagai PDF dari dialog cetak.</p></div>
        <div class="rec-info-card"><h3>${icon('shield')} Verifikasi</h3><p>Periksa keaslian dokumen dengan kode unik — dapat dilakukan siapa pun melalui portal verifikasi.</p></div>
      </div>
    </section>
  </main>`;

  return html(ctx.res, recipientLayout({ settings: s, user: ctx.penerima, active: 'surat', body, title: 'Surat Saya' }));
}

function selesaiTotal(daftar) {
  return daftar.filter((l) => l.status === 'selesai').length;
}

function halamanProfilPenerima(ctx) {
  const s = ctx.settings;
  const body = `<main class="rec-main">
    <section class="rec-hero rec-hero-short">
      <div class="wrap">
        <div class="rec-copy">
          <span class="pill pill-soft">${icon('users')} Profil penerima</span>
          <h1>Data akun Anda</h1>
          <p>Nomor WhatsApp dipakai untuk mencocokkan surat yang ditujukan kepada Anda.</p>
        </div>
      </div>
    </section>
    <section class="rec-section">
      <div class="wrap narrow">
        ${flash(ctx.query.ok, 'ok')}${flash(ctx.query.err, 'err')}
        <form class="card form-card" method="post" action="/penerima/profil">
          ${csrfField(ctx.penerima)}
          <div class="fields">
            <div class="field full"><label>Nama lengkap</label><input class="input" name="nama" value="${esc(ctx.penerima.nama)}" required></div>
            <div class="field half"><label>Nomor WhatsApp</label><input class="input" name="wa" type="tel" value="${esc(ctx.penerima.wa || '')}" placeholder="cth. 082199255839" required></div>
            <div class="field half"><label>NIM <span class="opt">(opsional)</span></label><input class="input" name="nim" value="${esc(ctx.penerima.nim || '')}"></div>
            <div class="field half"><label>Email</label><input class="input" value="${esc(ctx.penerima.email)}" disabled></div>
            <div class="field half"><label>Kata sandi baru <span class="opt">(opsional)</span></label><input class="input" name="password" type="password" minlength="8" placeholder="Kosongkan bila tetap"></div>
          </div>
          <div class="form-foot">
            <a class="btn btn-ghost" href="/penerima">← Kembali</a>
            <button class="btn btn-primary" type="submit">Simpan data</button>
          </div>
        </form>
      </div>
    </section>
  </main>`;
  return html(ctx.res, recipientLayout({ settings: s, user: ctx.penerima, active: '', body, title: 'Profil Penerima' }));
}

function halamanVerifikasiPenerima(ctx) {
  const s = ctx.settings;
  const kode = String(ctx.query.kode || '').trim().toUpperCase();
  let hasil = null;
  let salah = false;
  if (kode) {
    const row = db.prepare("SELECT * FROM letters WHERE UPPER(kode) = ? AND status = 'selesai'").get(kode);
    if (row) hasil = { ...row, data: dataSurat(row) };
    else salah = true;
  }
  const jenis = hasil ? jenisByKode(hasil.jenis) : null;
  const body = `<main class="rec-main">
    <section class="rec-hero rec-hero-short">
      <div class="wrap rec-hero-grid">
        <div class="rec-copy">
          <span class="pill pill-soft">${icon('shield')} Verifikasi dokumen</span>
          <h1>Periksa keaslian surat.</h1>
          <p>Masukkan kode verifikasi yang tercetak pada surat atau notifikasi (contoh: <span class="mono">ELK-DEMO2026</span>).</p>
          <form class="track-form" method="get" action="/penerima/verifikasi">
            <input class="input mono" name="kode" value="${esc(kode)}" placeholder="ELK-XXXXXXXX" aria-label="Kode verifikasi" required>
            <button class="btn btn-primary" type="submit">${icon('search')} Periksa</button>
          </form>
        </div>
        <aside class="rec-card">
          <h3 style="font-size:15px;margin-bottom:8px">Cara verifikasi</h3>
          <ol class="verify-steps">
            <li>Buka surat atau notifikasi Anda.</li>
            <li>Salin kode bertanda perisai, mis. <span class="mono">ELK-AB12CD34</span>.</li>
            <li>Tempel di kolom, lalu tekan Periksa.</li>
          </ol>
          <p class="muted-sm" style="margin-top:10px">Dokumen sah akan menampilkan nomor, tanggal, dan jenis surat yang sesuai.</p>
        </aside>
      </div>
    </section>
    <section class="rec-section">
      <div class="wrap narrow">
        ${salah ? `<div class="alert alert-err" style="margin-bottom:0">${icon('info')}<div><strong>Kode tidak terdaftar</strong><p>Kode <b>${esc(kode)}</b> tidak ditemukan pada surat yang telah terbit. Periksa kembali penulisannya.</p></div></div>` : ''}
        ${hasil
          ? `<div class="verify-card">
              <div class="verify-badge">${icon('shield')}</div>
              <h2>Dokumen terverifikasi</h2>
              <p>Surat berikut tercatat sebagai dokumen resmi ${esc(s.dept)}, ${esc(s.fakultas)}, ${esc(s.instansi2)}.</p>
              <table class="kv">
                <tr><th>Nomor surat</th><td class="mono">${esc(hasil.nomor || '-')}</td></tr>
                <tr><th>Jenis</th><td>${esc(jenis?.nama || hasil.jenis)}</td></tr>
                <tr><th>Perihal</th><td>${esc(hasil.perihal || jenis?.perihal || '-')}</td></tr>
                <tr><th>Tanggal</th><td>${esc(tanggalID(hasil.tanggal))}</td></tr>
                <tr><th>Pemohon</th><td>${esc(hasil.nama || '-')}</td></tr>
                <tr><th>Status</th><td>${statusBadge(hasil.status)}</td></tr>
              </table>
              <div class="verify-actions">
                <a class="btn btn-primary" href="/surat/${esc(hasil.token)}">${icon('file')} Lihat surat</a>
                <a class="btn btn-outline" href="/terima/${esc(hasil.token)}?cetak=1">${icon('print')} Cetak notifikasi</a>
              </div>
              <p class="verify-foot">Kode ${esc(hasil.kode)} · Terakhir diperbarui ${esc(tanggalJamID(hasil.updated_at))}</p>
            </div>`
          : ''}
      </div>
    </section>
  </main>`;
  return html(ctx.res, recipientLayout({ settings: s, user: ctx.penerima, active: 'verifikasi', body, title: 'Verifikasi Surat' }));
}


/* ── pendaftaran rute ──────────────────────────────────────────────────── */

export const publicRoutes = [
  { method: 'GET', path: '/', handler: beranda },
  { method: 'GET', path: '/layanan', handler: layanan },

  { method: 'GET', path: '/penerima/masuk', handler: (ctx) => (ctx.penerima ? redirect(ctx.res, '/penerima') : halamanMasukPenerima(ctx)) },
  {
    method: 'POST',
    path: '/penerima/masuk',
    handler: async (ctx) => {
      const { fields } = await readBody(ctx.req);
      const lim = rateLimit(`penerima-login:${ipDari(ctx.req)}`, 10, 10 * 60 * 1000);
      if (!lim.allowed) return halamanMasukPenerima(ctx, 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.');
      const email = String(fields.email || '').trim().toLowerCase();
      const password = String(fields.password || '');
      const akun = db.prepare('SELECT * FROM penerima WHERE email = ?').get(email);
      if (!akun || !akun.aktif || !verifyPassword(password, akun.password)) {
        catatLog(email, 'penerima_login_gagal', 'penerima', email, `IP ${ipDari(ctx.req)}`);
        return html(ctx.res, halamanMasukPenerima(ctx, 'Email atau kata sandi tidak sesuai.'), 401);
      }
      catatLog(email, 'penerima_login', 'penerima', akun.id, `IP ${ipDari(ctx.req)}`);
      const cookie = cookieSet(makeSession(akun, 'penerima'), ctx.secure, 'siprel_penerima');
      return redirect(ctx.res, '/penerima', cookie);
    },
  },
  { method: 'GET', path: '/penerima/daftar', handler: (ctx) => (ctx.penerima ? redirect(ctx.res, '/penerima') : halamanDaftarPenerimaTutup(ctx)) },
  {
    method: 'POST',
    path: '/penerima/daftar',
    handler: (ctx) => halamanDaftarPenerimaTutup(ctx, true),
  },
  { method: 'GET', path: '/penerima/keluar', handler: (ctx) => redirect(ctx.res, '/penerima/masuk', cookieClear(ctx.secure, 'siprel_penerima')) },
  { method: 'GET', path: '/penerima', handler: (ctx) => (perluPenerima(ctx) ? dashboardPenerima(ctx) : null) },
  { method: 'GET', path: '/penerima/profil', handler: (ctx) => (perluPenerima(ctx) ? halamanProfilPenerima(ctx) : null) },
  {
    method: 'POST',
    path: '/penerima/profil',
    handler: async (ctx) => {
      if (!perluPenerima(ctx)) return null;
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.penerima, fields)) return redirect(ctx.res, '/penerima/profil');
      const nama = String(fields.nama || '').trim();
      const wa = normalisasiWA(fields.wa);
      const nim = String(fields.nim || '').replace(/\D/g, '');
      const password = String(fields.password || '');
      if (!nama || !wa) return redirect(ctx.res, `/penerima/profil?err=${encodeURIComponent('Nama dan nomor WhatsApp wajib diisi.')}`);
      db.prepare('UPDATE penerima SET nama = ?, wa = ?, nim = ? WHERE id = ?').run(nama, wa, nim, ctx.penerima.id);
      if (password) {
        if (password.length < 8) return redirect(ctx.res, `/penerima/profil?err=${encodeURIComponent('Kata sandi minimal 8 karakter.')}`);
        db.prepare('UPDATE penerima SET password = ? WHERE id = ?').run(hashPassword(password), ctx.penerima.id);
      }
      catatLog(ctx.penerima.email, 'ubah_profil_penerima', 'penerima', ctx.penerima.id, '');
      return redirect(ctx.res, `/penerima/profil?ok=${encodeURIComponent('Profil berhasil diperbarui.')}`);
    },
  },
  { method: 'GET', path: '/penerima/verifikasi', handler: (ctx) => halamanVerifikasiPenerima(ctx) },

  { method: 'GET', path: '/masuk', handler: (ctx) => (ctx.user ? redirect(ctx.res, ctx.user.role === 'admin' ? '/admin' : '/saya') : halamanMasuk(ctx)) },
  {
    method: 'POST',
    path: '/masuk',
    handler: async (ctx) => {
      const { fields } = await readBody(ctx.req);
      const lim = rateLimit(`login:${ipDari(ctx.req)}`, 10, 10 * 60 * 1000);
      if (!lim.allowed) return halamanMasuk(ctx, 'Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.');
      const email = String(fields.email || '').trim().toLowerCase();
      const password = String(fields.password || '');
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (!user || !user.aktif || !verifyPassword(password, user.password)) {
        catatLog(ctx.user?.email || email, 'login_gagal', 'user', email, `IP ${ipDari(ctx.req)}`);
        return html(ctx.res, halamanMasuk(ctx, 'Email atau kata sandi tidak sesuai.'), 401);
      }
      catatLog(email, 'login', 'user', user.id, `IP ${ipDari(ctx.req)}`);
      const cookie = cookieSet(makeSession(user), ctx.secure);
      const next = String(fields.next || '');
      const tujuan = next.startsWith('/') ? next : user.role === 'admin' ? '/admin' : '/saya';
      return redirect(ctx.res, tujuan, cookie);
    },
  },

  { method: 'GET', path: '/daftar', handler: (ctx) => (ctx.user ? redirect(ctx.res, '/saya') : halamanDaftar(ctx)) },
  {
    method: 'POST',
    path: '/daftar',
    handler: async (ctx) => {
      const { fields } = await readBody(ctx.req);
      const lim = rateLimit(`daftar:${ipDari(ctx.req)}`, 6, 30 * 60 * 1000);
      if (!lim.allowed) return halamanDaftar(ctx, fields, 'Terlalu banyak pendaftaran dari perangkat ini.');
      const nama = String(fields.nama || '').trim();
      const nim = String(fields.nim || '').replace(/\D/g, '');
      const wa = normalisasiWA(fields.wa);
      const email = String(fields.email || '').trim().toLowerCase();
      const password = String(fields.password || '');
      if (!nama || !nim || !email || !password) return halamanDaftar(ctx, fields, 'Semua kolom wajib diisi.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return halamanDaftar(ctx, fields, 'Format email tidak valid.');
      if (password.length < 8) return halamanDaftar(ctx, fields, 'Kata sandi minimal 8 karakter.');
      if (!wa) return halamanDaftar(ctx, fields, 'Nomor WhatsApp tidak valid.');
      if (db.prepare('SELECT 1 AS x FROM users WHERE email = ?').get(email)) return halamanDaftar(ctx, fields, 'Email tersebut sudah terdaftar.');
      if (jumlahAkun() >= BATAS_AKUN) {
        return halamanDaftar(ctx, fields, `Kapasitas akun sudah penuh (${BATAS_AKUN} akun). Hubungi admin jurusan.`);
      }
      const info = db
        .prepare('INSERT INTO users (nama, email, nim, wa, password, role, aktif, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
        .run(nama, email, nim, wa, hashPassword(password), 'mahasiswa', nowISO());
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      catatLog(email, 'daftar', 'user', user.id, 'Pendaftaran mahasiswa baru.');
      return redirect(ctx.res, '/saya', cookieSet(makeSession(user), ctx.secure));
    },
  },
  {
    method: 'GET',
    path: '/keluar',
    handler: (ctx) => redirect(ctx.res, '/', cookieClear(ctx.secure)),
  },

  { method: 'GET', path: '/saya', handler: (ctx) => (ctx.user ? dashboardSaya(ctx) : redirect(ctx.res, '/masuk?next=/saya')) },
  {
    method: 'GET',
    path: '/saya/ajukan',
    handler: (ctx) => {
      if (!ctx.user) {
        const jenis = ctx.query.jenis ? `&jenis=${encodeURIComponent(ctx.query.jenis)}` : '';
        return redirect(ctx.res, `/masuk?next=${encodeURIComponent(`/saya/ajukan${jenis ? `?jenis=${ctx.query.jenis}` : ''}`)}`);
      }
      const kode = String(ctx.query.jenis || '').toUpperCase();
      if (!kode) return pilihJenis(ctx);
      const jenis = jenisByKode(kode);
      if (!jenis || !jenisAktif(ctx.settings).some((j) => j.kode === jenis.kode)) return redirect(ctx.res, '/saya/ajukan');
      return formPengajuan(ctx, jenis);
    },
  },
  {
    method: 'POST',
    path: '/saya/ajukan',
    handler: async (ctx) => {
      if (!ctx.user) return redirect(ctx.res, '/masuk?next=/saya/ajukan');
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.user, fields)) return html(ctx.res, halamanMasuk(ctx, 'Sesi formulir kedaluwarsa. Silakan ulangi.'), 400);
      const jenis = jenisByKode(String(fields.jenis || ''));
      if (!jenis) return redirect(ctx.res, '/saya/ajukan');
      if (!jenisAktif(ctx.settings).some((j) => j.kode === jenis.kode)) {
        return redirect(ctx.res, `/saya/ajukan?jenis=${encodeURIComponent(jenis.kode)}&err=1`);
      }
      const lim = rateLimit(`ajukan:${ctx.user.id}`, 8, 10 * 60 * 1000);
      if (!lim.allowed) return formPengajuan(ctx, jenis, fields, ['Terlalu banyak pengajuan dalam waktu singkat. Coba lagi nanti.']);
      const { errors, data } = validasiData(jenis.kode, fields);
      const wa = normalisasiWA(fields.wa);
      if (!wa) errors.push('Nomor WhatsApp tidak valid.');
      if (errors.length) return formPengajuan(ctx, jenis, fields, errors);

      const tiket = buatTiket();
      const now = nowISO();
      const nama = data.nama || (data.peserta ? pca(data.peserta)[0]?.nama : '') || ctx.user.nama;
      const nim = data.nim || (data.peserta ? pca(data.peserta)[0]?.nim : '') || ctx.user.nim || '';
      const info = db
        .prepare(`INSERT INTO letters (tiket, jenis, data, pemohon_id, nama, nim, wa, status, perihal, catatan_pemohon, sumber, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'baru', ?, ?, 'web', ?, ?)`)
        .run(tiket, jenis.kode, JSON.stringify(data), ctx.user.id, nama, nim, wa, jenis.perihal, String(fields.catatan_pemohon || '').trim(), now, now);
      catatLog(ctx.user.email, 'ajukan_surat', 'letter', info.lastInsertRowid, `${jenis.kode} · ${tiket}`);
      return redirect(ctx.res, `/saya/surat/${info.lastInsertRowid}?ok=${encodeURIComponent(`Pengajuan ${tiket} berhasil dikirim. Simpan nomor tiket ini.`)}`);
    },
  },
  {
    method: 'GET',
    path: '/saya/surat/:id',
    handler: (ctx) => {
      if (!ctx.user) return redirect(ctx.res, '/masuk?next=/saya');
      const letter = getJson(Number(ctx.params.id));
      if (!letter || (letter.pemohon_id !== ctx.user.id && ctx.user.role !== 'admin')) return html(ctx.res, notFoundSimple(ctx.settings), 404);
      return detailSuratSaya(ctx, letter);
    },
  },
  {
    method: 'GET',
    path: '/saya/profil',
    handler: (ctx) => {
      if (!ctx.user) return redirect(ctx.res, '/masuk?next=/saya/profil');
      return profilSaya(ctx);
    },
  },
  {
    method: 'POST',
    path: '/saya/profil',
    handler: async (ctx) => {
      if (!ctx.user) return redirect(ctx.res, '/masuk');
      const { fields } = await readBody(ctx.req);
      if (!csrfValid(ctx.req, ctx.user, fields)) return redirect(ctx.res, '/saya/profil');
      const nama = String(fields.nama || '').trim();
      const nim = String(fields.nim || '').replace(/\D/g, '');
      const wa = normalisasiWA(fields.wa);
      const password = String(fields.password || '');
      if (!nama) return redirect(ctx.res, '/saya/profil?err=' + encodeURIComponent('Nama tidak boleh kosong.'));
      db.prepare('UPDATE users SET nama = ?, nim = ?, wa = ? WHERE id = ?').run(nama, nim, wa, ctx.user.id);
      if (password) {
        if (password.length < 8) return redirect(ctx.res, '/saya/profil?err=' + encodeURIComponent('Kata sandi minimal 8 karakter.'));
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(password), ctx.user.id);
      }
      catatLog(ctx.user.email, 'ubah_profil', 'user', ctx.user.id, '');
      return redirect(ctx.res, '/saya/profil?ok=' + encodeURIComponent('Profil berhasil diperbarui.'));
    },
  },

  {
    method: 'GET',
    path: '/lacak',
    handler: (ctx) => lacakPage(ctx),
  },
  {
    method: 'GET',
    path: '/lacak/:tiket',
    handler: (ctx) => {
      const tiket = String(ctx.params.tiket || '').trim().toUpperCase();
      const row = db.prepare('SELECT * FROM letters WHERE UPPER(tiket) = ?').get(tiket);
      if (!row) return lacakPage(ctx, null, true, tiket);
      return lacakPage(ctx, getJson(row.id), false, tiket);
    },
  },

  {
    method: 'GET',
    path: '/verifikasi',
    handler: (ctx) => verifikasiPage(ctx),
  },
  {
    method: 'GET',
    path: '/verifikasi/:kode',
    handler: (ctx) => {
      const kode = String(ctx.params.kode || '').trim().toUpperCase();
      const row = db.prepare('SELECT * FROM letters WHERE UPPER(kode) = ? AND status = ?').get(kode, 'selesai');
      if (!row) return verifikasiPage(ctx, null, true, kode);
      return verifikasiPage(ctx, getJson(row.id), false, kode);
    },
  },

  {
    method: 'GET',
    path: '/terima',
    handler: (ctx) => halamanCariPenerima(ctx, ctx.query.err || '', ctx.query.kode || ''),
  },
  {
    method: 'POST',
    path: '/terima',
    handler: async (ctx) => {
      const { fields } = await readBody(ctx.req);
      const kunci = String(fields.kunci || '').trim();
      if (!kunci) return redirect(ctx.res, '/terima');
      const row = db
        .prepare("SELECT * FROM letters WHERE status = 'selesai' AND (token = ? OR UPPER(kode) = ? OR UPPER(tiket) = ? OR nomor = ?)")
        .get(kunci, kunci.toUpperCase(), kunci.toUpperCase(), kunci);
      if (!row) return redirect(ctx.res, `/terima?err=${encodeURIComponent('Data surat tidak ditemukan. Periksa kembali kode atau nomor tiket Anda.')}&kode=${encodeURIComponent(kunci)}`);
      return redirect(ctx.res, `/terima/${row.token}`);
    },
  },
  {
    method: 'GET',
    path: '/surat/:token',
    handler: (ctx) => {
      const row = db.prepare('SELECT * FROM letters WHERE token = ?').get(String(ctx.params.token || ''));
      if (!row) return html(ctx.res, notFoundSimple(ctx.settings), 404);
      return html(
        ctx.res,
        halamanSurat({
          letter: { ...row, data: dataSurat(row) },
          settings: ctx.settings,
          baseUrl: ctx.baseUrl,
          kembali: ctx.user ? '/saya' : '/',
        })
      );
    },
  },

  {
    method: 'GET',
    path: '/terima/:token',
    handler: (ctx) => {
      const row = db.prepare('SELECT * FROM letters WHERE token = ?').get(String(ctx.params.token || ''));
      if (!row) return html(ctx.res, notFoundSimple(ctx.settings), 404);
      const letter = { ...row, data: dataSurat(row) };
      if (letter.status !== 'selesai') return halamanBelumTerbit(ctx, letter);
      return portalPenerima(ctx, letter);
    },
  },

  {
    method: 'POST',
    path: '/api/terima/:token/kirim',
    handler: async (ctx) => {
      const row = db.prepare('SELECT * FROM letters WHERE token = ?').get(String(ctx.params.token || ''));
      if (!row) return json(ctx.res, { ok: false, pesan: 'Surat tidak ditemukan.' }, 404);
      const lim = rateLimit(`wa:${row.id}:${ipDari(ctx.req)}`, 6, 10 * 60 * 1000);
      if (!lim.allowed) return json(ctx.res, { ok: false, pesan: 'Terlalu banyak permintaan. Coba lagi beberapa menit lagi.' }, 429);
      const letter = { ...row, data: dataSurat(row) };
      const pesan = pesanWA(letter, ctx.settings, ctx.baseUrl);
      const hasil = await kirimWA({ nomor: letter.wa, pesan, settings: ctx.settings, letterId: letter.id });
      return json(ctx.res, { ...hasil, link: hasil.link || waLink(letter.wa, pesan), preview: pesan });
    },
  },

  {
    method: 'POST',
    path: '/api/terima/:token/cetak',
    handler: async (ctx) => {
      const row = db.prepare('SELECT * FROM letters WHERE token = ?').get(String(ctx.params.token || ''));
      if (!row) return json(ctx.res, { ok: false }, 404);
      if (!row.dicetak_at) {
        db.prepare('UPDATE letters SET dicetak_at = ? WHERE id = ?').run(nowISO(), row.id);
        catatLog('penerima', 'cetak_notifikasi', 'letter', row.id, row.tiket);
      }
      return json(ctx.res, { ok: true, dicetak_at: row.dicetak_at || nowISO() });
    },
  },
];

function notFoundSimple(settings) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tidak ditemukan · SIPREL</title><link rel="stylesheet" href="/assets/styles.css"></head>
  <body class="portal"><main class="wrap narrow" style="padding:80px 0;text-align:center">
  <p class="eyebrow">404</p><h1 style="font-size:34px;margin:10px 0">Dokumen tidak ditemukan</h1>
  <p class="muted">Tautan surat mungkin salah atau sudah tidak berlaku.</p>
  <p style="margin-top:24px"><a class="btn btn-primary" href="/">Kembali ke beranda</a></p></main></body></html>`;
}

function halamanBelumTerbit(ctx, letter) {
  const body = `<main class="wrap narrow" style="padding:70px 0;text-align:center">
    <div class="card">
      <div class="status-pending">${icon('clock')}</div>
      <h1 style="font-size:28px;margin:10px 0">Surat belum diterbitkan</h1>
      <p class="muted">Pengajuan <strong>${esc(letter.tiket)}</strong> masih dalam proses. Halaman penerima akan aktif otomatis setelah surat selesai ditandatangani.</p>
      <p style="margin-top:22px"><a class="btn btn-outline" href="/lacak/${esc(letter.tiket)}">Lacak status pengajuan</a></p>
    </div></main>`;
  return html(ctx.res, recipientLayout({ settings: ctx.settings, letter, body, title: 'Surat belum terbit' }));
}

function profilSaya(ctx) {
  const s = ctx.settings;
  const body = `<section class="page-head compact"><div class="wrap">
    <a class="back-link" href="/saya">← Dashboard</a>
    <h1>Profil saya</h1>
  </div></section>
  <section class="section section-tight"><div class="wrap narrow">
    ${flash(ctx.query.ok, 'ok')}${flash(ctx.query.err, 'err')}
    <form class="card form-card" method="post" action="/saya/profil">
      ${csrfField(ctx.user)}
      <div class="fields">
        <div class="field full"><label>Nama lengkap</label><input class="input" name="nama" value="${esc(ctx.user.nama)}" required></div>
        <div class="field half"><label>NIM</label><input class="input" name="nim" value="${esc(ctx.user.nim || '')}"></div>
        <div class="field half"><label>WhatsApp</label><input class="input" name="wa" type="tel" value="${esc(ctx.user.wa || '')}"></div>
        <div class="field half"><label>Email</label><input class="input" value="${esc(ctx.user.email)}" disabled></div>
        <div class="field half"><label>Kata sandi baru <span class="opt">(opsional)</span></label><input class="input" name="password" type="password" minlength="8" placeholder="Kosongkan bila tidak diubah"></div>
      </div>
      <div class="form-foot"><p class="form-consent">${icon('shield')} Perubahan data akan dipakai pada pengajuan berikutnya.</p><button class="btn btn-primary" type="submit">Simpan perubahan</button></div>
    </form>
  </div></section>`;
  return html(ctx.res, publicLayout({ settings: s, user: ctx.user, title: 'Profil', body, active: 'saya' }));
}
