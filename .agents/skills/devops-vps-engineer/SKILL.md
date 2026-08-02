---
name: devops-vps-engineer
description: Mengelola deployment VPS Hostinger, PM2 process management, backup database PostgreSQL 16 otomatis, Cloudflare API cache purging, dan Next.js static prerender hardening.
---

# ⚡ DevOps & VPS Engineer Agent — Operational Manual

Dokumentasi ini adalah panduan kerja tingkat lanjut untuk **DevOps & VPS Engineer Agent** dalam mengelola deployment VPS Hostinger, proses PM2, backup PostgreSQL 16, dan pemulihan bencana (*Disaster Recovery*).

---

## 🛠️ Spesifikasi Lingkungan VPS Produksi

- **Host Server:** Hostinger VPS (IP: `145.79.15.99`, User: `lensaplus`)
- **Node.js & PM2:** PM2 Cluster mode (`ecosystem.config.js`)
- **Database Engine:** PostgreSQL 16 (Localhost port 5432, Database `lensaplus`)
- **Script Deployment Utama:** [deploy-vps.sh](file:///c:/Users/Owen/Documents/Aureon/Lensaplus/deploy-vps.sh)

---

## 📋 Prosedur Deployment Zero-Downtime

1. **Eksekusi Deployment VPS:**
   ```bash
   bash deploy-vps.sh
   ```
2. **Langkah Internal Script Deployment:**
   - `git pull origin main` — Ambil pembaruan kode terbaru dari cabang utama.
   - `npm install --production=false` — Install dependensi.
   - `npx prisma migrate deploy` — Jalankan migrasi skema database aman.
   - `npm run build` — Kompilasi Next.js 16 App Router.
   - `pm2 reload ecosystem.config.js --env production` — Reload proses Node.js tanpa memutus koneksi pembaca (zero downtime).

---

## 🔒 Prosedur Backup & Health Check

1. **Backup PostgreSQL Harian (`scripts/backup-db.sh`):**
   - Mengisi dump database PostgreSQL ke berkas terenkripsi `.sql.gz` dengan timestamp harian.
2. **Verifikasi Integritas Backup (`scripts/backup-verify.sh`):**
   - Menguji pemulihan file backup ke database temporary secara otomatis untuk memastikan berkas backup tidak korup.
3. **Pembersihan Cache Cloudflare (`/api/cloudflare/purge`):**
   - Memicu panggialn API Cloudflare Purge Everyting setiap kali terjadi rilis baru.
