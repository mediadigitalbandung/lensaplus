# Deployment VPS

Kartawarta production runs on a Hostinger VPS (`145.79.15.99`, Ubuntu 24.04).

- App dir: `/var/www/kartawarta`
- Process manager: PM2, process name `kartawarta`
- Database: PostgreSQL 16 (`localhost:5432`, db `kartawarta`)
- URL: <https://kartawarta.com>

## Environment variables

Edit `/var/www/kartawarta/.env`. After changes run `pm2 restart kartawarta`.

Required for cron (Phase 7):

| Key | Purpose |
| --- | --- |
| `CRON_SECRET` | Shared secret for `Authorization: Bearer ...` on every `/api/cron/*` endpoint. 32+ random chars. |
| `DATABASE_URL` | Also read by `scripts/backup-db.sh`. |
| `NEXT_PUBLIC_APP_URL` | Canonical site URL, used by SEO helpers. |

Generate a `CRON_SECRET` once:

```bash
openssl rand -hex 32
```

Store it in `/var/www/kartawarta/.env` and keep the same value inside crontab env (see below).

## Crontab

Edit with `crontab -e` as the user that owns `/var/www/kartawarta`.

Put the secret once at the top so entries stay readable:

```cron
# Kartawarta cron
CRON_SECRET=put_the_random_secret_here
OFFSITE_RCLONE_REMOTE=r2:kartawarta-backup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Publish scheduled articles (every 5 minutes)
*/5 * * * * curl -sS -X POST https://kartawarta.com/api/cron/publish \
  -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/kartawarta-cron.log 2>&1

# Auto-generate an AI article draft from a target keyword (every 1 hour)
0 * * * * curl -sS -X POST https://kartawarta.com/api/cron/auto-article \
  -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/kartawarta-cron.log 2>&1

# Generate Sorotan (3-angle SEO summaries) for new published articles (every 6 hours)
0 */6 * * * curl -sS -X POST https://kartawarta.com/api/cron/sorotan \
  -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/kartawarta-cron.log 2>&1

# Retry failed SEO submissions to Google Indexing + IndexNow (every 12 hours)
# Either path works — /api/cron/seo-submit is a thin alias to /api/seo/ping.
0 */12 * * * curl -sS -X GET https://kartawarta.com/api/seo/ping \
  -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/kartawarta-cron.log 2>&1

# Check Meta (Instagram + Facebook) token expiry — every Monday 09:00 WIB (02:00 UTC)
# CRIT-11 fix: warns SUPER_ADMIN via email if token expires within 14 days; updates tokenExpiresAt in DB.
0 2 * * 1 curl -sS -X GET https://kartawarta.com/api/cron/check-meta-tokens \
  -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/kartawarta-cron.log 2>&1

# Daily PostgreSQL backup (03:00) — CRIT-14 fix: direct shell, NOT HTTP
0 3 * * * /var/www/kartawarta/scripts/backup-db.sh >> /var/log/kartawarta-backup.log 2>&1

# Uploads directory backup (03:30) — CRIT-14 fix: tar+gzip public/uploads/
30 3 * * * /var/www/kartawarta/scripts/backup-uploads.sh >> /var/log/kartawarta-uploads-backup.log 2>&1

# Off-site sync via rclone (04:00) — CRIT-13 fix: pushes sql.gz + uploads tgz to remote bucket
0 4 * * * /var/www/kartawarta/scripts/backup-offsite.sh >> /var/log/kartawarta-offsite.log 2>&1

# Verify latest backup is fresh and not corrupt (04:30)
30 4 * * * /var/www/kartawarta/scripts/backup-verify.sh >> /var/log/kartawarta-backup-verify.log 2>&1

# Monthly restore drill — restores to kartawarta_drill DB, validates, drops (1st of month 04:00)
0 4 1 * * /var/www/kartawarta/scripts/backup-restore-drill.sh >> /var/log/kartawarta-restore-drill.log 2>&1
```

First-time setup:

```bash
# Log files
sudo touch /var/log/kartawarta-cron.log \
           /var/log/kartawarta-backup.log \
           /var/log/kartawarta-uploads-backup.log \
           /var/log/kartawarta-offsite.log \
           /var/log/kartawarta-backup-verify.log \
           /var/log/kartawarta-restore-drill.log
sudo chown "$USER":"$USER" /var/log/kartawarta-*.log

# Backup dir
sudo mkdir -p /var/backups/kartawarta

# Make all scripts executable
chmod +x /var/www/kartawarta/scripts/backup-db.sh \
         /var/www/kartawarta/scripts/backup-uploads.sh \
         /var/www/kartawarta/scripts/backup-offsite.sh \
         /var/www/kartawarta/scripts/backup-verify.sh \
         /var/www/kartawarta/scripts/backup-restore-drill.sh
```

## Cron endpoints overview

| Endpoint | Method | Frequency | What it does |
| --- | --- | --- | --- |
| `/api/cron/publish` | GET or POST | every 5 min | Publish APPROVED articles whose `scheduledAt <= now`, runs full `onArticlePublished` chain (SEO + social + Cloudflare purge). |
| `/api/cron/auto-article` | GET or POST | every 1 hour | If `SystemSetting.auto_article_enabled === "true"`, pick a random active `TargetKeyword` and generate a DRAFT via `callAI()`. |
| `/api/cron/sorotan` | GET or POST | every 6 hours | Generate missing Sorotan for the 5 most recent PUBLISHED articles with none yet. |
| `/api/cron/seo-submit` or `/api/seo/ping` | GET or POST | every 12 hours | Retry Articles + Sorotan with `indexStatus` of `failed`/`pending`/`null`. Re-submits to Google Indexing + IndexNow. |
| `/api/cron/check-meta-tokens` | GET or POST | every Monday | Hit Meta `/debug_token` for IG + FB tokens; update `tokenExpiresAt` in DB; email SUPER_ADMINs if <14 days left. (CRIT-11) |
| `/api/cron/backup` | GET or POST | — | HTTP no-op. Real backup runs via `scripts/backup-db.sh`. |

