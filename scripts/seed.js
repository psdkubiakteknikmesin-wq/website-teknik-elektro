import { loadEnv } from '../src/env.js';

loadEnv();

const { db, getSettings } = await import('../src/db.js');

const settings = getSettings();
const jumlah = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

console.log('');
console.log('  SIPREL — pemeriksaan data');
console.log('  ─────────────────────────────');
console.log(`  Pengguna   : ${jumlah('users')}`);
console.log(`  Surat      : ${jumlah('letters')}`);
console.log(`  Arsip      : ${jumlah('arsip')}`);
console.log('  Jenis      : 9 layanan');
console.log(`  Admin      : ${process.env.ADMIN_EMAIL || 'admin@elektro.uncen.ac.id'}`);
console.log(`  Nomor urut : ${settings.nomor_format.replace('{seq}', '…').replace('{prefix}', settings.nomor_prefix).replace('{tahun}', String(new Date().getFullYear()))}`);
console.log('');
console.log('  Database siap. Jalankan `npm start` untuk membuka aplikasi.');
console.log('');
