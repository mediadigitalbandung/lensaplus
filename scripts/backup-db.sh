#!/bin/bash
#
# backup-db.sh — Daily PostgreSQL backup for Lensaplus.
#
# Creates a gzipped pg_dump in /var/backups/lensaplus and prunes
# anything older than 7 days.
#
# Install:
#   sudo chmod +x /var/www/lensaplus/scripts/backup-db.sh
#   sudo mkdir -p /var/backups/lensaplus
#
# Cron entry (crontab -e):
#   0 3 * * * /var/www/lensaplus/scripts/backup-db.sh >> /var/log/lensaplus-backup.log 2>&1
#

set -euo pipefail

BACKUP_DIR="/var/backups/lensaplus"
RETENTION_DAYS=7
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/lensaplus-$TIMESTAMP.sql.gz"

# --- Alerting ---------------------------------------------------------------
# Posts a one-line message to BACKUP_WEBHOOK_URL (preferred) or WEBHOOK_URL.
# Both Discord and Slack accept {text:"..."} payloads. Failures are silenced
# so a missing webhook never breaks the cron job.
alert() {
  local subject="$1"
  local body="$2"
  local hook="${BACKUP_WEBHOOK_URL:-${WEBHOOK_URL:-}}"
  if [ -n "$hook" ]; then
    curl -sS -X POST "$hook" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"[Lensaplus backup] ${subject}: ${body}\"}" \
      --max-time 10 \
      >/dev/null 2>&1 || true
  fi
}
trap 'alert "Backup FAIL" "Script $(basename "$0") exited with code $?"' ERR

mkdir -p "$BACKUP_DIR"

# Load DATABASE_URL from the app's .env (non-fatal if missing).
ENV_FILE="/var/www/lensaplus/.env"
if [ -f "$ENV_FILE" ]; then
  # Only export lines that look like KEY=VALUE without quotes stripping.
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" || true
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[$(date -Is)] ERROR: DATABASE_URL not set; aborting backup." >&2
  alert "Backup FAIL" "DATABASE_URL not set in backup-db.sh"
  exit 1
fi

echo "[$(date -Is)] Starting pg_dump -> $OUT_FILE"
pg_dump "$DATABASE_URL" | gzip > "$OUT_FILE"

# Verify gzip integrity immediately so a corrupt file never lingers.
if ! gzip -t "$OUT_FILE"; then
  echo "[$(date -Is)] FAIL: gzip integrity error on $OUT_FILE" >&2
  alert "Backup FAIL" "gzip CRC error on freshly-written $OUT_FILE"
  rm -f "$OUT_FILE"
  exit 2
fi

# Retention: delete backups older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -type f -name "lensaplus-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "[$(date -Is)] Backup completed: $OUT_FILE ($SIZE)"
