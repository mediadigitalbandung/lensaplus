#!/usr/bin/env bash
#
# backup-offsite.sh — Sync local backups to off-site object storage via rclone.
#
# Addresses CRIT-13: all backups were stored only on the same VPS as the DB.
# This script syncs both DB dumps and uploads tarballs to a remote bucket so
# a total VPS/account loss does not mean total data loss.
#
# Requires:
#   - rclone installed: curl https://rclone.org/install.sh | sudo bash
#   - rclone remote configured: rclone config  (Cloudflare R2, Backblaze B2, or any S3)
#
# Configuration via environment (set in /var/www/kartawarta/.env or /etc/environment):
#   OFFSITE_RCLONE_REMOTE  — rclone remote + bucket path, e.g. "r2:kartawarta-backup"
#   OFFSITE_RETENTION_DAYS — days to keep remote files (default: 90)
#
# Cron (jam 4 pagi, AFTER backup-db.sh jam 3 dan backup-uploads.sh jam 3:30):
#   0 4 * * * /var/www/kartawarta/scripts/backup-offsite.sh >> /var/log/kartawarta-offsite.log 2>&1
#

set -euo pipefail

BACKUP_DIR="/var/backups/kartawarta"
REMOTE="${OFFSITE_RCLONE_REMOTE:-}"
RETENTION_DAYS="${OFFSITE_RETENTION_DAYS:-90}"
LOG_FILE="/var/log/kartawarta-offsite.log"

# --- Alerting ---------------------------------------------------------------
alert() {
  local subject="$1"
  local body="$2"
  local hook="${BACKUP_WEBHOOK_URL:-${WEBHOOK_URL:-}}"
  if [ -n "$hook" ]; then
    curl -sS -X POST "$hook" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"[Kartawarta offsite-backup] ${subject}: ${body}\"}" \
      --max-time 10 \
      >/dev/null 2>&1 || true
  fi
}
trap 'alert "Offsite backup FAIL" "Script $(basename "$0") exited with code $?"' ERR

# Load env from app's .env if the variable isn't already set.
ENV_FILE="/var/www/kartawarta/.env"
if [ -z "$REMOTE" ] && [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE" || true
  set +a
  REMOTE="${OFFSITE_RCLONE_REMOTE:-}"
fi

if [ -z "$REMOTE" ]; then
  echo "[$(date -Iseconds)] [offsite] OFFSITE_RCLONE_REMOTE not set — skipping off-site sync." | tee -a "$LOG_FILE"
  exit 0
fi

if ! command -v rclone >/dev/null 2>&1; then
  echo "[$(date -Iseconds)] [offsite] rclone not installed — skipping off-site sync." | tee -a "$LOG_FILE"
  echo "[offsite] Install: curl https://rclone.org/install.sh | sudo bash" | tee -a "$LOG_FILE"
  exit 0
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[$(date -Iseconds)] [offsite] BACKUP_DIR $BACKUP_DIR not found — nothing to sync." | tee -a "$LOG_FILE"
  exit 1
fi

echo "[$(date -Iseconds)] [offsite] Starting sync to $REMOTE (retention: ${RETENTION_DAYS}d)" >> "$LOG_FILE"

# Count files to be synced.
DB_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -name "*.sql.gz" | wc -l)
UPLOADS_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -name "uploads-*.tgz" | wc -l)
echo "[$(date -Iseconds)] [offsite] Files to sync: ${DB_COUNT} sql.gz, ${UPLOADS_COUNT} uploads.tgz" >> "$LOG_FILE"

# Copy DB dumps + uploads tarballs to remote.
# --include filters: only our backup file patterns.
# Note: rclone copy does not delete remote files; deletions are handled explicitly below.
rclone copy "$BACKUP_DIR/" "$REMOTE/" \
  --include "*.sql.gz" \
  --include "uploads-*.tgz" \
  --transfers 4 \
  --checkers 8 \
  --contimeout 60s \
  --timeout 300s \
  --retries 3 \
  2>>"$LOG_FILE"

echo "[$(date -Iseconds)] [offsite] Upload completed." >> "$LOG_FILE"

# Prune remote: delete files older than RETENTION_DAYS.
# Using --min-age ensures only aged-out files are removed.
rclone delete "$REMOTE/" \
  --min-age "${RETENTION_DAYS}d" \
  --include "*.sql.gz" \
  --include "uploads-*.tgz" \
  2>>"$LOG_FILE" || {
  echo "[$(date -Iseconds)] [offsite] WARNING: remote prune had errors (non-fatal)." >> "$LOG_FILE"
}

echo "[$(date -Iseconds)] [offsite] Off-site sync completed to $REMOTE." >> "$LOG_FILE"
