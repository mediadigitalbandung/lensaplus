#!/bin/bash
#
# backup-db.sh — Daily PostgreSQL backup for Kartawarta.
#
# Creates a gzipped pg_dump in /var/backups/kartawarta and prunes
# anything older than 7 days.
#
# Install:
#   sudo chmod +x /var/www/kartawarta/scripts/backup-db.sh
#   sudo mkdir -p /var/backups/kartawarta
#
# Cron entry (crontab -e):
#   0 3 * * * /var/www/kartawarta/scripts/backup-db.sh >> /var/log/kartawarta-backup.log 2>&1
#

set -euo pipefail

BACKUP_DIR="/var/backups/kartawarta"
RETENTION_DAYS=7
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/kartawarta-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# Load DATABASE_URL from the app's .env (non-fatal if missing).
ENV_FILE="/var/www/kartawarta/.env"
if [ -f "$ENV_FILE" ]; then
  # Only export lines that look like KEY=VALUE without quotes stripping.
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" || true
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[$(date -Is)] ERROR: DATABASE_URL not set; aborting backup." >&2
  exit 1
fi

echo "[$(date -Is)] Starting pg_dump -> $OUT_FILE"
pg_dump "$DATABASE_URL" | gzip > "$OUT_FILE"

# Retention: delete backups older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -type f -name "kartawarta-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "[$(date -Is)] Backup completed: $OUT_FILE ($SIZE)"