All endpoints:

- Require `Authorization: Bearer $CRON_SECRET`.
- Return JSON `{success, processed|errors|durationMs, ...}`.
- On internal failures, return HTTP 200 with `success:false` so crontab doesn't spam retries.

## Off-Site Backup

Addresses **CRIT-13** (all backups on same VPS as DB) and **CRIT-14** (`/uploads/` not backed up).

### Install rclone

```bash
curl https://rclone.org/install.sh | sudo bash
rclone version   # verify
```

### Configure a remote

Run the interactive wizard and follow the prompts for your chosen provider:

```bash
rclone config
```

Supported providers (choose one):

| Provider | rclone type | Notes |
|---|---|---|
| Cloudflare R2 | `s3` (S3-compatible) | Free egress, generous free tier |
| Backblaze B2 | `b2` | Cheap storage, $0.01/GB egress |
| Amazon S3 | `s3` | Most compatible, regional pricing |

After setup, test the connection:

```bash
rclone lsd r2:                          # list buckets (Cloudflare R2 example)
rclone mkdir r2:kartawarta-backup       # create bucket if needed
rclone lsd r2:kartawarta-backup         # confirm bucket exists
```

### Set the remote name in .env

Add to `/var/www/kartawarta/.env`:

```bash
OFFSITE_RCLONE_REMOTE=r2:kartawarta-backup
OFFSITE_RETENTION_DAYS=90
UPLOADS_RETENTION_DAYS=7
```

### How the pipeline works

```
03:00  backup-db.sh       → /var/backups/kartawarta/kartawarta-YYYYMMDD-HHMMSS.sql.gz
03:30  backup-uploads.sh  → /var/backups/kartawarta/uploads-YYYY-MM-DD.tgz
04:00  backup-offsite.sh  → rclone copy both to OFFSITE_RCLONE_REMOTE (90-day retention)
04:30  backup-verify.sh   → sanity check age + gzip integrity, optional webhook alert
04:00  backup-restore-drill.sh  → monthly: restore drill DB, validate counts, drop
```

### Manual test run

```bash
# Test one backup cycle
/var/www/kartawarta/scripts/backup-db.sh
/var/www/kartawarta/scripts/backup-uploads.sh
/var/www/kartawarta/scripts/backup-offsite.sh
/var/www/kartawarta/scripts/backup-verify.sh

# Check remote contents
rclone ls r2:kartawarta-backup
```

### Disaster recovery

See `docs/DR_RUNBOOK.md` for step-by-step recovery procedures covering:
- VPS disk failure
- Hostinger account loss
- Database corruption
- /uploads/ directory loss
- Application code failure after bad deploy

## Backup scripts

`scripts/backup-db.sh`:

- Reads `DATABASE_URL` from `/var/www/kartawarta/.env`.
- Writes `kartawarta-<YYYYMMDD-HHMMSS>.sql.gz` to `/var/backups/kartawarta/`.
- Deletes local backups older than 7 days.

`scripts/backup-uploads.sh` (CRIT-14 fix):

- Tars `/var/www/kartawarta/public/uploads/` to `uploads-YYYY-MM-DD.tgz`.
- Runs gzip integrity check; deletes the tarball and exits 2 if corrupt.
- Deletes local upload tarballs older than `UPLOADS_RETENTION_DAYS` (default 7).

`scripts/backup-offsite.sh` (CRIT-13 fix):

- Reads `OFFSITE_RCLONE_REMOTE` from env (e.g. `r2:kartawarta-backup`).
- Silently skips if rclone is not installed or `OFFSITE_RCLONE_REMOTE` is unset.
- Copies `*.sql.gz` and `uploads-*.tgz` to the remote bucket.
- Prunes remote files older than `OFFSITE_RETENTION_DAYS` (default 90).

DB restore example:

```bash
gunzip -c /var/backups/kartawarta/kartawarta-YYYYMMDD-HHMMSS.sql.gz \
  | psql "$DATABASE_URL"
```

Uploads restore example:

```bash
tar -xzf /var/backups/kartawarta/uploads-YYYY-MM-DD.tgz \
  -C /var/www/kartawarta/public/
```

## Toggling auto-article

Enable/disable the AI draft cron without touching crontab:

```sql
-- Enable
INSERT INTO system_settings (id, key, value)
VALUES (gen_random_uuid()::text, 'auto_article_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Disable
UPDATE system_settings SET value = 'false' WHERE key = 'auto_article_enabled';
```

When disabled, `/api/cron/auto-article` returns `{success:true, skipped:"disabled"}` and no AI call is made.

## Monitoring

Tail logs on the VPS:

```bash
tail -f /var/log/kartawarta-cron.log
tail -f /var/log/kartawarta-backup.log
pm2 logs kartawarta --lines 100
```

Check last few cron runs manually (requires shell access + CRON_SECRET exported):

```bash
curl -sS -X POST "https://kartawarta.com/api/cron/publish" \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```
