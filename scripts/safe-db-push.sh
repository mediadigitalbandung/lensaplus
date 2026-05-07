#!/usr/bin/env bash
#
# safe-db-push.sh — Wraps `prisma db push` with a pre-flight backup so that
# bad migrations can be rolled back from a snapshot taken seconds before push.
#
# Usage:
#   /var/www/kartawarta/scripts/safe-db-push.sh
#   /var/www/kartawarta/scripts/safe-db-push.sh --accept-data-loss
#
# Snapshots land in /var/backups/kartawarta/pre-push and are kept for 14 days.
# If the snapshot itself is corrupt the script ABORTS the push.
#

set -euo pipefail

LOG_FILE="/var/log/kartawarta-deploy.log"
SNAPSHOT_DIR="/var/backups/kartawarta/pre-push"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SNAPSHOT_FILE="$SNAPSHOT_DIR/pre-push-$TIMESTAMP.sql.gz"

# --- Alerting ---------------------------------------------------------------
alert() {
  local subject="$1"
  local body="$2"
  local hook="${BACKUP_WEBHOOK_URL:-${WEBHOOK_URL:-}}"
  if [ -n "$hook" ]; then
    curl -sS -X POST "$hook" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"[Kartawarta safe-db-push] ${subject}: ${body}\"}" \
      --max-time 10 \
      >/dev/null 2>&1 || true
  fi
}
trap 'alert "safe-db-push FAIL" "Script $(basename "$0") exited with code $?"' ERR

mkdir -p "$SNAPSHOT_DIR"

echo "[$(date -Iseconds)] Pre-push snapshot..." >> "$LOG_FILE"

# Reuse the same DATABASE_URL parsing as backup-db.sh.
if [ -z "${DATABASE_URL:-}" ]; then
  ENV_FILE="/var/www/kartawarta/.env"
  if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE" || true
    set +a
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[safe-db-push] DATABASE_URL not set — aborting" | tee -a "$LOG_FILE"
  alert "safe-db-push FAIL" "DATABASE_URL not set"
  exit 1
fi

# Snapshot via pg_dump → gzip
pg_dump "$DATABASE_URL" --no-owner --no-privileges 2>>"$LOG_FILE" | gzip > "$SNAPSHOT_FILE"

if ! gzip -t "$SNAPSHOT_FILE" 2>>"$LOG_FILE"; then
  echo "[safe-db-push] FAIL — snapshot corrupt, ABORTING db push" | tee -a "$LOG_FILE"
  alert "safe-db-push FAIL" "pre-flight snapshot corrupt; db push NOT executed"
  rm -f "$SNAPSHOT_FILE"
  exit 2
fi

echo "[$(date -Iseconds)] Snapshot OK: $SNAPSHOT_FILE" >> "$LOG_FILE"

# Now run db push.
echo "[$(date -Iseconds)] Running prisma db push $* ..." >> "$LOG_FILE"
cd /var/www/kartawarta
if npx prisma db push "$@" 2>>"$LOG_FILE"; then
  echo "[$(date -Iseconds)] db push OK" >> "$LOG_FILE"
  # Retain pre-push snapshots for 14 days
  find "$SNAPSHOT_DIR" -name "pre-push-*.sql.gz" -mtime +14 -delete 2>/dev/null || true
else
  echo "[$(date -Iseconds)] db push FAILED — restore from $SNAPSHOT_FILE" | tee -a "$LOG_FILE"
  alert "safe-db-push FAIL" "prisma db push exited non-zero; rollback from $SNAPSHOT_FILE"
  exit 3
fi
