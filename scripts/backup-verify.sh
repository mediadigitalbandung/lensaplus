#!/bin/bash
#
# backup-verify.sh — Sanity check that the backup pipeline is alive.
#
# Run via cron after backup-db.sh OR manually:
#   /var/www/kartawarta/scripts/backup-verify.sh
#
# Behavior:
#   - Confirms /var/backups/kartawarta has a *.sql.gz from < 36h ago
#   - Confirms gzip file is not truncated (zcat | wc -l > 100)
#   - Optional: pings a webhook (via WEBHOOK_URL env) so a missed run is
#     visible — set WEBHOOK_URL to a Discord/Slack/healthchecks.io URL
#
# Exit codes:
#   0 = healthy
#   1 = no recent backup OR file corrupted
#   2 = backup dir missing
#

set -euo pipefail

BACKUP_DIR="/var/backups/kartawarta"
MAX_AGE_HOURS=36

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[$(date -Is)] FAIL: $BACKUP_DIR does not exist."
  exit 2
fi

LATEST="$(ls -1t "$BACKUP_DIR"/kartawarta-*.sql.gz 2>/dev/null | head -1 || true)"
if [ -z "$LATEST" ]; then
  echo "[$(date -Is)] FAIL: No backup files found in $BACKUP_DIR."
  exit 1
fi

# Age check (macOS/Linux portable)
NOW_EPOCH=$(date +%s)
FILE_EPOCH=$(stat -c %Y "$LATEST" 2>/dev/null || stat -f %m "$LATEST")
AGE_HOURS=$(( (NOW_EPOCH - FILE_EPOCH) / 3600 ))

if [ "$AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
  echo "[$(date -Is)] FAIL: Latest backup '$LATEST' is ${AGE_HOURS}h old (>${MAX_AGE_HOURS}h)."
  if [ -n "${WEBHOOK_URL:-}" ]; then
    curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"Kartawarta backup STALE: ${AGE_HOURS}h since last backup ($LATEST)\"}" \
      "$WEBHOOK_URL" || true
  fi
  exit 1
fi

# Truncation check — a healthy gzipped pg_dump is hundreds of KB and decompresses to thousands of lines
LINES=$(zcat "$LATEST" 2>/dev/null | head -2000 | wc -l)
if [ "$LINES" -lt 100 ]; then
  echo "[$(date -Is)] FAIL: Backup '$LATEST' decompresses to only $LINES lines — likely corrupt."
  if [ -n "${WEBHOOK_URL:-}" ]; then
    curl -fsS -m 10 -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"Kartawarta backup CORRUPT: $LATEST has only $LINES lines\"}" \
      "$WEBHOOK_URL" || true
  fi
  exit 1
fi

SIZE=$(du -h "$LATEST" | cut -f1)
echo "[$(date -Is)] OK: '$LATEST' is ${AGE_HOURS}h old, $SIZE, decompresses fine."
exit 0
