# Panduan Deploy SIPREL di VPS Kampus

Dokumen ini bisa diserahkan langsung ke petugas IT fakultas/universitas.

## 1. Yang perlu disiapkan (permintaan ke IT)

| Kebutuhan | Spesifikasi minimum | Rekomendasi |
|---|---|---|
| Virtual machine | 1 vCPU, 1 GB RAM, 20 GB SSD | **2 vCPU, 2–4 GB RAM, 40 GB SSD** |
| Sistem operasi | Ubuntu 22.04 / 24.04 LTS | Ubuntu 24.04 LTS |
| Akses | SSH (user + sudo), IP publik tetap | Akses SSH + snapshot/backup |
| Port terbuka | 80 (HTTP), 443 (HTTPS) | 3000 **hanya lokal**, tidak dibuka ke internet |
| Domain | Subdomain, mis. `siprel.elektro.uncen.ac.id` | DNS A record ke IP VPS |
| Backup | Folder `/var/lib/siprel` | Backup harian, simpan 14 hari |
| Internet keluar | HTTPS ke `api.fonnte.com` / `api.wablas.com` | Untuk WhatsApp otomatis |
| Lain-lain | Tanpa GPU, tanpa MySQL | Tidak perlu database eksternal |

Aplikasi memakai **Node.js 22.5+ + SQLite** (tanpa dependensi npm), jadi tidak perlu
PHP/MySQL/Apache. Cukup satu proses Node di belakang reverse proxy Caddy/Nginx.

## 2. Langkah instalasi (di VPS)

```bash
# 1) Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs sqlite3 caddy git ufw

# 2) User & folder aplikasi
sudo useradd -r -m -d /opt/siprel -s /usr/sbin/nologin siprel
sudo mkdir -p /opt/siprel /var/lib/siprel
sudo chown -R siprel:siprel /opt/siprel /var/lib/siprel

# 3) Ambil aplikasi (repo publik)
sudo -u siprel git clone https://github.com/psdkubiakteknikmesin-wq/website-teknik-elektro.git /opt/siprel

# 4) Konfigurasi
sudo -u siprel tee /opt/siprel/.env >/dev/null <<'EOF'
PORT=3000
DATA_DIR=/var/lib/siprel
NODE_ENV=production
BASE_URL=https://siprel.elektro.uncen.ac.id
ADMIN_EMAIL=admin@elektro.uncen.ac.id
ADMIN_PASSWORD=GantiSandiKuat#2026
SESSION_SECRET=ganti-dengan-64-karakter-acak
EOF
sudo chmod 600 /opt/siprel/.env

# 5) Service systemd
sudo cp /opt/siprel/deploy/siprel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now siprel

# 6) Cek lokal
curl -s http://127.0.0.1:3000/healthz
```

## 3. Reverse proxy + HTTPS (Caddy)

```bash
sudo cp /opt/siprel/deploy/Caddyfile /etc/caddy/Caddyfile
sudo sed -i 's/siprel.elektro.uncen.ac.id/DOMAIN-ANDA/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy mengurus sertifikat HTTPS (Let's Encrypt) otomatis.

## 4. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
sudo ufw status
```

Port 3000 tidak dibuka; hanya diakses Caddy dari dalam server.

## 5. Verifikasi

```bash
curl -I https://siprel.elektro.uncen.ac.id/healthz
sudo systemctl status siprel
sudo journalctl -u siprel -n 50 --no-pager
```

Buka `https://domain-anda/admin/masuk`, login dengan `ADMIN_EMAIL` / `ADMIN_PASSWORD`,
lalu **ganti sandi** di menu Pengguna.

## 6. Backup harian

```bash
sudo cp /opt/siprel/deploy/backup.sh /usr/local/bin/siprel-backup
sudo chmod +x /usr/local/bin/siprel-backup
sudo crontab -e
# tambahkan:
# 0 1 * * * /usr/local/bin/siprel-backup
```

File backup tersimpan di `/var/backups/siprel/` (14 hari terakhir).

## 7. Update aplikasi

```bash
sudo -u siprel git -C /opt/siprel pull
sudo systemctl restart siprel
```

Tidak ada `npm install` dan tidak ada proses build.

## 8. WhatsApp otomatis

Isi **Admin → Pengaturan → Gateway WhatsApp** dengan token Fonnte/Wablas, centang
“Kirim otomatis saat surat diterbitkan”. Server hanya perlu akses **keluar** ke
`api.fonnte.com`/`api.wablas.com` (HTTPS), tanpa webhook masuk.

## 9. Pemeliharaan

- Cek disk: `df -h` (database SQLite tumbuh perlahan; 40 GB sangat cukup).
- Backup rutin folder `/var/lib/siprel`.
- Perbarui OS: `sudo apt update && sudo apt upgrade`.
- Pantau service: `systemctl status siprel` atau `journalctl -u siprel`.
- Simpan `SESSION_SECRET` dan sandi admin di tempat aman.

## 10. Perkiraan kebutuhan

| Pengguna aktif | vCPU | RAM | Disk |
|---|---|---|---|
| < 100 | 1 | 1 GB | 10 GB |
| 100–500 | 2 | 2 GB | 20 GB |
| 500–1.000 | 2 | 4 GB | 40 GB |

Beban utama hanya saat pengajuan/pencentakan surat; aplikasi ringan karena tanpa
framework dan tanpa database server terpisah.
