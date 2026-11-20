import { esc } from './util.js';

/**
 * Definisi seluruh jenis surat yang dipakai Jurusan Teknik Elektro FT UNCEN.
 * Disusun dari 12 dokumen surat pada folder "SURAT - SURAT APLIKASI ELEKTRO".
 */

const STUDENT = (extra = []) => [
  { name: 'nama', label: 'Nama lengkap mahasiswa', type: 'text', required: true, placeholder: 'cth. Renaldi Bryan B. Yepese', half: true },
  { name: 'nim', label: 'NIM', type: 'text', required: true, placeholder: 'cth. 2023061024063', half: true, pattern: '^[0-9]{8,15}$', help: 'Hanya angka, 8–15 digit.' },
  { name: 'prodi', label: 'Program studi', type: 'select', required: true, half: true, options: ['Strata Satu (S1) — Teknik Elektro', 'Diploma III (D-III) — Teknik Elektro', 'Strata Satu (S1) — Teknik Elektro (alih jenjang)'] },
  ...extra,
];

const tujuanField = (options, def) => ({
  name: 'tujuan', label: 'Ditujukan kepada', type: 'select', required: true, half: true, options, default: def,
});

export const JENIS = {
  AKTIF: {
    kode: 'AKTIF',
    nama: 'Surat Keterangan Aktif Kuliah',
    singkat: 'Permohonan surat keterangan aktif kuliah untuk BPJS, beasiswa, atau keperluan administrasi lainnya.',
    kategori: 'Keterangan',
    ikon: 'student',
    warna: 'teal',
    perihal: 'Surat Keterangan Aktif Kuliah',
    penandatangan: 'sekretaris',
    keperluan: 'BPJS',
    fields: STUDENT([
      { name: 'semester', label: 'Semester berjalan', type: 'text', required: true, half: true, default: 'Genap 2025/2026', placeholder: 'cth. Genap 2025/2026' },
      { name: 'keperluan', label: 'Keperluan surat', type: 'text', required: true, half: true, default: 'BPJS', placeholder: 'cth. BPJS / Beasiswa / Pengurusan KIP' },
      tujuanField(['Wakil Dekan I', 'Wakil Dekan III'], 'Wakil Dekan I'),
    ]),
    ringkas: (d) => `${d.nama} · ${d.nim}`,
    badan: (d) => `
      <p>Bersamaan dengan surat ini kami mohon diterbitkan Surat Keterangan Aktif Kuliah. Untuk keperluan <strong>${esc(d.keperluan)}</strong>. Atas nama mahasiswa di bawah ini :</p>
      ${identitas([['NAMA', d.nama], ['NIM', d.nim], ['PROGRAM STUDI', d.prodi]])}
      <p>Demikian kami sampaikan, atas perhatian dan kerja samanya diucapkan terima kasih.</p>`,
    tembusan: ['Mahasiswa yang bersangkutan', 'Arsip'],
  },

  KKN: {
    kode: 'KKN',
    nama: 'Surat Pengantar Permohonan KKN',
    singkat: 'Pengantar permohonan surat KKN mahasiswa kepada instansi/kampung tujuan.',
    kategori: 'Pengantar',
    ikon: 'location',
    warna: 'amber',
    perihal: 'Pengantar Surat Permohonan KKN',
    penandatangan: 'ketua',
    keperluan: 'KKN',
    fields: [
      { name: 'angkatan', label: 'Angkatan mahasiswa', type: 'text', required: true, half: true, placeholder: 'cth. 2023', default: '2023' },
      { name: 'jumlah', label: 'Jumlah mahasiswa', type: 'number', half: true, placeholder: 'cth. 12' },
      { name: 'instansi', label: 'Lokasi / instansi tujuan KKN', type: 'textarea', required: true, placeholder: 'cth. Kepala Kampung Klaisu, Distrik Gresi Selatan, Kabupaten Jayapura, Papua' },
      { name: 'periode', label: 'Periode pelaksanaan', type: 'text', required: true, half: true, default: 'Januari s/d Februari 2027', placeholder: 'cth. Januari s/d Februari 2027' },
      tujuanField(['KASUBAG Akademik', 'Wakil Dekan I'], 'KASUBAG Akademik'),
    ],
    ringkas: (d) => `Angkatan ${d.angkatan} · ${d.instansi}`,
    badan: (d) => `
      <p>Sehubungan dengan kegiatan mahasiswa yaitu Kuliah Kerja Nyata (KKN) Jurusan Teknik Elektro, angkatan ${esc(d.angkatan)}${d.jumlah ? ` sebanyak ${esc(d.jumlah)} orang` : ''}.</p>
      <p>Untuk itu kami mohon agar dibuatkan surat permohonan KKN yang ditujukan kepada :</p>
      <p class="indent"><strong>${esc(d.instansi)}</strong></p>
      <p>Adapun kegiatan KKN akan dilaksanakan pada <strong>${esc(d.periode)}</strong>.</p>
      <p>Demikian surat pengantar ini dibuat, agar dapat dipergunakan sebagaimana mestinya.</p>`,
    tembusan: ['Arsip'],
  },

  UKT_BAYAR: {
    kode: 'UKT_BAYAR',
    nama: 'Surat Pengantar Pembayaran UKT',
    singkat: 'Keterangan bagi mahasiswa untuk melakukan pembayaran UKT pada semester berjalan.',
    kategori: 'UKT',
    ikon: 'wallet',
    warna: 'blue',
    perihal: 'Pembayaran UKT Semester Genap TA 2025/2026',
    penandatangan: 'ketua',
    keperluan: 'Pembayaran UKT',
    fields: STUDENT([
      { name: 'semester_ta', label: 'Semester / tahun akademik', type: 'text', required: true, default: 'Genap TA 2025/2026', half: true },
      tujuanField(['KASUBAG Akademik', 'Bagian Keuangan Fakultas Teknik'], 'KASUBAG Akademik'),
    ]),
    ringkas: (d) => `${d.nama} · ${d.nim}`,
    badan: (d) => `
      <p>Yang bertanda tangan di bawah ini :</p>
      ${identitas([['NAMA', 'Ir. Suparno, S.T., M.Eng'], ['NIP', '19699909 200112 1 001'], ['JABATAN', 'Ketua Jurusan Teknik Elektro']])}
      <p>Menyatakan bahwa mahasiswa yang namanya tertera di bawah ini :</p>
      ${identitas([['NAMA', d.nama], ['NIM', d.nim], ['PROGRAM STUDI', d.prodi]])}
      <p>Adapun surat keterangan ini dibuat untuk melakukan pembayaran UKT <strong>${esc(d.semester_ta)}</strong>.</p>
      <p>Demikian surat ini dibuat untuk dipergunakan sebagaimana mestinya.</p>`,
    tembusan: ['Mahasiswa yang bersangkutan', 'Arsip'],
  },

  UKT_POTONG: {
    kode: 'UKT_POTONG',
    nama: 'Permohonan Pemotongan UKT',
    singkat: 'Permohonan pemotongan UKT bagi mahasiswa yang telah menyelesaikan perkuliahan tanpa nilai E.',
    kategori: 'UKT',
    ikon: 'percent',
    warna: 'blue',
    perihal: 'Surat Permohonan Pemotongan UKT',
    penandatangan: 'ketua',
    keperluan: 'Pemotongan UKT',
    fields: STUDENT([
      { name: 'sks', label: 'Jumlah SKS yang telah diselesaikan', type: 'number', required: true, half: true, placeholder: 'cth. 141' },
      { name: 'persentase', label: 'Persentase pemotongan (%)', type: 'number', required: true, half: true, default: '50' },
      { name: 'nilai_e', label: 'Catatan nilai E', type: 'select', half: true, options: ['Tidak ada nilai E', 'Terdapat nilai E (lihat catatan)'] },
      tujuanField(['KASUBAG Akademik', 'Bagian Keuangan Fakultas Teknik'], 'KASUBAG Akademik'),
    ]),
    ringkas: (d) => `${d.nama} · ${d.sks} SKS · potong ${d.persentase}%`,
    badan: (d) => `
      <p>Sehubungan dengan mahasiswa telah menyelesaikan perkuliahan dengan jumlah SKS <strong>${esc(d.sks)}</strong> ${esc(d.nilai_e || 'tidak ada nilai E')}. Adapun mahasiswa tersebut adalah :</p>
      ${identitas([['NAMA', d.nama], ['NIM', d.nim], ['JURUSAN/PRODI', d.prodi]])}
      <p>Memberikan keterangan kepada Kasubag Akademik agar dibuatkan surat pemotongan UKT sebesar <strong>${esc(d.persentase)}%</strong>.</p>
      <p>Demikian surat permohonan ini dibuat, atas perhatiannya diucapkan terima kasih.</p>`,
    tembusan: ['Mahasiswa yang bersangkutan', 'Arsip'],
  },


  UKT_CICILAN: {
    kode: 'UKT_CICILAN',
    nama: 'Permohonan Cicilan UKT Mahasiswa',
    singkat: 'Permohonan pembayaran UKT secara mengangsur bagi mahasiswa yang membutuhkan keringanan.',
    kategori: 'UKT',
    ikon: 'wallet',
    warna: 'blue',
    perihal: 'Permohonan Cicilan UKT Mahasiswa',
    penandatangan: 'ketua',
    keperluan: 'Cicilan UKT',
    fields: STUDENT([
      { name: 'semester_ta', label: 'Semester / tahun akademik', type: 'text', required: true, half: true, default: 'Gasal 2026/2027' },
      { name: 'jumlah_cicilan', label: 'Jumlah angsuran', type: 'select', half: true, options: ['2 kali', '3 kali', '4 kali'], default: '2 kali' },
      {
        name: 'alasan', label: 'Alasan / keterangan mahasiswa', type: 'textarea', required: true, rows: 3,
        default: 'Mahasiswa yang bersangkutan berlatar belakang dari keluarga yang kurang mampu, sehingga mengajukan keringanan pembayaran UKT secara mengangsur.',
      },
      tujuanField(['Wakil Dekan I', 'KASUBAG Akademik'], 'Wakil Dekan I'),
    ]),
    ringkas: (d) => `${d.nama} · ${d.nim} · ${d.jumlah_cicilan || '2 kali'}`,
    badan: (d) => `
      <p>Dengan ini kami mengajukan permohonan <strong>cicilan UKT</strong> mahasiswa dengan keterangan sebagai berikut :</p>
      ${identitas([['NAMA', d.nama], ['NIM', d.nim], ['PRODI/JURUSAN', d.prodi], ['FAKULTAS', 'TEKNIK']])}
      <p>${esc(d.alasan)}</p>
      <p>Adapun pembayaran UKT akan diangsur sebanyak <strong>${esc(d.jumlah_cicilan || '2 kali')}</strong> pada <strong>${esc(d.semester_ta)}</strong>.</p>
      <p>Demikian permohonan kami, atas perhatiannya disampaikan terima kasih.</p>`,
    tembusan: ['Mahasiswa yang bersangkutan', 'Arsip'],
  },

  DATA_MHS: {
    kode: 'DATA_MHS',
    nama: 'Surat Pengantar Pengambilan Data (Mahasiswa)',
    singkat: 'Pengantar pengambilan data Tugas Akhir mahasiswa pada instansi/perusahaan.',
    kategori: 'Penelitian',
    ikon: 'database',
    warna: 'violet',
    perihal: 'Surat Permohonan Pengambilan Data',
    penandatangan: 'sekretaris',
    keperluan: 'Pengambilan data Tugas Akhir',
    fields: STUDENT([
      { name: 'keperluan', label: 'Keperluan pengambilan data', type: 'text', half: true, default: 'Tugas Akhir' },
      { name: 'instansi', label: 'Instansi yang dituju', type: 'text', required: true, placeholder: 'cth. PT. PLN (Persero) UP3 Jayapura' },
      { name: 'data', label: 'Data yang dibutuhkan', type: 'textarea', required: true, placeholder: 'Satu data per baris, cth.\nTrafo 70 KV\nTrafo 150 KV\nKonsumsi listrik per sektor' },
      tujuanField(['Wakil Dekan I'], 'Wakil Dekan I'),
    ]),
    ringkas: (d) => `${d.nama} · ${d.instansi}`,
    badan: (d) => `
      <p>Bersama surat ini kami mohon kiranya dapat memberikan surat pengantar pengambilan data untuk keperluan <strong>${esc(d.keperluan || 'Tugas Akhir')}</strong>, bagi mahasiswa di bawah ini :</p>
      ${identitas([['NAMA', d.nama], ['NIM', d.nim], ['JURUSAN/PRODI', d.prodi]])}
      <p>Ditujukan kepada : <strong>${esc(d.instansi)}</strong></p>
      <p>Data yang dimohonkan :</p>
      ${daftar(d.data)}
      <p>Demikian surat permohonan ini kami buat, atas kerja samanya diucapkan terima kasih.</p>`,
    tembusan: ['Mahasiswa yang bersangkutan', 'Arsip'],
  },

  DATA_DOSEN: {
    kode: 'DATA_DOSEN',
    nama: 'Surat Pengantar Pengambilan Data (Dosen)',
    singkat: 'Pengantar pengambilan data penelitian dosen pada instansi/perusahaan.',
    kategori: 'Penelitian',
    ikon: 'database',
    warna: 'violet',
    perihal: 'Surat Permohonan Pengambilan Data',
    penandatangan: 'sekretaris',
    keperluan: 'Penelitian Dosen',
    fields: [
      { name: 'nama', label: 'Nama dosen', type: 'text', required: true, half: true, placeholder: 'cth. Ir. Ekawati M. Ohee, ST., M.Eng' },
      { name: 'nidn', label: 'NIDN / NIP', type: 'text', half: true, placeholder: 'cth. 196908252000032001' },
      { name: 'jabatan', label: 'Jabatan', type: 'text', half: true, default: 'Dosen Jurusan Teknik Elektro' },
      { name: 'lampiran', label: 'Jumlah lampiran', type: 'text', half: true, default: '5 lembar' },
      { name: 'instansi', label: 'Instansi yang dituju', type: 'text', required: true, placeholder: 'cth. General Manager PT. PLN (Persero) UIW Papua dan Papua Barat' },
      { name: 'data', label: 'Data yang dimohonkan', type: 'textarea', required: true, placeholder: 'Satu data per baris' },
      tujuanField(['Wakil Dekan I'], 'Wakil Dekan I'),
    ],
    ringkas: (d) => `${d.nama} · ${d.instansi}`,
    badan: (d) => `
      <p>Bersama surat ini kami mohon kiranya dapat memberikan surat pengantar pengambilan data untuk keperluan melaksanakan Dharma Penelitian sebagai dosen, bagi dosen di bawah ini :</p>
      ${identitas([['NAMA', d.nama], ['NIDN/NIP', d.nidn || '-'], ['JABATAN', d.jabatan || 'Dosen Jurusan Teknik Elektro']])}
      <p>Ditujukan kepada : <strong>${esc(d.instansi)}</strong></p>
      <p>Data yang dimohonkan :</p>
      ${daftar(d.data)}
      <p>Demikian surat permohonan ini kami buat, atas kerja samanya diucapkan terima kasih.</p>`,
    tembusan: ['Dosen yang bersangkutan', 'Arsip'],
  },

  KP: {
    kode: 'KP',
    nama: 'Surat Pengantar Kerja Praktek / Magang',
    singkat: 'Pengantar Kerja Praktek atau Magang bagi satu atau beberapa mahasiswa sekaligus.',
    kategori: 'Pengantar',
    ikon: 'briefcase',
    warna: 'amber',
    perihal: 'Surat Pengantar Kerja Praktek/Magang',
    penandatangan: 'sekretaris',
    keperluan: 'Kerja Praktek',
    fields: [
      { name: 'peserta', label: 'Daftar mahasiswa', type: 'textarea', required: true, rows: 4, help: 'Satu mahasiswa per baris dengan format: Nama | NIM | Program Studi', placeholder: 'Nurhanik Masyhuroh | 2023061024014 | S1\nMaulinda Eka Apryani | 2023061024041 | S1' },
      { name: 'instansi', label: 'Instansi tujuan', type: 'text', required: true, placeholder: 'cth. PT. PLN (Persero) UP3 Jayapura' },
      { name: 'waktu', label: 'Waktu pelaksanaan', type: 'text', required: true, half: true, default: 'Januari – Maret 2027' },
      { name: 'keperluan', label: 'Jenis kegiatan', type: 'select', half: true, options: ['Kerja Praktek (KP)', 'Magang (Pengalaman Kerja)'], default: 'Kerja Praktek (KP)' },
      tujuanField(['Wakil Dekan I', 'Dekan Fakultas Teknik'], 'Wakil Dekan I'),
    ],
    ringkas: (d) => `${pca(d.peserta).length} mahasiswa · ${d.instansi}`,
    badan: (d) => `
      <p>Bersama ini kami mohon untuk dapat dibuatkan Surat <strong>${esc(d.keperluan || 'Kerja Praktek (KP)')}</strong> atas nama mahasiswa di bawah ini :</p>
      ${tabelPeserta(d.peserta)}
      <p>Ditujukan kepada : <strong>${esc(d.instansi)}</strong></p>
      <p>Waktu pelaksanaan : <strong>${esc(d.waktu)}</strong></p>
      <p>Demikian permohonan kami, atas perhatian dan kerja samanya diucapkan terima kasih.</p>`,
    tembusan: ['Mahasiswa yang bersangkutan', 'Arsip'],
  },

  PINDAH: {
    kode: 'PINDAH',
    nama: 'Permohonan Pindah Kuliah',
    singkat: 'Pernyataan tidak keberatan atas permohonan pindah kuliah mahasiswa ke perguruan tinggi lain.',
    kategori: 'Akademik',
    ikon: 'transfer',
    warna: 'rose',
    perihal: 'Permohonan Pindah Kuliah',
    penandatangan: 'ketua',
    keperluan: 'Pindah Kuliah',
    fields: STUDENT([
      { name: 'asal_pt', label: 'Asal perguruan tinggi', type: 'text', required: true, half: true, default: 'Teknik Elektro, Universitas Cenderawasih' },
      { name: 'tujuan_pt', label: 'Perguruan tinggi tujuan', type: 'text', required: true, placeholder: 'cth. FKIP Universitas Terbuka (UT)' },
      { name: 'sikap', label: 'Sikap jurusan', type: 'select', half: true, options: ['Tidak Keberatan', 'Keberatan'], default: 'Tidak Keberatan' },
      tujuanField(['Dekan Fakultas Teknik', 'Wakil Dekan I'], 'Dekan Fakultas Teknik'),
    ]),
    ringkas: (d) => `${d.nama} · pindah ke ${d.tujuan_pt}`,
    badan: (d) => `
      <p>Sehubungan dengan permohonan pindah kuliah atas nama mahasiswa di bawah ini :</p>
      ${identitas([['NAMA', d.nama], ['NIM', d.nim], ['PRODI', d.prodi], ['ASAL PERGURUAN TINGGI', d.asal_pt]])}
      <p>Yang bermaksud untuk pindah ke <strong>${esc(d.tujuan_pt)}</strong>, maka kami menyampaikan bahwa kami pada dasarnya <strong>${esc(d.sikap || 'Tidak Keberatan')}</strong> dengan permohonan tersebut.</p>
      <p>Demikian kami sampaikan, atas perhatiannya diucapkan terima kasih.</p>`,
    tembusan: ['Wakil Dekan I FT UNCEN', 'Kabag TU', 'Kasubag Akademik', 'Arsip'],
  },

  BEASISWA_TIDAK: {
    kode: 'BEASISWA_TIDAK',
    nama: 'Surat Pernyataan Tidak Menerima Beasiswa',
    singkat: 'Surat pernyataan mahasiswa bahwa tidak sedang menerima beasiswa dari pihak lain.',
    kategori: 'Keterangan',
    ikon: 'shield',
    warna: 'teal',
    perihal: 'Tidak Menerima Beasiswa dari Pihak Lain',
    penandatangan: 'ketua',
    keperluan: 'Pernyataan Beasiswa',
    fields: STUDENT([
      { name: 'alamat', label: 'Alamat tempat tinggal', type: 'text', placeholder: 'cth. Jln Pasar Youtefa, Jayapura' },
      { name: 'no_hp', label: 'Nomor HP mahasiswa', type: 'tel', half: true, placeholder: 'cth. 082199255839' },
      { name: 'tahun_akademik', label: 'Tahun akademik', type: 'text', required: true, half: true, default: '2025/2026' },
      tujuanField(['Wakil Dekan III'], 'Wakil Dekan III'),
    ]),
    ringkas: (d) => `${d.nama} · TA ${d.tahun_akademik}`,
    badan: (d) => `
      <p>Saya yang bertanda tangan di bawah ini :</p>
      ${identitas([['NAMA', d.nama], ['NIM', d.nim], ['PROGRAM STUDI', d.prodi], ['ALAMAT', d.alamat || '-'], ['NO. HP', d.no_hp || '-']])}
      <p>Dengan ini menyatakan bahwa saya <strong>tidak sedang menerima beasiswa</strong> dari pihak mana pun pada tahun akademik <strong>${esc(d.tahun_akademik)}</strong> hingga saat ini.</p>
      <p>Apabila di kemudian hari saya terbukti menerima beasiswa lain secara bersamaan, saya bersedia menerima sanksi sesuai ketentuan yang berlaku dan mengembalikan dana beasiswa yang telah diberikan.</p>
      <p>Demikian surat pernyataan ini saya buat dengan sebenar-benarnya untuk dipergunakan sebagaimana mestinya.</p>`,
    tembusan: ['Arsip'],
  },
};

