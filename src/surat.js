import { esc, tanggalID } from './util.js';
import { JENIS, jenisByKode } from './letters.js';
import { icon } from './ui.js';

export function dataSurat(letter) {
  try {
    return typeof letter.data === 'string' ? JSON.parse(letter.data || '{}') : letter.data || {};
  } catch {
    return {};
  }
}

function pejabat(letter, settings) {
  const peran = letter.penandatangan === 'ketua' ? 'ketua' : 'sekretaris';
  return {
    peran,
    nama: settings[`${peran}_nama`] || (peran === 'ketua' ? 'Ketua Jurusan Teknik Elektro' : 'Sekretaris Jurusan Teknik Elektro'),
    nip: settings[`${peran}_nip`] || '-',
    jabatan: settings[`${peran}_jabatan`] || (peran === 'ketua' ? 'Ketua Jurusan Teknik Elektro' : 'Sekretaris Jurusan Teknik Elektro'),
  };
}

function alamatTujuan(tujuan) {
  const t = String(tujuan || 'Wakil Dekan I').trim();
  if (/^dekan/i.test(t)) return [t, 'Di', 'Tempat'];
  if (/kasubag/i.test(t)) return [t, 'Fakultas Teknik Universitas Cenderawasih', 'Di', 'Tempat'];
  return [t, 'Fakultas Teknik Universitas Cenderawasih', 'Di', 'Tempat'];
}

function kop(settings) {
  return `<div class="kop">
    <img class="kop-logo" src="/assets/logo-uncen.png" alt="Logo Universitas Cenderawasih">
    <div class="kop-teks">
      <div class="kop-k1">${esc(settings.instansi1)}</div>
      <div class="kop-k2">${esc(settings.instansi2)}</div>
      <div class="kop-k3">${esc(settings.fakultas)}</div>
      <div class="kop-k4">${esc(settings.dept)}</div>
      <div class="kop-alamat">${esc(settings.alamat)}</div>
    </div>
  </div>
  <div class="kop-garis"><span></span><span></span></div>`;
}

