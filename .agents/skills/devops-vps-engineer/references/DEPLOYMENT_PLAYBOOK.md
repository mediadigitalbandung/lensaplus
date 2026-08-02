# Lensaplus DevOps & VPS Deployment Playbook

Dokumen ini berisi panduan teknis deployment Hostinger VPS, manajemen PM2 cluster, pemulihan database PostgreSQL 16, dan pembersihan cache Cloudflare.

---

## 1. Konfigurasi Lingkungan VPS Produksi

- **Host IP:** `145.79.15.99`
- **SSH User:** `lensaplus`
- **Path Proyek:** `/home/lensaplus/apps/lensaplus`
- **Database Connection String:**
  `DATABASE_URL="postgresql://lensaplus:<PASSWORD>@localhost:5432/lensaplus?schema=public"`

---

## 2. Alur Deployment Zero-Downtime (`deploy-vps.sh`)

```bash
#!/usr/bin/env bash
set -e

echo "🚀 Starting Lensaplus VPS Deployment..."

# 1. Pull code terbaru
git pull origin main

# 2. Install dependensi
npm install --production=false

# 3. Jalankan migrasi database
npx prisma migrate deploy

# 4. Build aplikasi Next.js 16
npm run build

# 5. Reload PM2 cluster mode
pm2 reload ecosystem.config.js --env production

echo "✅ Deployment finished successfully!"
```

---

## 3. Backup & Recovery Protocol Database PostgreSQL 16

### Backup Harian (`scripts/backup-db.sh`):
```bash
pg_dump -U lensaplus -d lensaplus | gzip > /backups/db/lensaplus_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Verifikasi Restorasi (`scripts/backup-verify.sh`):
```bash
gunzip -c /backups/db/latest.sql.gz | psql -U lensaplus -d lensaplus_test_restore
```

---

## 4. PM2 Ecosystem Configuration (`ecosystem.config.js`)

```javascript
module.exports = {
  apps: [
    {
      name: "lensaplus",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: "max",
      exec_mode: "cluster",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
```
