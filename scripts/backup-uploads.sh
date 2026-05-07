#!/usr/bin/env bash
#
# backup-uploads.sh — Tar+gzip the /uploads/ media directory to /var/backups/kartawarta.
#
# Addresses CRIT-14: /var/www/kartawarta/public/uploads/ was not backed up.
# A VPS loss would destroy all article hero images and editor-uploaded media.
#
# Produces: /var/backups/kartawarta/uploads-YYYY-MM-DD.tgz
# Keeps last UPLOADS_RETENTION_DAYS (default 7) tarballs locally.
# Off-site sync is handled by backup-offsite.sh (runs at 04:00 after this).
#
# Install:
#   sudo chmod +x /var/www/kartawarta/scripts/backup-uploads.sh
#
# Cron (jam 3:30 AM, between backup-db.sh at 03:00 and backup-offsite.sh at 04:00):
#   30 3 * * * /var/www/kartawarta/scripts/backup-uploads.sh >> /var/log/kartawarta-uploads-backup.log 2>&1
#

set -euo pipefail

UPLOADS_DIR="/var/www/kartawarta/public/uploads"
BACKUP_DIR="/var/backups/kartawarta"
RETENTION_DAYS="${UPLOADS_RETENTION_DAYS:-7}"
LOG_FILE="/var/log/kartawarta-uploads-backup.log"
TIMESTAMP=$(date +%F)
OUTPUT_FILE="$BACKUP_DIR/uploads-$TIMESTAMP.tgz"

if [ ! -d "$UPLOADS_DIR" ]; then
  echo "[$(date -Iseconds)] [uploads-backup] ERROR: uploads dir not found: $UPLOADS_DIR" | tee -a "$LOG_FILE"
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
  rm -f "$OUTPUT_FILE"
  exit 2
fi

# Cross-platform file size (Linux stat -c / macOS stat -f).
FILE_SIZE=$(stat -c%s "$OUTPUT_FILE" 2>/dev/null || stat -f%z "$OUTPUT_FILE" 2>/dev/null || echo "unknown")
echo "[$(date -Iseconds)] [uploads-backup] OK: $OUTPUT_FILE ($FILE_SIZE bytes, $FILE_COUNT source files)" >> "$LOG_FILE"

# Retention: delete local uploads tarballs older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -name "uploads-*.tgz" -mtime +"$RETENTION_DAYS" -delete 2>>"$LOG_FILE" || true

echo "[$(date -Iseconds)] [uploads-backup] Uploads backup completed." >> "$LOG_FILE"