/* ── helper render badan surat ─────────────────────────────────────────── */

function identitas(pairs) {
  return `<table class="identitas">
    ${pairs
      .map(
        ([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="s">:</td><td class="v">${esc(v || '-')}</td></tr>`
      )
      .join('')}
  </table>`;
}

function daftar(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!lines.length) return '';
  return `<ol class="daftar-data">${lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`;
}

/** Parse daftar peserta "Nama | NIM | Prodi" per baris. */
export function pca(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.split('|').map((x) => x.trim()))
    .filter((parts) => parts[0])
    .map((parts, i) => ({ no: i + 1, nama: parts[0], nim: parts[1] || '', prodi: parts[2] || '' }));
}

function tabelPeserta(text) {
  const rows = pca(text);
  if (!rows.length) return '';
  return `<table class="tabel-peserta">
    <thead><tr><th style="width:8%">NO</th><th>NAMA</th><th>NIM</th><th style="width:26%">PROGRAM STUDI</th></tr></thead>
    <tbody>${rows
      .map(
        (r) =>
          `<tr><td class="c">${r.no}</td><td>${esc(r.nama)}</td><td class="c">${esc(r.nim)}</td><td>${esc(r.prodi)}</td></tr>`
      )
      .join('')}</tbody>
  </table>`;
}

export const JENIS_LIST = Object.values(JENIS);

/** Jenis surat yang sedang dibuka untuk pengajuan publik. */
export function jenisAktif(settings = {}) {
  const nonaktif = String(settings.jenis_nonaktif || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return JENIS_LIST.filter((j) => !nonaktif.includes(j.kode));
}

export function jenisByKode(kode) {
  return JENIS[kode] || null;
}

/** Validasi data formulir terhadap definisi field. */
export function validasiData(kode, body) {
  const jenis = jenisByKode(kode);
  if (!jenis) return { errors: ['Jenis surat tidak dikenal.'], data: {} };
  const errors = [];
  const data = {};
  for (const f of jenis.fields) {
    const raw = body[f.name];
    const value = Array.isArray(raw) ? raw.join('\n') : String(raw ?? '').trim();
    data[f.name] = value;
    if (f.required && !value) errors.push(`${f.label} wajib diisi.`);
    if (f.pattern && value && !new RegExp(f.pattern).test(value)) errors.push(`${f.label} tidak valid.`);
    if (f.type === 'number' && value && !/^\d+$/.test(value)) errors.push(`${f.label} harus berupa angka.`);
  }
  if (kode === 'KP' && data.peserta) {
    const rows = pca(data.peserta);
    if (!rows.length) errors.push('Daftar mahasiswa minimal satu baris.');
    for (const r of rows) {
      if (r.nim && !/^\d{8,15}$/.test(r.nim)) errors.push(`NIM "${r.nim}" pada daftar mahasiswa tidak valid.`);
    }
  }
  return { errors, data };
}

/** Ringkasan satu baris untuk tabel daftar surat. */
export function ringkasSurat(letter) {
  try {
    const jenis = jenisByKode(letter.jenis);
    const data = typeof letter.data === 'string' ? JSON.parse(letter.data) : letter.data || {};
    if (!jenis) return '-';
    return jenis.ringkas(data) || '-';
  } catch {
    return '-';
  }
}

/** Susun pesan WhatsApp pemberitahuan surat. */
export function pesanWA(letter, settings, baseUrl) {
  const data = typeof letter.data === 'string' ? JSON.parse(letter.data || '{}') : letter.data || {};
  const nama = (data.nama || letter.nama || 'Mahasiswa').split(' ').slice(0, 3).join(' ');
  const perihal = letter.perihal || JENIS[letter.jenis]?.perihal || 'Surat Keterangan';
  const tgl = letter.tanggal;
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  let tanggal = '-';
  if (tgl) {
    const [y, m, d] = String(tgl).split('-');
    tanggal = `${Number(d)} ${bulan[Number(m) - 1]} ${y}`;
  }
  void baseUrl;
  return [
    `*PEMBERITAHUAN SURAT — ${String(settings.dept || 'JURUSAN TEKNIK ELEKTRO').toUpperCase()}*`,
    '',
    `Halo *${nama}*, pengajuan surat Anda telah selesai diproses.`,
    '',
    `📄 *${perihal}*`,
    `🔢 No. Surat : ${letter.nomor || '-'}`,
    `📅 Tanggal : ${tanggal}`,
    `✅ Status : SELESAI`,
    '',
    `Kode verifikasi: *${letter.kode || '-'}*`,
    '',
    `Simpan kode verifikasi tersebut. Sesuai ketentuan, surat hanya dapat dilihat dan dicetak oleh penerima melalui Portal Penerima dengan akun penerima. Tautan surat tidak dikirim melalui WhatsApp.`,
    '',
    settings.print_note || 'Terima kasih atas perhatian Anda.',
    `— ${settings.dept || 'Jurusan Teknik Elektro'}`,
  ].join('\n');
}


/** Pesan WhatsApp untuk akun penerima (bukan pemohon). */
export function pesanWAPenerima(letter, akun, settings, baseUrl) {
  const data = typeof letter.data === 'string' ? JSON.parse(letter.data || '{}') : letter.data || {};
  const nama = String(akun?.nama || 'Penerima').split(' ').slice(0, 2).join(' ');
  const untuk = data.nama || letter.nama || '-';
  const perihal = letter.perihal || JENIS[letter.jenis]?.perihal || 'Surat Keterangan';
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  let tanggal = '-';
  if (letter.tanggal) {
    const [y, m, d] = String(letter.tanggal).split('-');
    tanggal = `${Number(d)} ${bulan[Number(m) - 1]} ${y}`;
  }
  return [
    `*PEMBERITAHUAN SURAT — ${String(settings.dept || 'JURUSAN TEKNIK ELEKTRO').toUpperCase()}*`,
    '',
    `Halo *${nama}*, ada surat baru yang ditujukan untuk Anda.`,
    '',
    `📄 *${perihal}*`,
    `👤 Untuk : ${untuk}`,
    `🔢 No. Surat : ${letter.nomor || '-'}`,
    `📅 Tanggal : ${tanggal}`,
    `✅ Status : SELESAI`,
    '',
    `Kode verifikasi: *${letter.kode || '-'}*`,
    '',
    `Buka Portal Penerima untuk melihat dan mencetak surat:`,
    `${baseUrl}/penerima`,
    '',
    settings.print_note || 'Terima kasih atas perhatian Anda.',
    `— ${settings.dept || 'Jurusan Teknik Elektro'}`,
  ].join('\n');
}

/** Susun teks pengingat status untuk pemohon. */
export function pesanStatus(letter, baseUrl) {
  const label = {
    baru: 'menunggu verifikasi petugas',
    diproses: 'sedang diproses',
    selesai: 'telah terbit',
    ditolak: 'ditolak',
  }[letter.status] || letter.status;
  return [
    `*Status Pengajuan Surat*`,
    `Tiket: ${letter.tiket}`,
    `Jenis: ${JENIS[letter.jenis]?.nama || letter.jenis}`,
    `Status: ${label.toUpperCase()}`,
    letter.status === 'selesai' && letter.token ? `Notifikasi: ${baseUrl}/terima/${letter.token}` : '',
    `Lacak: ${baseUrl}/lacak/${letter.tiket}`,
  ].filter(Boolean).join('\n');
}
