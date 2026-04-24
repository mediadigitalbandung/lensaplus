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

# Daily PostgreSQL backup (3 AM local) — direct shell, NOT HTTP
0 3 * * * /var/www/kartawarta/scripts/backup-db.sh >> /var/log/kartawarta-backup.log 2>&1
```

First-time setup:

```bash
sudo touch /var/log/kartawarta-cron.log /var/log/kartawarta-backup.log
sudo chown "$USER":"$USER" /var/log/kartawarta-cron.log /var/log/kartawarta-backup.log

sudo mkdir -p /var/backups/kartawarta
chmod +x /var/www/kartawarta/scripts/backup-db.sh
```

## Cron endpoints overview

| Endpoint | Method | Frequency | What it does |
| --- | --- | --- | --- |
| `/api/cron/publish` | GET or POST | every 5 min | Publish APPROVED articles whose `scheduledAt <= now`, runs full `onArticlePublished` chain (SEO + social + Cloudflare purge). |
| `/api/cron/auto-article` | GET or POST | every 1 hour | If `SystemSetting.auto_article_enabled === "true"`, pick a random active `TargetKeyword` and generate a DRAFT via `callAI()`. |
| `/api/cron/sorotan` | GET or POST | every 6 hours | Generate missing Sorotan for the 5 most recent PUBLISHED articles with none yet. |
| `/api/cron/seo-submit` or `/api/seo/ping` | GET or POST | every 12 hours | Retry Articles + Sorotan with `indexStatus` of `failed`/`pending`/`null`. Re-submits to Google Indexing + IndexNow. |
| `/api/cron/backup` | GET or POST | — | HTTP no-op. Real backup runs via `scripts/backup-db.sh`. |

All endpoints:

- Require `Authorization: Bearer $CRON_SECRET`.
- Return JSON `{success, processed|errors|durationMs, ...}`.
- On internal failures, return HTTP 200 with `success:false` so crontab doesn't spam retries.

## Backup script

`scripts/backup-db.sh`:

- Reads `DATABASE_URL` from `/var/www/kartawarta/.env`.
- Writes `kartawarta-<YYYYMMDD-HHMMSS>.sql.gz` to `/var/backups/kartawarta/`.
- Deletes backups older than 7 days.

Restore example:

```bash
gunzip -c /var/backups/kartawarta/kartawarta-YYYYMMDD-HHMMSS.sql.gz \
  | psql "$DATABASE_URL"
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