/** Lembar surat resmi ukuran A4. */
export function lembarSurat(letter, settings, baseUrl = '') {
  const jenis = jenisByKode(letter.jenis);
  const d = dataSurat(letter);
  const p = pejabat(letter, settings);
  if (!jenis) return '<p>Jenis surat tidak dikenal.</p>';
  const tujuan = d.tujuan || jenis.fields.find((f) => f.name === 'tujuan')?.default || 'Wakil Dekan I';
  const tanggal = letter.tanggal || new Date().toISOString().slice(0, 10);
  const tembusan = jenis.tembusan || [];
  const verifUrl = baseUrl && letter.kode ? `${baseUrl}/verifikasi/${letter.kode}` : '';
  const berkasTtd = settings.ttd_aktif === '0' ? '' : String(settings[p.peran === 'ketua' ? 'ttd_ketua' : 'ttd_sekretaris'] || '').trim();

  return `<article class="sheet" id="lembar-surat">
    ${kop(settings)}
    <div class="sheet-meta">
      <div class="meta-kiri">
        <table class="meta-table">
          <tr><td>Nomor</td><td>:</td><td>${esc(letter.nomor || '………………/UN20.1.6.7.2/PP/' + String(tanggal).slice(0, 4))}</td></tr>
          <tr><td>Lampiran</td><td>:</td><td>${esc(d.lampiran || '-')}</td></tr>
          <tr><td>Perihal</td><td>:</td><td><strong>${esc(letter.perihal || jenis.perihal)}</strong></td></tr>
        </table>
      </div>
      <div class="meta-kanan">${esc(settings.kota)}, ${esc(tanggalID(tanggal))}</div>
    </div>
    <div class="sheet-tujuan">
      <p>Kepada Yth,</p>
      ${alamatTujuan(tujuan).map((x) => `<p>${esc(x)}</p>`).join('')}
    </div>
    <div class="sheet-badan">
      <p>Dengan hormat,</p>
      ${jenis.badan(d)}
      <div class="sheet-ttd">
        <p class="ttd-jabatan">${esc(p.jabatan)}</p>
        <div class="ttd-area">
          <div class="ttd-ruang">${berkasTtd ? `<img class="ttd-img" src="/assets/${esc(berkasTtd)}" alt="Tanda tangan ${esc(p.nama)}">` : ''}</div>
          <p class="ttd-nama">${esc(p.nama)}</p>
          <p class="ttd-nip">NIP. ${esc(p.nip)}</p>
        </div>
      </div>
    </div>
    ${tembusan.length
      ? `<div class="sheet-tembusan">
          <p>Tembusan :</p>
          <ol>${tembusan.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
        </div>`
      : ''}
    <div class="sheet-foot">
      <div class="foot-verif">
        ${icon('shield')}
        <span>Dokumen ini diterbitkan secara elektronik melalui SIPREL ${esc(settings.dept)}.
        ${letter.kode ? `Kode verifikasi <strong>${esc(letter.kode)}</strong>.` : ''}
        ${verifUrl ? `Pindai/akses <em>${esc(verifUrl)}</em> untuk memeriksa keaslian.` : ''}</span>
      </div>
    </div>
  </article>`;
}

/** Halaman penuh surat dengan toolbar (bisa dicetak). */
export function halamanSurat({ letter, settings, baseUrl, kembali = '/saya', mode = 'pemohon' }) {
  const jenis = jenisByKode(letter.jenis);
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(letter.perihal || jenis?.perihal || 'Surat')} · ${esc(letter.nomor || '')}</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/styles.css">
<script src="/assets/app.js" defer></script>
</head>
<body class="doc-view">
<div class="doc-bar no-print">
  <a class="btn btn-ghost btn-sm" href="${esc(kembali)}">← Kembali</a>
  <div class="doc-bar-title">
    <strong>${esc(jenis?.nama || 'Surat')}</strong>
    <span>${esc(letter.nomor || 'Draft')} · ${esc(letter.kode || '')}</span>
  </div>
  <div class="doc-bar-actions">
    <button class="btn btn-outline btn-sm" type="button" data-print>${icon('print')} Cetak</button>
    <a class="btn btn-primary btn-sm" href="/terima/${esc(letter.token)}">${icon('send')} Portal penerima</a>
  </div>
</div>
<div class="doc-stage">
  ${lembarSurat(letter, settings, baseUrl)}
  <p class="doc-hint no-print">Gunakan <strong>Cetak</strong> lalu pilih “Simpan sebagai PDF” untuk mengunduh surat.</p>
</div>
<script>document.querySelectorAll('[data-print]').forEach(function(b){b.addEventListener('click',function(){window.print();});});</script>
</body>
</html>`;
}

function barcodeStrip(seed = '') {
  const src = String(seed || 'ELK');
  let bars = '';
  for (let i = 0; i < 42; i += 1) {
    const code = src.charCodeAt(i % src.length) + i * 7;
    bars += `<i style="width:${1 + (code % 3)}px;opacity:${code % 2 ? 0.75 : 1}"></i>`;
  }
  return `<div class="barcode" aria-hidden="true">${bars}</div>`;
}

/** Kartu notifikasi A5 untuk penerima surat. */
export function lembarNotifikasi(letter, settings, baseUrl) {
  const jenis = jenisByKode(letter.jenis);
  const d = dataSurat(letter);
  const tanggal = letter.tanggal || '';
  const nama = d.nama || letter.nama || (String(d.peserta || '').split('|')[0] || '').trim() || 'Penerima';
  const nim = d.nim || letter.nim || '';
  return `<article class="notif-sheet" id="notif-sheet">
    <div class="notif-kop">
      <img src="/assets/logo-uncen.png" alt="Logo Uncen">
      <div>
        <div class="nk1">${esc(settings.instansi2)}</div>
        <div class="nk2">${esc(settings.fakultas)} · ${esc(settings.dept)}</div>
        <div class="nk3">${esc(settings.alamat)}</div>
      </div>
    </div>
    <div class="notif-title">
      <h2>Notifikasi Penerimaan Surat</h2>
      <p>No. ${esc(letter.tiket)}</p>
    </div>
    <p class="notif-pembuka">Dengan hormat, bersama ini kami sampaikan bahwa surat atas nama Saudara/i telah <strong>selesai diproses dan siap dicetak/diambil</strong>.</p>
    <table class="notif-detail">
      <tr><th>Nama</th><td>${esc(nama)}</td></tr>
      <tr><th>NIM</th><td>${esc(nim || '-')}</td></tr>
      <tr><th>Jenis layanan</th><td>${esc(jenis?.nama || letter.jenis)}</td></tr>
      <tr><th>Nomor surat</th><td><strong>${esc(letter.nomor || '-')}</strong></td></tr>
      <tr><th>Tanggal surat</th><td>${esc(tanggalID(tanggal))}</td></tr>
      <tr><th>Perihal</th><td>${esc(letter.perihal || jenis?.perihal || '-')}</td></tr>
      <tr><th>Loket pengambilan</th><td>${esc(settings.loket)}</td></tr>
    </table>
    <div class="notif-verif">
      ${barcodeStrip(letter.kode || letter.tiket)}
      <div>
        <div class="nv-kode">${esc(letter.kode || '-')}</div>
        <div class="nv-url">${esc(baseUrl)}/verifikasi/${esc(letter.kode || '')}</div>
      </div>
    </div>
    <p class="notif-catatan">${esc(settings.print_note)} Notifikasi ini sah sebagai bukti penerimaan surat dan dapat ditunjukkan kepada petugas administrasi.</p>
    <div class="notif-ttd">
      <div class="ttd-penerima">
        <span>Penerima / Kuasa</span>
        <div class="ttd-garis"></div>
        <small>Nama &amp; tanggal terima</small>
      </div>
      <div class="ttd-jurusan">
        <span>${esc(settings.kota)}, ${esc(tanggalID(new Date().toISOString().slice(0, 10)))}</span>
        <small>${esc(settings.dept)}</small>
        <div class="ttd-garis"></div>
        <small>Petugas Administrasi</small>
      </div>
    </div>
  </article>`;
}

export { JENIS };
