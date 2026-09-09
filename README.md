# Website Teknik Elektro — Fakultas Teknik Universitas Cenderawasih

Website statis siap digunakan dengan GitHub Pages.

## File
- `index.html` — halaman utama
- `style.css` — desain/responsive
- `script.js` — interaksi dan konfigurasi link
- `assets/` — tempat logo/gambar

## Cara upload ke GitHub
1. Buat repository baru, misalnya `website-teknik-elektro`.
2. Upload `index.html`, `style.css`, `script.js`, folder `assets`, dan `README.md`.
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`.
6. Simpan. GitHub akan memberikan alamat website `https://USERNAME.github.io/website-teknik-elektro/`.

## Menghubungkan KRS
Buka `script.js`, lalu isi:
`krs: "LINK_GOOGLE_APPS_SCRIPT_ANDA"`

Tambahkan juga link Google Drive/PDF, WhatsApp, YouTube, dan layanan lainnya sesuai kebutuhan.

## Logo
Ganti `logo-placeholder` di `index.html` dengan gambar logo resmi Anda jika sudah tersedia.
