# 🚀 Panduan Online-kan SIPREL — Tanpa Terminal

Panduan ini hanya memakai **klik di browser**. Tidak ada perintah yang perlu diketik.

---

## 0. Pahami dulu 3 hal ini

| Layanan | Fungsinya | Analogi |
|---|---|---|
| **GitHub** | menyimpan file kode | gudang berkas |
| **Render** | menjalankan aplikasi 24 jam + memberi alamat web | rumah/kantor |
| **DeepSeek (chat ini)** | menulis & memperbaiki kode | tukang yang menyiapkan semuanya |

Jadi **GitHub saja tidak membuat web online**, dan **DeepSeek tidak bisa menampung web**.
Kode harus diunggah ke GitHub, lalu GitHub disambungkan ke Render agar web hidup.

Yang perlu disiapkan: akun **GitHub** (sudah punya) dan akun **Render** (gratis, daftar dengan GitHub).

---

## Cara tercepat: online dalam 1 klik (tanpa akun & tanpa kartu)

Jika belum punya kartu untuk Render, gunakan **Cloudflare Tunnel** bawaan paket ini:

1. Klik dua kali **`online-kan.bat`**.
2. Tunggu 20–60 detik (pertama kali mengunduh `cloudflared` ±55 MB).
3. Alamat publik muncul di jendela, misalnya
   `https://kata-kata-acak.trycloudflare.com` — juga otomatis tersalin ke clipboard
   dan terbuka di browser.
4. Bagikan tautan itu. Login admin di `.../admin/masuk`.

Ketentuan:
- Tautan **aktif hanya selama jendela hitam terbuka** dan komputer menyala.
- Alamat **berubah setiap kali dijalankan**; tautan lama otomatis mati.
- Datanya tersimpan di komputer ini (`data/siprel.db`), bukan di internet.
- Tekan **Enter** di jendela tersebut untuk menghentikan tautan.

Cocok untuk demo ke dosen/kaprodi hari ini. Untuk alamat permanen, lanjut ke Render
(bagian 3) atau VPS kampus (bagian 6C).

---

## 1. Siapkan berkas

1. Ekstrak `siprel-siap-online.zip` (klik kanan → Extract All).
2. Akan ada folder berisi:
   - `server.js`, `package.json`
   - folder `src`, `public`, `data`, `scripts`
   - `Dockerfile` (file tanpa ekstensi — **wajib ikut**)
   - `PANDUAN-ONLINE.md`, `README.md`

Jangan unggah folder `data` yang berisi `siprel.db` (data mahasiswa). Cukup `data/arsip.json`.
Zip ini sudah bersih — tidak ada database pribadi di dalamnya.

---

## 2. Unggah ke GitHub (sekitar 2 menit)

1. Buka **https://github.com** dan pastikan sudah login.
2. Klik tombol **+** di kanan atas → **New repository**.
3. Isi:
   - **Repository name:** `siprel-elektro`
   - Pilih **Private** (disarankan) atau Public
   - **Jangan** centang "Add a README file"
4. Klik **Create repository**.
5. Di halaman repo yang masih kosong, klik tautan **“uploading an existing file”**.
6. Buka folder hasil ekstrak, tekan **Ctrl+A** untuk memilih semua isi folder,
   lalu **tarik (drag) ke area upload** di browser.
   - Pastikan `Dockerfile` ikut terunggah. Kalau tidak terlihat, aktifkan tampilan file
     tersembunyi di Windows (View → File name extensions).
7. Tunggu semua file selesai diunggah (ada indikator), lalu klik **Commit changes**.

**Cek berhasil:** halaman repo menampilkan `server.js`, `Dockerfile`, dan folder
`src`, `public`, `data` langsung di halaman utama.

> Jangan mengunggah folder induk (folder yang berisi folder hasil ekstrak).
> Yang diunggah adalah **isinya**, sehingga `Dockerfile` berada tepat di halaman utama repo.

---

## 3. Deploy ke Render (sekitar 5 menit)

1. Buka **https://render.com** → **Get Started** → **Sign in with GitHub** → **Authorize**.
2. Di dashboard Render klik **New +** → **Web Service**.
3. Pada daftar repository, pilih **siprel-elektro** → **Connect**.
4. Isi formulir:
   - **Name:** `siprel-elektro`
   - **Region:** Singapore
   - **Branch:** `main`
   - **Runtime:** Docker (biasanya otomatis terdeteksi)
   - **Instance Type:** **Free** untuk uji coba
