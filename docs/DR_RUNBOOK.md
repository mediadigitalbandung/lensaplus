# Lensaplus — Disaster Recovery Runbook

**Version:** 1.0 (2026-05-07)
**RTO target:** 4 hours (from incident declared to site live)
**RPO target:** 24 hours (with nightly backups); ~1 hour when hourly offsite is enabled later

This runbook covers recovery from the scenarios most likely to affect Lensaplus
running on Hostinger VPS `145.79.15.99`. Keep a printed copy or store in a
separate location from the VPS.

---

## Backup pipeline overview

| Script | Schedule | What it produces | Storage |
|---|---|---|---|
| `backup-db.sh` | 03:00 daily | `lensaplus-YYYYMMDD-HHMMSS.sql.gz` | VPS `/var/backups/lensaplus/` |
| `backup-uploads.sh` | 03:30 daily | `uploads-YYYY-MM-DD.tgz` | VPS `/var/backups/lensaplus/` |
| `backup-offsite.sh` | 04:00 daily | Both of the above | Off-site bucket (`OFFSITE_RCLONE_REMOTE`) |
| `backup-verify.sh` | 04:30 daily | Log line (no artifact) | `/var/log/lensaplus-backup-verify.log` |
| `backup-restore-drill.sh` | 04:00 on 1st of month | Log line (drops drill DB after test) | `/var/log/lensaplus-restore-drill.log` |

---

## Scenario 1 — VPS disk failure (data still accessible via Hostinger snapshot or off-site)

**Symptoms:** SSH fails, site returns 502 or no response, PM2 unreachable.

**Steps:**

1. Open Hostinger hPanel. Check if a VPS snapshot exists (taken within last 24h).
   - If yes: restore snapshot. SSH in. Verify `/var/backups/lensaplus/` integrity with `backup-verify.sh`. Done.
   - If no: provision a fresh Ubuntu 24.04 VPS.

2. On fresh VPS, run the bootstrap from `docs/DEPLOY_VPS.md` up to "First-time setup".

3. Pull the latest DB backup from off-site:
   ```bash
   rclone copy r2:lensaplus-backup /var/backups/lensaplus/ --include "*.sql.gz"
   ```

4. Restore DB (see Scenario 3 below).

5. Pull the latest uploads tarball from off-site:
   ```bash
   rclone copy r2:lensaplus-backup /var/backups/lensaplus/ --include "uploads-*.tgz"
   ```

6. Extract uploads:
   ```bash
   tar -xzf /var/backups/lensaplus/uploads-YYYY-MM-DD.tgz \
     -C /var/www/lensaplus/public/
   ```

7. Restart PM2 and verify Nginx is serving `/uploads/*` directly.

---

## Scenario 2 — Hostinger account loss / total provider failure

**Symptoms:** Cannot access hPanel, billing failure, account suspended.

**Steps:**

1. Provision VPS at any provider (DigitalOcean, Vultr, Linode). Same Ubuntu 24.04.

2. Point DNS A records (managed in Cloudflare) to new VPS IP.

3. Follow Scenario 1 steps 2-7 above.

4. Re-issue SSL via Let's Encrypt: `sudo certbot --nginx -d lensaplus.com -d www.lensaplus.com`.

5. Update `/var/www/lensaplus/.env` with new `DATABASE_URL` (PostgreSQL now on new host).

6. Restart PM2. Purge Cloudflare cache: `curl -X POST` to `/api/cloudflare/purge` or via hPanel.

---

## Scenario 3 — Database corruption (VPS intact, DB corrupt)

**Symptoms:** Prisma errors on every request, `psql` connection errors, table-level corruption messages in PostgreSQL logs.

**Steps:**

1. SSH into VPS. Check PostgreSQL status:
   ```bash
   sudo systemctl status postgresql
   sudo journalctl -u postgresql --since "1 hour ago"
   ```

2. Identify the latest healthy backup:
   ```bash
   ls -lt /var/backups/lensaplus/*.sql.gz | head -5
   ```

