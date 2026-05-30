#!/bin/bash
# Async-safe deploy script. Designed to run detached (via nohup + setsid)
# so the GitHub Actions SSH session can disconnect immediately while the
# build continues on the VPS. Status is reported via /tmp/kartawarta-deploy-status
# (written as "OK" or "FAIL: <reason>"); the workflow polls that file.
#
# Why this exists: the previous synchronous deploy held an SSH connection
# open for ~5 minutes while streaming next-build output. The runner-side
# action wrapper (appleboy/ssh-action) accumulated that output in Node
# memory and got SIGKILL'd by the GitHub runner (exit 137) every few runs.
# Splitting trigger + polling keeps every individual SSH call sub-second.

set -u

STATUS_FILE=/tmp/kartawarta-deploy-status
LOG_FILE=/tmp/kartawarta-deploy.log
APP_DIR=/var/www/kartawarta
LOCK=/tmp/kartawarta-build.lock

# Reset status — anything that consumed an old "OK" before this run started
# is now stale and the poller should treat it as in-progress.
rm -f "$STATUS_FILE"

fail() {
  echo "FAIL: $1" > "$STATUS_FILE"
  rm -f "$LOCK"
  exit 1
}

cd "$APP_DIR" || fail "cannot cd to $APP_DIR"

# Build lock — prevents two CI runs (or a manual SSH build) from spawning
# concurrent next-build processes that fight over RAM and orphan jest-workers.
if [ -e "$LOCK" ]; then
  if kill -0 "$(cat "$LOCK" 2>/dev/null)" 2>/dev/null; then
    fail "another build PID $(cat "$LOCK") already running"
  fi
  echo "stale lock found — removing"
  rm -f "$LOCK"
fi
echo $$ > "$LOCK"

# Reap orphan next/jest-worker processes from any prior aborted build —
# they hold open file descriptors on .next/ and pin RAM.
pkill -9 -f 'next/dist/build' 2>/dev/null || true
pkill -9 -f 'jest-worker'     2>/dev/null || true

pm2 stop kartawarta || true
sleep 2

# Drop ANY local file modifications before pulling — hotfixes via scp
# occasionally leave the working tree dirty.
git fetch origin master || fail "git fetch failed"
git reset --hard origin/master || fail "git reset failed"

rm -rf .next
npm install --no-audit --no-fund || fail "npm install failed"
npx prisma generate || fail "prisma generate failed"

# Apply additive schema changes so the regenerated client never references DB
# columns/tables that don't exist yet (that mismatch 500s every query touching
# the changed model). No --accept-data-loss: a destructive diff aborts the
# deploy instead of silently dropping data.
npx prisma db push --skip-generate || fail "prisma db push failed"

# Memory-capped, telemetry-disabled, low-priority build to keep other PM2
# apps responsive on a shared ~16 GB VPS.
NODE_OPTIONS='--max-old-space-size=4096' NEXT_TELEMETRY_DISABLED=1 \
  nice -n 10 npm run build || fail "next build failed"

[ -f .next/BUILD_ID ] || fail "BUILD_ID missing — build failed silently"

pm2 restart kartawarta --update-env || fail "pm2 restart failed"
sleep 3
pm2 list | grep kartawarta || true

echo "OK" > "$STATUS_FILE"
rm -f "$LOCK"
exit 0
