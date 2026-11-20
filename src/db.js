import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { hashPassword, nowISO, todayID } from './util.js';
import { JENIS } from './letters.js';

const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = path.join(DATA_DIR, 'siprel.db');
export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    nim TEXT,
    wa TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'mahasiswa',
    aktif INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );


  CREATE TABLE IF NOT EXISTS penerima (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    nim TEXT,
    wa TEXT,
    password TEXT NOT NULL,
    aktif INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_penerima_wa ON penerima(wa);

  CREATE TABLE IF NOT EXISTS letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tiket TEXT NOT NULL UNIQUE,
    jenis TEXT NOT NULL,
    data TEXT NOT NULL,
    pemohon_id INTEGER,
    penerima_id INTEGER,
    nama TEXT,
    nim TEXT,
    wa TEXT,
    status TEXT NOT NULL DEFAULT 'baru',
    nomor TEXT,
    perihal TEXT,
    tanggal TEXT,
    penandatangan TEXT,
    catatan_pemohon TEXT,
    catatan_admin TEXT,
    token TEXT UNIQUE,
    kode TEXT UNIQUE,
    wa_status TEXT DEFAULT 'belum',
    wa_at TEXT,
    dicetak_at TEXT,
    sumber TEXT DEFAULT 'web',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_letters_status ON letters(status);
  CREATE INDEX IF NOT EXISTS idx_letters_jenis ON letters(jenis);
  CREATE INDEX IF NOT EXISTS idx_letters_pemohon ON letters(pemohon_id);

  CREATE TABLE IF NOT EXISTS arsip (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomor TEXT,
    jenis TEXT,
    nama TEXT,
    nim TEXT,
    prodi TEXT,
    hal TEXT,
    instansi TEXT,
    tanggal TEXT,
    peserta TEXT,
    sumber TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_arsip_nama ON arsip(nama);
  CREATE INDEX IF NOT EXISTS idx_arsip_nomor ON arsip(nomor);

  CREATE TABLE IF NOT EXISTS wa_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    letter_id INTEGER,
    tujuan TEXT,
    status TEXT,
    provider TEXT,
    pesan TEXT,
    respons TEXT,
    at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    aktor TEXT,
    aksi TEXT,
    entitas TEXT,
    entitas_id TEXT,
    detail TEXT,
    at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);


/* ── migrasi akun penerima ke tabel terpisah ──────────────────────────── */

{
  const lama = db.prepare("SELECT * FROM users WHERE role = 'penerima'").all();
  for (const u of lama) {
    if (!db.prepare('SELECT 1 AS x FROM penerima WHERE email = ?').get(u.email)) {
      db.prepare(
        'INSERT INTO penerima (nama, email, nim, wa, password, aktif, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(u.nama, u.email, u.nim, u.wa, u.password, u.aktif, u.created_at);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
  }
}


/* ── pemisahan admin utama & admin jurusan ────────────────────────────── */

{
  const adaSuper = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'").get().n;
  if (!adaSuper) {
    const adminPertama = db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
    if (adminPertama) db.prepare("UPDATE users SET role = 'superadmin' WHERE id = ?").run(adminPertama.id);
  }
}

/* ── migrasi ringan ───────────────────────────────────────────────────── */

{
  const kolom = db.prepare('PRAGMA table_info(letters)').all().map((c) => c.name);
  if (!kolom.includes('perihal')) db.exec('ALTER TABLE letters ADD COLUMN perihal TEXT');
  if (!kolom.includes('penerima_id')) db.exec('ALTER TABLE letters ADD COLUMN penerima_id INTEGER');
}

/* ── settings ──────────────────────────────────────────────────────────── */

export const DEFAULT_SETTINGS = {
  instansi1: 'KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI',
  instansi2: 'UNIVERSITAS CENDERAWASIH',
  fakultas: 'FAKULTAS TEKNIK',
  dept: 'JURUSAN TEKNIK ELEKTRO',
  alamat: 'Jalan Kampwolker Kampus Baru Waena – Jayapura',
  kota: 'Jayapura',
  telepon: '(0967) 572 111',
  email: 'elektro@uncen.ac.id',
  website: 'www.elektro.uncen.ac.id',
  ketua_nama: 'Ir. Suparno, S.T., M.Eng',
  ketua_nip: '19699909 200112 1 001',
  ketua_jabatan: 'Ketua Jurusan Teknik Elektro',
  sekretaris_nama: 'Ir. Ekawati M. Ohee, ST., M.Eng',
  sekretaris_nip: '196908252000032001',
  sekretaris_jabatan: 'Sekretaris Jurusan Teknik Elektro',
  ttd_sekretaris: 'ttd-ekawati.png',
  ttd_ketua: '',
  ttd_aktif: '1',
  nomor_format: '{seq}/{prefix}/{tahun}',
  nomor_prefix: 'UN20.1.6.7.2/PP',
  nomor_pad: '3',
  base_url: '',
  wa_provider: process.env.WA_PROVIDER || '',
  wa_token: process.env.WA_TOKEN || '',
  wa_sender: process.env.WA_SENDER || '',
  wa_api_url: process.env.WA_API_URL || '',
  wa_auto: process.env.WA_AUTO || '0',
  print_note: 'Terima kasih atas perhatian dan kerja sama Anda.',
  loket: 'Loket Administrasi Jurusan Teknik Elektro, Gedung Fakultas Teknik, Kampus Waena, Jayapura',
  admin_wa: '',
  jam_layanan: 'Senin – Jumat, 08.00 – 15.00 WIT',
  syarat: 'Pastikan data yang diajukan sudah benar. Surat yang telah terbit dapat diambil pada loket administrasi jurusan atau dicetak melalui portal penerima.',
  pemeliharaan: '0',
};


/** Batas maksimum total akun (mahasiswa + admin + penerima). */
export const BATAS_AKUN = 1000;

export function jumlahAkun() {
  return db.prepare('SELECT (SELECT COUNT(*) FROM users) + (SELECT COUNT(*) FROM penerima) AS n').get().n;
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(String(key), value === null || value === undefined ? '' : String(value));
}

/* ── log ───────────────────────────────────────────────────────────────── */

export function catatLog(aktor, aksi, entitas = '', entitasId = '', detail = '') {
  db.prepare(
    'INSERT INTO log (aktor, aksi, entitas, entitas_id, detail, at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(String(aktor || 'sistem'), aksi, entitas, String(entitasId ?? ''), detail, nowISO());
}

export function catatWA(letterId, tujuan, status, provider, pesan, respons) {
  db.prepare(
    'INSERT INTO wa_log (letter_id, tujuan, status, provider, pesan, respons, at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(letterId ?? null, tujuan, status, provider, pesan, respons, nowISO());
}

/* ── penomoran ─────────────────────────────────────────────────────────── */

export function nextNomor(settings) {
  const tahun = todayID().slice(0, 4);
  const rows = db.prepare('SELECT nomor FROM letters WHERE nomor IS NOT NULL').all();
  const arsip = db.prepare('SELECT nomor FROM arsip WHERE nomor IS NOT NULL').all();
  let max = 0;
  for (const r of [...rows, ...arsip]) {
    const m = /^(\d{1,4})\s*\//.exec(String(r.nomor || ''));
    if (!m) continue;
    if (!String(r.nomor).includes(`/${tahun}`) && !String(r.nomor).includes(tahun)) continue;
    max = Math.max(max, Number(m[1]));
  }
  const seq = String(max + 1).padStart(Number(settings.nomor_pad || 3), '0');
  const nomor = String(settings.nomor_format || '{seq}/{prefix}/{tahun}')
    .replaceAll('{seq}', seq)
    .replaceAll('{prefix}', settings.nomor_prefix || 'UN20.1.6.7.2/PP')
    .replaceAll('{tahun}', tahun);
  return { nomor, seq: max + 1 };
}

export function buatTiket() {
  const tahun = todayID().slice(0, 4);
  const row = db.prepare("SELECT COUNT(*) AS n FROM letters WHERE tiket LIKE ?").get(`ELK-${tahun}-%`);
  let n = (row?.n || 0) + 1;
  // hindari bentrok bila ada penghapusan data
  for (;;) {
    const tiket = `ELK-${tahun}-${String(n).padStart(4, '0')}`;
    const ada = db.prepare('SELECT 1 AS x FROM letters WHERE tiket = ?').get(tiket);
    if (!ada) return tiket;
    n += 1;
  }
}

export function buatToken() {
  for (;;) {
    const token = crypto.randomBytes(16).toString('base64url');
    if (!db.prepare('SELECT 1 AS x FROM letters WHERE token = ?').get(token)) return token;
  }
}

export function buatKode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let kode = '';
    const buf = crypto.randomBytes(8);
    for (let i = 0; i < 8; i += 1) kode += alphabet[buf[i] % alphabet.length];
    kode = `ELK-${kode}`;
    if (!db.prepare('SELECT 1 AS x FROM letters WHERE kode = ?').get(kode)) return kode;
  }
}

/* ── seeding ───────────────────────────────────────────────────────────── */

function seedSettings() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM settings').get().n;
  if (count > 0) return;
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting(k, v);
}

function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count > 0) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@elektro.uncen.ac.id').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'Admin#2026';
  const nama = process.env.ADMIN_NAME || 'Admin Utama';
  db.prepare(
    'INSERT INTO users (nama, email, password, role, aktif, created_at) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(nama, email, hashPassword(password), 'superadmin', nowISO());
  catatLog('sistem', 'seed_admin', 'user', email, 'Akun administrator awal dibuat.');
}

function seedArsip() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM arsip').get().n;
  if (count > 0) return;
  const file = path.resolve('./data/arsip.json');
  if (!fs.existsSync(file)) return;
  let rows;
  try {
    rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return;
  }
  const ins = db.prepare(
    'INSERT INTO arsip (nomor, jenis, nama, nim, prodi, hal, instansi, tanggal, peserta, sumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const bersih = (v) => (v ? String(v).replace(/\uFFFD/g, '–').trim() : null);
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      ins.run(
        bersih(r.nomor), r.type || r.jenis || null, bersih(r.nama), bersih(r.nim), bersih(r.prodi),
        bersih(r.hal), bersih(r.instansi), r.tanggal || null,
        JSON.stringify(r.peserta || []), bersih(r.source)
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  catatLog('sistem', 'seed_arsip', 'arsip', rows.length, 'Impor arsip surat dari dokumen Word.');
}

function seedDemo() {
  if (String(process.env.SEED_DEMO ?? '1') === '0') return;
  const count = db.prepare('SELECT COUNT(*) AS n FROM letters').get().n;
  if (count > 0) return;

  const demoEmail = 'renaldi@student.uncen.ac.id';
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(demoEmail);
  if (!user) {
    const info = db.prepare(
      'INSERT INTO users (nama, email, nim, wa, password, role, aktif, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    ).run(
      'Renaldi Bryan B. Yepese', demoEmail, '2023061024063', '6282213344556',
      hashPassword('Mahasiswa#2026'), 'mahasiswa', nowISO()
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  const settings = getSettings();
  const now = new Date();
  const isoTgl = (minusHari) => {
    const d = new Date(now.getTime() - minusHari * 86400000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jayapura' }).format(d);
  };

  const demo = [
    {
      jenis: 'AKTIF', status: 'selesai', hari: 2, data: {
        nama: 'Renaldi Bryan B. Yepese', nim: '2023061024063',
        prodi: 'Strata Satu (S1) — Teknik Elektro', semester: 'Gasal 2026/2027',
        keperluan: 'BPJS', tujuan: 'Wakil Dekan I',
      },
      nomor: '601/UN20.1.6.7.2/PP/2026', token: 'demo-penerima-elektro', kode: 'ELK-DEMO2026',
      wa_status: 'terkirim', wa_at: nowISO(),
    },
    {
      jenis: 'DATA_MHS', status: 'diproses', hari: 1, data: {
        nama: 'Renaldi Bryan B. Yepese', nim: '2023061024063',
        prodi: 'Strata Satu (S1) — Teknik Elektro', keperluan: 'Tugas Akhir',
        instansi: 'PT. PLN (Persero) UP3 Jayapura',
        data: 'Trafo 70 KV\nTrafo 150 KV\nJumlah pelanggan per sektor', tujuan: 'Wakil Dekan I',
      },
      nomor: '602/UN20.1.6.7.2/PP/2026',
    },
    {
      jenis: 'KP', status: 'baru', hari: 0, data: {
        peserta: 'Renaldi Bryan B. Yepese | 2023061024063 | S1\nMeslyaldo Semuel Hehahia | 2024061024051 | S1',
        instansi: 'PT. PLN (Persero) UP3 Jayapura', waktu: 'Januari – Maret 2027',
        keperluan: 'Kerja Praktek (KP)', tujuan: 'Wakil Dekan I',
      },
    },
    {
      jenis: 'BEASISWA_TIDAK', status: 'ditolak', hari: 4, data: {
        nama: 'Renaldi Bryan B. Yepese', nim: '2023061024063',
        prodi: 'Strata Satu (S1) — Teknik Elektro', alamat: 'Jln Pasar Youtefa, Jayapura',
        no_hp: '082213344556', tahun_akademik: '2026/2027', tujuan: 'Wakil Dekan III',
      },
      catatan_admin: 'Nomor HP belum terverifikasi. Silakan ajukan ulang dengan nomor aktif.',
    },
  ];

  const ins = db.prepare(`
    INSERT INTO letters (tiket, jenis, data, pemohon_id, nama, nim, wa, status, nomor, perihal, tanggal,
      penandatangan, catatan_admin, token, kode, wa_status, wa_at, sumber, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'web', ?, ?)`);

  demo.forEach((d, i) => {
    const tiket = `ELK-2026-${String(i + 1).padStart(4, '0')}`;
    const tanggal = isoTgl(d.hari);
    const created = new Date(now.getTime() - (d.hari + 1) * 86400000).toISOString();
    const pesertaPertama = String(d.data.peserta || '').split('|')[0]?.trim();
    const nama = d.data.nama || pesertaPertama || user.nama;
    const nim = d.data.nim || String(d.data.peserta || '').split('|')[1]?.trim() || user.nim;
    ins.run(
      tiket, d.jenis, JSON.stringify(d.data), user.id, nama, nim,
      user.wa, d.status, d.nomor || null, JENIS[d.jenis]?.perihal || null, d.status === 'baru' ? null : tanggal,
      d.status === 'baru' ? null : (String(d.jenis).match(/AKTIF|DATA|KP/) ? 'sekretaris' : 'ketua'),
      d.catatan_admin || null, d.token || null, d.kode || null,
      d.wa_status || 'belum', d.wa_at || null, created, created
    );
  });
  catatLog('sistem', 'seed_demo', 'letters', demo.length, 'Surat contoh untuk demo dashboard.');
}


function seedPenerimaDemo() {
  if (String(process.env.SEED_DEMO ?? '1') === '0') return;
  if (db.prepare('SELECT COUNT(*) AS n FROM penerima').get().n > 0) return;
  const adaSurat = db.prepare('SELECT 1 AS x FROM letters WHERE wa = ?').get('6282213344556');
  if (!adaSurat) return;
  db.prepare(
    'INSERT INTO penerima (nama, email, nim, wa, password, aktif, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
  ).run(
    'Renaldi Bryan B. Yepese', 'penerima@elektro.uncen.ac.id', '2023061024063', '6282213344556',
    hashPassword('Penerima#2026'), nowISO()
  );
  catatLog('sistem', 'seed_penerima', 'penerima', 'penerima@elektro.uncen.ac.id', 'Akun demo portal penerima dibuat.');
}


function seedAdminJurusan() {
  if (String(process.env.SEED_DEMO ?? '1') === '0') return;
  const adaSuper = db.prepare("SELECT 1 AS x FROM users WHERE role = 'superadmin'").get();
  if (!adaSuper) return;
  if (db.prepare("SELECT 1 AS x FROM users WHERE role = 'admin'").get()) return;
  const email = (process.env.ADMIN_JURUSAN_EMAIL || 'admin.jurusan@elektro.uncen.ac.id').toLowerCase();
  const password = process.env.ADMIN_JURUSAN_PASSWORD || 'Jurusan#2026';
  if (db.prepare('SELECT 1 AS x FROM users WHERE email = ?').get(email)) return;
  db.prepare('INSERT INTO users (nama, email, password, role, aktif, created_at) VALUES (?, ?, ?, ?, 1, ?)')
    .run('Admin Jurusan Teknik Elektro', email, hashPassword(password), 'admin', nowISO());
  catatLog('sistem', 'seed_admin_jurusan', 'user', email, 'Akun admin jurusan dibuat (terpisah dari admin utama).');
}

seedSettings();
seedAdmin();
seedAdminJurusan();
seedArsip();
seedDemo();
