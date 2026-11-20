# ⚡ SIPREL — Sistem Informasi Persuratan Teknik Elektro

Aplikasi web persuratan **Jurusan Teknik Elektro, Fakultas Teknik, Universitas Cenderawasih**
yang dibangun langsung dari 12 dokumen surat pada folder ini (250 surat arsip 2025–2026,
328 peserta KP, 10 jenis layanan).

Terdiri dari **tiga portal dalam satu aplikasi**:

| Portal | Alamat | Untuk siapa |
| --- | --- | --- |
| Portal pengajuan | `/` · `/masuk` · `/saya` | Mahasiswa mengajukan & memantau surat |
| Dashboard admin | `/admin` | Petugas: verifikasi, terbitkan, kirim WhatsApp, arsip |
| Portal penerima | `/penerima` · `/terima/<token>` | Penerima: login akun, Lihat, Cetak, Verifikasi |

---

## 1. Tampilan aplikasi

| Beranda | Dashboard admin |
| --- | --- |
| ![Beranda](docs/screenshots/beranda.png) | ![Dashboard admin](docs/screenshots/admin-dashboard.png) |

| Portal penerima (cetak notifikasi) | Lembar surat A4 |
| --- | --- |
| ![Portal penerima](docs/screenshots/portal-penerima.png) | ![Surat](docs/screenshots/surat.png) |

Tampilan lain: `docs/screenshots/admin-detail.png`, `admin-surat.png`, `admin-arsip.png`,
`admin-pengaturan.png`, `layanan.png`, `mobile-beranda.png`, `mobile-terima.png`.

---

## 2. Fitur utama

**Portal mahasiswa**
- Registrasi/masuk, dashboard pengajuan, profil & nomor WhatsApp.
- 10 formulir surat yang meniru format resmi jurusan: Keterangan Aktif Kuliah, Pengantar KKN,
  Pembayaran UKT, Pemotongan UKT, Cicilan UKT, Pengambilan Data (mahasiswa & dosen), Pengantar KP/Magang
  (multi-mahasiswa), Pindah Kuliah, dan Pernyataan Tidak Menerima Beasiswa.
- Nomor tiket otomatis (`ELK-2026-0001`) dan halaman lacak tanpa login.

**Dashboard admin**
- Statistik: total pengajuan, antrian, surat terbit, arsip; grafik 7 hari, distribusi status,
  surat per jenis, aktivitas terbaru.
- Verifikasi → penomoran otomatis (`605/UN20.1.6.7.2/PP/2026`) → penetapan tanggal &
  penandatangan → penerbitan surat dengan kode verifikasi.
- **Tanda tangan pejabat tercetak otomatis** pada surat yang ditandatangani Sekretaris
  (berkas `public/ttd-ekawati.png`, dapat diganti/diatur di menu Pengaturan).
- Pratinjau surat A4 langsung di halaman detail, cetak/PDF, salin tautan portal penerima.
- Kelola pengguna: daftar akun, **halaman edit** (nama, email/username, NIM, WhatsApp, peran,
  status), tetapkan sandi baru sendiri atau acak, aktif/nonaktif; jenis surat, arsip digital,
  pengaturan instansi/pejabat/penomoran/gateway WhatsApp, log audit.

**Portal penerima**
- **Login akun sendiri** (email + kata sandi) di `/penerima`. Akun dibuat oleh **Admin Utama**
  (pendaftaran mandiri dinonaktifkan) dan terpisah dari akun pengajuan mahasiswa.
- Surat tampil otomatis sesuai **nomor WhatsApp** pada profil penerima.
- Tiga menu per surat: **Lihat** (surat A4), **Cetak** (notifikasi A5, otomatis membuka
  dialog cetak), dan **Verifikasi** (memeriksa kode keaslian).
- Tetap bisa dibuka tanpa akun lewat tautan WhatsApp `/terima/<token>`, tanpa login.
- Notifikasi resmi A5 siap cetak (tombol Cetak + `?cetak=1` mencetak otomatis saat dibuka),
  ringkasan surat, kode verifikasi, tanda tangan penerima.
