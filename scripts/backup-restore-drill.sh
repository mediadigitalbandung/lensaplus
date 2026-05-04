#!/bin/bash
#
# backup-restore-drill.sh — Once-a-month restore test.
#
# Picks the latest backup, restores it to a temporary database
# `kartawarta_drill`, runs a few sanity SELECTs, then drops the temp DB.
# A backup that hasn't been test-restored is not a backup.
#
# Usage:
#   /var/www/kartawarta/scripts/backup-restore-drill.sh
#
# Optional cron (1st of month at 04:00):
#   0 4 1 * * /var/www/kartawarta/scripts/backup-restore-drill.sh >> /var/log/kartawarta-restore-drill.log 2>&1
#

set -euo pipefail

BACKUP_DIR="/var/backups/kartawarta"
DRILL_DB="kartawarta_drill"
ENV_FILE="/var/www/kartawarta/.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" || true
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[$(date -Is)] ERROR: DATABASE_URL not set." >&2
  exit 1
fi

# Strip the database name from DATABASE_URL and append the drill name.
ADMIN_URL="${DATABASE_URL%/*}/postgres"
DRILL_URL="${DATABASE_URL%/*}/$DRILL_DB"

LATEST=$(ls -1t "$BACKUP_DIR"/kartawarta-*.sql.gz 2>/dev/null | head -1 || true)
if [ -z "$LATEST" ]; then
  echo "[$(date -Is)] ERROR: No backup found in $BACKUP_DIR" >&2
  exit 1
fi

echo "[$(date -Is)] Drilling restore from: $LATEST"

# Ensure clean slate — drop drill DB if it exists from a prior run.
psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS $DRILL_DB;" >/dev/null
psql "$ADMIN_URL" -c "CREATE DATABASE $DRILL_DB;" >/dev/null

# Restore.
zcat "$LATEST" | psql "$DRILL_URL" >/dev/null

# Sanity SELECTs — counts on key tables. If any fails or returns 0, the
# restore was incomplete and the backup is useless.
ARTICLE_COUNT=$(psql "$DRILL_URL" -tAc "SELECT COUNT(*) FROM articles;")
USER_COUNT=$(psql "$DRILL_URL" -tAc "SELECT COUNT(*) FROM users;")
CATEGORY_COUNT=$(psql "$DRILL_URL" -tAc "SELECT COUNT(*) FROM categories;")

echo "[$(date -Is)] Restored counts — articles: $ARTICLE_COUNT, users: $USER_COUNT, categories: $CATEGORY_COUNT"

# Cleanup.
psql "$ADMIN_URL" -c "DROP DATABASE $DRILL_DB;" >/dev/null

if [ "$ARTICLE_COUNT" -lt 1 ] || [ "$USER_COUNT" -lt 1 ] || [ "$CATEGORY_COUNT" -lt 1 ]; then
  echo "[$(date -Is)] FAIL: One or more core tables empty after restore — backup is broken." >&2
  exit 1
fi

echo "[$(date -Is)] OK: restore drill passed."
