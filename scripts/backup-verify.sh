#!/bin/bash
#
# backup-verify.sh — Sanity check that the backup pipeline is alive.
#
# Run via cron after backup-db.sh OR manually:
#   /var/www/lensaplus/scripts/backup-verify.sh
#
# Behavior:
#   - Confirms /var/backups/lensaplus has a *.sql.gz from < 36h ago
#   - Verifies gzip integrity via `gzip -t` (full CRC, not a heuristic)
#   - Secondary truncation guard via decompressed line count (>=100 lines)
#   - Posts an alert webhook if BACKUP_WEBHOOK_URL or WEBHOOK_URL is set
#
# Exit codes:
#   0 = healthy
#   1 = no recent backup OR file too short (truncation)
#   2 = backup dir missing OR gzip integrity error (CRC fail)
#

set -euo pipefail

LOG_FILE="${LOG_FILE:-/var/log/lensaplus-backup-verify.log}"
BACKUP_DIR="/var/backups/lensaplus"
MAX_AGE_HOURS=36

# --- Alerting ---------------------------------------------------------------
# Sends a one-line message to BACKUP_WEBHOOK_URL (preferred) or WEBHOOK_URL.
# Both Discord and Slack accept {text:"..."} payloads.
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
trap 'alert "Backup VERIFY FAIL" "Script $(basename "$0") exited with code $?"' ERR

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[$(date -Is)] FAIL: $BACKUP_DIR does not exist." | tee -a "$LOG_FILE"
  alert "Backup VERIFY FAIL" "$BACKUP_DIR missing"
  exit 2
fi

LATEST="$(ls -1t "$BACKUP_DIR"/lensaplus-*.sql.gz 2>/dev/null | head -1 || true)"
if [ -z "$LATEST" ]; then
  echo "[$(date -Is)] FAIL: No backup files found in $BACKUP_DIR." | tee -a "$LOG_FILE"
  alert "Backup VERIFY FAIL" "no lensaplus-*.sql.gz found"
  exit 1
fi

# Age check (macOS/Linux portable)
NOW_EPOCH=$(date +%s)
FILE_EPOCH=$(stat -c %Y "$LATEST" 2>/dev/null || stat -f %m "$LATEST")
AGE_HOURS=$(( (NOW_EPOCH - FILE_EPOCH) / 3600 ))

if [ "$AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
  echo "[$(date -Is)] FAIL: Latest backup '$LATEST' is ${AGE_HOURS}h old (>${MAX_AGE_HOURS}h)." | tee -a "$LOG_FILE"
  alert "Backup STALE" "${AGE_HOURS}h since last backup ($LATEST)"
  exit 1
fi

# Primary integrity check — gzip -t verifies the full CRC of the gzip stream.
# This catches partial writes, disk-corruption flips, and truncation that
# the previous line-count heuristic would happily miss.
if ! gzip -t "$LATEST" 2>>"$LOG_FILE"; then
  echo "[$(date -Is)] FAIL: gzip integrity error: $LATEST" | tee -a "$LOG_FILE"
  alert "Backup CORRUPT" "gzip CRC error on $LATEST"
  exit 2
fi

# Secondary truncation guard — if pg_dump produced an empty/near-empty dump
# the gzip stream is still valid, so we keep this line-count assertion.
LINES=$(zcat "$LATEST" 2>/dev/null | head -2000 | wc -l)
if [ "$LINES" -lt 100 ]; then
  echo "[$(date -Is)] FAIL: Backup '$LATEST' decompresses to only $LINES lines — likely truncated." | tee -a "$LOG_FILE"
  alert "Backup TRUNCATED" "$LATEST has only $LINES lines"
  exit 1
fi

SIZE=$(du -h "$LATEST" | cut -f1)
echo "[$(date -Is)] OK: '$LATEST' is ${AGE_HOURS}h old, $SIZE, gzip CRC OK, $LINES lines." | tee -a "$LOG_FILE"
exit 0