- **Admin dapat mengirim surat ke akun penerima tertentu** dari halaman detail surat:
  pilih akun (mis. Reynold/Dian) lalu **Tautkan ke portal** atau **Tautkan & kirim WhatsApp**.
  Surat langsung muncul di portal penerima tersebut, dan notifikasi WhatsApp dikirim ke **nomor akun penerima** (bukan nomor pemohon).
- Kirim notifikasi WhatsApp: otomatis via gateway (Fonnte/Wablas/custom) atau tautan `wa.me`
  berisi pesan siap kirim.
- Halaman verifikasi publik `/verifikasi/<kode>`.

---

## 3. Menjalankan secara lokal

Prasyarat: **Node.js 22.5+** (disarankan 24) — aplikasi **tanpa dependensi npm**,
memakai modul bawaan `node:sqlite`, `node:crypto`, dan `node:http`.

**Windows:** klik dua kali **`jalankan.bat`** — server berjalan dan browser terbuka otomatis.

**Terminal:**

```bash
node server.js
# atau
npm start
```

Buka:

- Portal publik → <http://localhost:3000>
- Dashboard admin → <http://localhost:3000/admin>
- Contoh portal penerima → <http://localhost:3000/terima/demo-penerima-elektro>
- Health check → <http://localhost:3000/healthz>

### Akun bawaan

| Peran | Email | Kata sandi |
| --- | --- | --- |
| **Admin Utama** (semua menu) | `admin@elektro.uncen.ac.id` | `Admin#2026` |
| **Admin Jurusan** (operasional surat) | `admin.jurusan@elektro.uncen.ac.id` | `Jurusan#2026` |

- Akun **mahasiswa** untuk pengajuan surat dibuat sendiri lewat **Daftar**.
- Akun **penerima** dibuat oleh Admin Utama melalui menu Akun penerima (tanpa akun demo, tanpa pendaftaran mandiri).
- **Admin Utama** mengelola akun (pengguna & penerima), pengaturan, dan log;
  **Admin Jurusan** menangani surat, arsip, jenis surat, dan notifikasi WhatsApp.
- Kapasitas maksimum **1.000 akun** (mahasiswa + admin + penerima). Admin Utama dapat
  menghapus akun yang tidak dipakai; surat yang pernah diajukan tetap tersimpan di arsip.

> Ganti kata sandi admin sebelum dipakai online (menu **Pengguna → Reset sandi**), dan set
> `ADMIN_PASSWORD` pada environment saat pertama kali deploy.

### Konfigurasi (`.env`)

Salin `.env.example` menjadi `.env`, lalu sesuaikan. Semua bersifat opsional:

| Variabel | Keterangan |
| --- | --- |
| `PORT` | Port HTTP (default `3000`; platform biasanya mengisi otomatis) |
| `BASE_URL` | URL publik, dipakai pada tautan WhatsApp & kode verifikasi |
| `DATA_DIR` | Folder database SQLite (Docker: `/data`) |
| `SESSION_SECRET` | Kunci cookie sesi — **wajib diganti**, minimal 32 karakter |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Akun admin yang dibuat saat database kosong |
| `SEED_DEMO` | `0` untuk tidak membuat surat contoh |
| `WA_PROVIDER` / `WA_TOKEN` | Gateway WhatsApp (`fonnte`/`wablas`/`custom`) |
| `WA_AUTO` | `1` untuk mengirim WhatsApp otomatis saat surat diterbitkan |

---

## 4. Alur kerja surat

```
Mahasiswa mengajukan  →  status: baru
Petugas verifikasi    →  nomor & tanggal sementara, status: diproses
Petugas terbitkan     →  nomor final + kode verifikasi + token portal, status: selesai
                      →  notifikasi WhatsApp (otomatis/tautan) 
Penerima buka portal  →  cetak notifikasi A5, unduh surat, konfirmasi terima
```

Penomoran mengikuti pola `{seq}/{prefix}/{tahun}` dan melanjutkan nomor terakhir dari
surat aktif **maupun arsip** (sehingga tidak bentrok dengan penomoran manual lama).

---

## 5. WhatsApp

**Mode tautan (default, tanpa biaya).** Tombol *Kirim sekarang* membuka `wa.me` dengan pesan
lengkap; petugas cukup menekan kirim di WhatsApp. Cocok bila nomor pengirim adalah nomor pribadi.

**Mode gateway (otomatis).** Isi **Pengaturan → Gateway WhatsApp**:

