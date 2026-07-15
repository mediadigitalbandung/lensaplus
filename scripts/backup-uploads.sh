#!/usr/bin/env bash
#
# backup-uploads.sh — Tar+gzip the /uploads/ media directory to /var/backups/lensaplus.
#
# Addresses CRIT-14: /var/www/lensaplus/public/uploads/ was not backed up.
# A VPS loss would destroy all article hero images and editor-uploaded media.
#
# Produces: /var/backups/lensaplus/uploads-YYYY-MM-DD.tgz
# Keeps last UPLOADS_RETENTION_DAYS (default 7) tarballs locally.
# Off-site sync is handled by backup-offsite.sh (runs at 04:00 after this).
#
# Install:
#   sudo chmod +x /var/www/lensaplus/scripts/backup-uploads.sh
#
# Cron (jam 3:30 AM, between backup-db.sh at 03:00 and backup-offsite.sh at 04:00):
#   30 3 * * * /var/www/lensaplus/scripts/backup-uploads.sh >> /var/log/lensaplus-uploads-backup.log 2>&1
#

set -euo pipefail

UPLOADS_DIR="/var/www/lensaplus/public/uploads"
BACKUP_DIR="/var/backups/lensaplus"
RETENTION_DAYS="${UPLOADS_RETENTION_DAYS:-7}"
LOG_FILE="/var/log/lensaplus-uploads-backup.log"
TIMESTAMP=$(date +%F)
OUTPUT_FILE="$BACKUP_DIR/uploads-$TIMESTAMP.tgz"

# --- Alerting ---------------------------------------------------------------
alert() {
  local subject="$1"
  local body="$2"
  local hook="${BACKUP_WEBHOOK_URL:-${WEBHOOK_URL:-}}"
  if [ -n "$hook" ]; then
    curl -sS -X POST "$hook" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"[Lensaplus uploads-backup] ${subject}: ${body}\"}" \
      --max-time 10 \
      >/dev/null 2>&1 || true
  fi
}
trap 'alert "Uploads backup FAIL" "Script $(basename "$0") exited with code $?"' ERR

if [ ! -d "$UPLOADS_DIR" ]; then
  echo "[$(date -Iseconds)] [uploads-backup] ERROR: uploads dir not found: $UPLOADS_DIR" | tee -a "$LOG_FILE"
  alert "Uploads backup FAIL" "$UPLOADS_DIR not found"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] [uploads-backup] Starting uploads backup -> $OUTPUT_FILE" >> "$LOG_FILE"

# Count files being backed up for reporting.
FILE_COUNT=$(find "$UPLOADS_DIR" -type f | wc -l)
echo "[$(date -Iseconds)] [uploads-backup] Files in uploads dir: $FILE_COUNT" >> "$LOG_FILE"

# Create tarball. -C changes to parent dir so archive paths are relative to it.
tar -czf "$OUTPUT_FILE" \
  -C "$(dirname "$UPLOADS_DIR")" \
  "$(basename "$UPLOADS_DIR")" \
  2>>"$LOG_FILE"

# Integrity check — verify the gzip stream is not truncated.
if ! gzip -t "$OUTPUT_FILE" 2>>"$LOG_FILE"; then
  echo "[$(date -Iseconds)] [uploads-backup] FAIL — tarball failed integrity check: $OUTPUT_FILE" | tee -a "$LOG_FILE"
  alert "Uploads backup CORRUPT" "gzip CRC error on $OUTPUT_FILE"
  rm -f "$OUTPUT_FILE"
  exit 2
fi

# Cross-platform file size (Linux stat -c / macOS stat -f).
FILE_SIZE=$(stat -c%s "$OUTPUT_FILE" 2>/dev/null || stat -f%z "$OUTPUT_FILE" 2>/dev/null || echo "unknown")
echo "[$(date -Iseconds)] [uploads-backup] OK: $OUTPUT_FILE ($FILE_SIZE bytes, $FILE_COUNT source files)" >> "$LOG_FILE"

# Retention: delete local uploads tarballs older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -name "uploads-*.tgz" -mtime +"$RETENTION_DAYS" -delete 2>>"$LOG_FILE" || true

echo "[$(date -Iseconds)] [uploads-backup] Uploads backup completed." >> "$LOG_FILE"