3. Verify the candidate backup is not corrupt:
   ```bash
   gzip -t /var/backups/lensaplus/lensaplus-YYYYMMDD-HHMMSS.sql.gz && echo OK
   ```

4. Stop the application:
   ```bash
   pm2 stop lensaplus
   ```

5. Drop and recreate the database:
   ```bash
   psql postgresql://lensaplus@localhost:5432/postgres \
     -c "DROP DATABASE lensaplus;" \
     -c "CREATE DATABASE lensaplus OWNER lensaplus;"
   ```

6. Restore:
   ```bash
   gunzip -c /var/backups/lensaplus/lensaplus-YYYYMMDD-HHMMSS.sql.gz \
     | psql "$DATABASE_URL"
   ```

7. Run any pending schema changes (if restore is to a version before the last migration):
   ```bash
   cd /var/www/lensaplus && npx prisma db push
   ```

8. Restart PM2:
   ```bash
   pm2 restart lensaplus
   ```

9. Smoke test: `curl -I https://lensaplus.com/` should return 200.

---

## Scenario 4 — /uploads/ directory loss (media files destroyed)

**Symptoms:** Hero images and editor-uploaded media return 404. DB intact.

**Steps:**

1. Find the latest uploads tarball (local or off-site):
   ```bash
   ls -lt /var/backups/lensaplus/uploads-*.tgz | head -3
   # If not available locally:
   rclone copy r2:lensaplus-backup /var/backups/lensaplus/ --include "uploads-*.tgz"
   ```

2. Extract (will overwrite existing uploads dir):
   ```bash
   tar -xzf /var/backups/lensaplus/uploads-YYYY-MM-DD.tgz \
     -C /var/www/lensaplus/public/
   ```

3. Verify Nginx serves the directory directly (not via Next.js). Check:
   ```bash
   curl -I https://lensaplus.com/uploads/
   ```
   Should return 200 or 301, not 404.

4. No PM2 restart needed (uploads are static files served by Nginx).

---

## Scenario 5 — Application code failure after bad deploy

**Symptoms:** Site returns 500 or 502 after a push. PM2 process keeps crashing.

**Steps:**

1. Check PM2 logs:
   ```bash
   pm2 logs lensaplus --lines 50
   ```

2. Rollback to last good commit:
   ```bash
   cd /var/www/lensaplus
   git log --oneline -10
   git checkout <last-good-sha>
   npm run build
   pm2 restart lensaplus
   ```

3. If build fails: `rm -rf .next && npm run build` (sometimes needed — see VPS build quirk in memory).

---

## Test restore drill

`scripts/backup-restore-drill.sh` is designed to be run once a month. It:

1. Takes the latest `*.sql.gz` backup.
2. Creates a temporary PostgreSQL database `lensaplus_drill`.
3. Restores the dump.
4. Asserts counts on `articles`, `users`, `categories` tables are > 0.
5. Drops the drill database.

**Cron entry (already in crontab template):**
```
0 4 1 * * /var/www/lensaplus/scripts/backup-restore-drill.sh >> /var/log/lensaplus-restore-drill.log 2>&1
```

Run manually any time:
```bash
/var/www/lensaplus/scripts/backup-restore-drill.sh
```

---

## RTO / RPO checklist

| Step | Target time |
|---|---|
| Incident declared, on-call notified | T+0 |
| Off-site backup located and downloaded | T+30 min |
| DB restored | T+1.5 h |
| App code deployed + PM2 running | T+2.5 h |
| Uploads extracted, Nginx verified | T+3 h |
| DNS propagated (if new IP) | T+3.5 h — T+4 h |
| Full smoke test passed | T+4 h |

**RPO:** Nightly backup at 03:00 → max 24h data loss. Once hourly offsite is
enabled, RPO reduces to ~1 hour.

---

## Emergency contacts

| Role | Contact |
|---|---|
| VPS admin | Owen (owenjacobn@gmail.com) |
| Hostinger support | https://www.hostinger.com/support |
| Cloudflare support | https://dash.cloudflare.com/support |
| PostgreSQL on-call docs | https://www.postgresql.org/docs/16/ |