| Provider | Yang perlu diisi |
| --- | --- |
| Fonnte | Token perangkat dari dashboard Fonnte |
| Wablas | Token API; URL default `https://console.wablas.com/api/send-message` |
| Custom | URL API (boleh memakai placeholder `{token}` dan `{target}`) + token |

Aktifkan **Kirim otomatis saat surat diterbitkan**, lalu uji lewat
**Notifikasi WhatsApp → Uji pengiriman**. Setiap pengiriman dicatat di tabel `wa_log`
dan status terakhir tampil pada detail surat.

Isi pesan (dapat disesuaikan pada `src/letters.js` → `pesanWA`):

```
PEMBERITAHUAN SURAT — JURUSAN TEKNIK ELEKTRO
Halo *Renaldi*, pengajuan surat Anda telah selesai diproses.
📄 Surat Keterangan Aktif Kuliah
🔢 No. Surat : 601/UN20.1.6.7.2/PP/2026
📅 Tanggal : 18 November 2026
✅ Status : SELESAI
Kode verifikasi: *ELK-AB12CD34*

Simpan kode verifikasi tersebut. Surat hanya dapat dilihat dan
dicetak oleh penerima melalui Portal Penerima dengan akun penerima.
```

Pesan WhatsApp **tidak memuat tautan surat** — hanya kode verifikasi. Akses surat
sepenuhnya melalui Portal Penerima (login akun penerima).

---

## 6. Deploy online

> **Panduan tanpa terminal (klik di browser): lihat [PANDUAN-ONLINE.md](PANDUAN-ONLINE.md).**
> Paket siap unggah tersedia sebagai `siprel-siap-online.zip` (tanpa database pribadi).
>
> **Butuh online sekarang tanpa akun/kartu?** Klik dua kali `online-kan.bat` —
> aplikasi langsung mendapat tautan publik `https://….trycloudflare.com` selama
> komputer menyala.

Aplikasi sudah dilengkapi `Dockerfile`, `render.yaml`, `railway.json`, dan `docker-compose.yml`.
Database SQLite disimpan pada volume persisten `DATA_DIR`.

### A. Render.com (paling mudah)

1. Unggah folder ini ke repositori GitHub.
2. Render → **New → Blueprint** → pilih repositori (file `render.yaml` terdeteksi).
3. Isi `ADMIN_PASSWORD`, `SESSION_SECRET` (bisa dibuat otomatis), dan `BASE_URL`
   (mis. `https://siprel-elektro.onrender.com`).
4. Deploy. Cek `https://<domain>/healthz` → `{"ok":true}`.
5. Buka `/admin`, masuk, ganti sandi, lalu isi identitas & pejabat di Pengaturan.

> **Penting:** paket gratis Render tidak mendukung disk. Gunakan paket *Starter* agar
> database tidak hilang saat redeploy, atau gunakan Railway/VPS.

### B. Railway

1. New Project → **Deploy from GitHub** (Dockerfile terdeteksi otomatis).
2. Tambahkan **Volume** dengan mount path `/data`.
3. Set variabel: `DATA_DIR=/data`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `BASE_URL`.
4. Generate domain pada tab *Settings → Networking*.

### C. VPS (domain sendiri, disarankan untuk kampus)

```bash
# 1. Pasang Node.js 24 & clone aplikasi
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git
git clone <repo-anda> /opt/siprel && cd /opt/siprel

# 2. Konfigurasi
cp .env.example .env && nano .env      # isi SESSION_SECRET, ADMIN_PASSWORD, BASE_URL
#    BASE_URL=https://siprel.elektro.uncen.ac.id
#    DATA_DIR=/var/lib/siprel

# 3. Jalankan sebagai service
sudo mkdir -p /var/lib/siprel && sudo chown $USER /var/lib/siprel
sudo npm install -g pm2
pm2 start server.js --name siprel --update-env
pm2 save && pm2 startup

# 4. Reverse proxy + HTTPS (Caddy, otomatis Let's Encrypt)
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
siprel.elektro.uncen.ac.id {
    reverse_proxy 127.0.0.1:3000
}
```

Arahkan DNS `A` ke IP server, jalankan `sudo systemctl reload caddy`, lalu buka
`https://siprel.elektro.uncen.ac.id/healthz`. Selesai — situs sudah online.