5. Tambahkan **Environment Variables** (tombol *Add Environment Variable*):

| Key | Value |
|---|---|
| `ADMIN_EMAIL` | `admin@elektro.uncen.ac.id` |
| `ADMIN_PASSWORD` | sandi kuat pilihan Anda, mis. `Siprel#2026Uncen` |
| `SESSION_SECRET` | 32+ karakter acak, mis. `siprel-uncen-elektro-2026-rahasia-panjang` |
| `NODE_ENV` | `production` |

6. Klik **Create Web Service** dan tunggu 3–5 menit sampai status **Live**.
7. Alamat web Anda muncul di atas, misalnya:
   `https://siprel-elektro.onrender.com`

**Jika build gagal:** buka tab **Logs**, biasanya penyebabnya `Dockerfile` tidak ikut
terunggah. Ulangi langkah 2 nomor 6.

---

## 4. Setelah web online (penting)

1. Buka `https://siprel-elektro.onrender.com/healthz` → harus tampil `{"ok":true,...}`.
2. Buka `/admin/masuk`, login dengan email admin dan sandi yang Anda isi tadi.
3. Di Render: **Environment** → tambahkan/ubah
   `BASE_URL` = `https://siprel-elektro.onrender.com` → **Save Changes**.
   (Ini agar tautan WhatsApp & kode verifikasi memakai alamat yang benar.)
4. Uji alur lengkap: ajukan surat → terbitkan → buka portal penerima → cetak notifikasi.
5. Ganti sandi admin dari menu **Pengguna → Reset sandi** bila perlu.

---

## 5. Agar data tidak hilang

Render **Free** tidak menyediakan disk permanen: database akan kembali ke data awal setiap
kali aplikasi di-deploy ulang atau bangun dari tidur.

Untuk pemakaian nyata (surat mahasiswa jangan hilang):

1. Ubah paket layanan ke **Starter** (sekitar US$7/bulan).
2. Tambah **Disk**: nama `siprel-data`, mount path `/data`, ukuran 1 GB.
3. Tambah environment variable `DATA_DIR` = `/data`.
4. Deploy ulang.

Dengan disk, database `siprel.db` tersimpan permanen di `/data`.

---

## 6. Domain sendiri (opsional)

1. Beli domain, mis. `siprel.elektro.uncen.ac.id` (atau domain .id).
2. Di Render: **Settings → Custom Domains → Add Custom Domain**.
3. Ikuti instruksi DNS yang muncul (biasanya CNAME ke `siprel-elektro.onrender.com`).
4. Setelah aktif, ubah `BASE_URL` menjadi `https://siprel.elektro.uncen.ac.id`.

---

## 7. WhatsApp otomatis (opsional)

Tanpa pengaturan ini, tombol WhatsApp tetap berfungsi lewat tautan `wa.me`
(kirim manual dari HP petugas).

Untuk kirim otomatis:
1. Daftar gateway **Fonnte** (fonnte.com) atau **Wablas**, hubungkan nomor WhatsApp jurusan.
2. Salin token perangkat.
3. Di SIPREL: **Admin → Pengaturan → Gateway WhatsApp** → pilih provider, tempel token,
   centang **Kirim otomatis saat surat diterbitkan** → Simpan.
4. Uji lewat menu **Notifikasi WhatsApp → Uji pengiriman**.

---

## 8. Alternatif: Railway

1. Buka **https://railway.app** → **Login with GitHub**.
2. **New Project → Deploy from GitHub repo** → pilih `siprel-elektro`.
3. Tab **Variables** → isi `ADMIN_PASSWORD`, `SESSION_SECRET`, `NODE_ENV=production`.
4. Tab **Volumes** → **Add Volume** → mount path `/data` → tambahkan `DATA_DIR=/data`.
5. **Settings → Networking → Generate Domain** untuk mendapat alamat web.

---

## 9. Bila ada masalah

| Gejala | Penyebab & solusi |
|---|---|
| Build gagal | `Dockerfile` tidak terunggah; unggah ulang ke halaman utama repo |
| Web lama terbuka (30–60 detik) | Render Free tidur saat tidak dipakai; buka ulang |
| Data kembali awal | Belum pakai disk permanen (lihat bagian 5) |
| Tautan WhatsApp menunjuk `localhost` | `BASE_URL` belum diisi (lihat bagian 4) |
| Lupa sandi admin | Reset lewat database/atau minta bantuan saya |

Simpan tangkapan layar error bila macet — bisa saya periksa dan beri langkah perbaikannya.
