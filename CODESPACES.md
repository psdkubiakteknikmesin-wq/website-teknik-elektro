# Online-kan SIPREL lewat GitHub (tanpa kartu)

GitHub **tidak menjalankan** aplikasi Node.js + SQLite seperti SIPREL. GitHub hanya
menyimpan kode. Agar benar-benar online dari GitHub, ada dua jalur:

| Jalur | Bisa? | Biaya | Catatan |
|---|---|---|---|
| **GitHub Codespaces** | ✅ | Gratis (kuota bulanan) | Aplikasi berjalan di server GitHub, tautan publik otomatis |
| **GitHub + Render** | ✅ | Gratis/berbayar | Paling cocok untuk jangka panjang; Render perlu verifikasi kartu |
| **GitHub Pages** | ❌ | — | Hanya untuk situs statis, tidak bisa Node.js/SQLite |

---

## A. GitHub Codespaces — satu klik, tanpa kartu

Repo ini sudah menyertakan `.devcontainer/devcontainer.json`, sehingga Codespaces
otomatis menjalankan SIPREL dan membuka port publik.

1. Buka repo **siprel-elektro** di GitHub.
2. Klik **Code ▾** → tab **Codespaces** → **Create codespace on main**.
3. Tunggu 1–2 menit. Server berjalan otomatis (`node server.js`).
4. Buka tab **Ports** (bawah editor) → port **3000** → klik ikon globe
   **Open in Browser**.
5. Alamat publik berbentuk:
   `https://<nama-codespace>-3000.app.github.dev`

Buka alamat itu + `/admin/masuk` untuk login admin.

### Batasan Codespaces

- Berhenti otomatis setelah ±30 menit tidak dipakai (bisa diatur).
- Saat dijalankan lagi, **alamatnya berubah** (buat ulang tautan).
- Data `data/siprel.db` tersimpan selama Codespace tidak dihapus, tetapi
  **hilang** bila Codespace dihapus/dibuat ulang.
- Kuota gratis GitHub: ±60 jam/bulan untuk akun personal.

Cocok untuk demo ke dosen/kaprodi, belum untuk produksi resmi.

---

## B. GitHub + Render — alamat tetap

1. Pastikan repo berisi **Dockerfile, server.js, src/, public/, data/arsip.json**.
2. Buka `render.com` → **New +** → **Web Service** → pilih repo.
3. Runtime **Docker**, Region **Singapore**, Instance **Free/Starter**.
4. Environment:
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `NODE_ENV=production`
5. Deploy → alamat tetap `https://siprel-elektro.onrender.com`.

Jika Render meminta kartu, gunakan Codespaces (bagian A) atau VPS kampus.

---

## C. Memperbarui repo dari folder ini

Unggah ulang file yang berubah (atau seluruh isi folder) ke halaman utama repo:
`server.js`, `package.json`, `Dockerfile`, folder `src`, `public`, `data`, `scripts`,
`.devcontainer`, `README.md`.

Jangan unggah `data/siprel.db` (database berisi data nyata).