### D. Docker di server apa pun

```bash
docker compose up -d --build
# atau
docker build -t siprel .
docker run -d -p 3000:3000 -v siprel-data:/data \
  -e SESSION_SECRET="$(openssl rand -hex 32)" \
  -e ADMIN_PASSWORD="SandiKuat#2026" \
  -e BASE_URL="https://siprel.domain-anda.ac.id" \
  --name siprel siprel
```

---

## 7. Struktur proyek

```
server.js                 HTTP server, router, static, health check
src/
  env.js                  pemuat .env tanpa dependensi
  db.js                   skema SQLite, seed admin/arsip/demo, penomoran
  auth.js                 sesi cookie HMAC, rate limit, role
  letters.js              9 definisi jenis surat + render badan + pesan WA
  surat.js                lembar surat A4 & notifikasi A5
  ui.js                   layout publik, admin, penerima, login
  routes-public.js        portal mahasiswa, lacak, verifikasi, portal penerima
  routes-admin.js         dashboard & seluruh aksi admin
  wa.js                   gateway WhatsApp (Fonnte/Wablas/custom/wa.me)
public/
  styles.css              desain sistem + gaya cetak A4/A5
  app.js                  interaksi (menu, cetak, salin, kirim WA)
  logo-uncen.png          logo universitas (dari kop surat)
data/
  arsip.json              250 surat hasil ekstraksi dokumen Word
Dockerfile · render.yaml · railway.json · docker-compose.yml
```

---

## 8. Kustomisasi

- **Tambah/ubah jenis surat** → `src/letters.js` (`JENIS`): field formulir, badan surat,
  tembusan, penandatangan default, dan ringkasan tabel.
- **Kop surat, pejabat, penomoran, loket** → menu **Pengaturan** (tanpa mengubah kode).
- **Tanda tangan** → letakkan berkas PNG di folder `public/` (mis. `ttd-ekawati.png`), lalu isi
  nama berkasnya pada **Pengaturan → Pejabat penandatangan**. Centang “Cetak tanda tangan pada
  surat”. Tersedia kolom terpisah untuk tanda tangan Ketua dan Sekretaris.
- **Pesan WhatsApp** → fungsi `pesanWA()` pada `src/letters.js`.
- **Format cetak** → `public/styles.css`, bagian `@media print` dan `.sheet` / `.notif-sheet`.

Arsip 250 surat berasal dari 11 dokumen `.docx` (file `surat Data penelitian.doc` berformat
lama dan tidak ikut diimpor). Untuk mengimpor ulang: hapus `data/siprel.db` lalu jalankan
`npm start` — seed arsip berjalan otomatis dari `data/arsip.json`.

---

## 9. Keamanan & pemeliharaan

- Kata sandi disimpan dengan `scrypt` + salt; sesi ditandatangani HMAC-SHA256 (HttpOnly,
  SameSite=Lax), token CSRF per sesi, rate limit login/pengajuan/pengiriman WhatsApp.
- Set `SESSION_SECRET` acak di produksi, jalankan di balik HTTPS (`BASE_URL` https) agar
  cookie `Secure` aktif.
- **Backup** cukup dengan menyalin `data/siprel.db` (plus `-wal`) saat aplikasi berhenti,
  atau `sqlite3 data/siprel.db ".backup 'backup.db'"` selagi berjalan.
- Log audit tersedia di **Admin → Log aktivitas**; log WhatsApp di **Notifikasi WhatsApp**.

## 10. Pemecahan masalah

| Gejala | Solusi |
| --- | --- |
| `node:sqlite` tidak ditemukan | Perbarui Node.js ke 22.5+ (disarankan 24) |
| Data hilang setelah redeploy | Pastikan volume `/data` terpasang & `DATA_DIR=/data` |
| Tautan WhatsApp menunjuk `localhost` | Isi `BASE_URL` atau **Pengaturan → URL publik aplikasi** |
| Notifikasi WA tidak terkirim | Periksa token gateway & kuota; uji lewat menu Notifikasi WhatsApp |
| Halaman admin kosong setelah login | Cek cookie diblokir; pastikan `BASE_URL` sesuai domain & HTTPS |

---

© 2026 Jurusan Teknik Elektro, Fakultas Teknik, Universitas Cenderawasih.
