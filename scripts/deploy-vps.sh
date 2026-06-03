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
#
# Downtime handling: the real app is stopped during the (RAM-heavy) build, so
# while it rebuilds a tiny zero-dependency maintenance server takes over port
# 3000 and serves a branded Kartawarta "sedang memperbarui" page (HTTP 503)
# instead of Cloudflare's default "Bad gateway 502". The previous build is
# kept as .next.old so a failed build rolls back and the site comes straight
# back up.

set -u

STATUS_FILE=/tmp/kartawarta-deploy-status
LOG_FILE=/tmp/kartawarta-deploy.log
APP_DIR=/var/www/kartawarta
LOCK=/tmp/kartawarta-build.lock
MAINT_PID_FILE=/tmp/kartawarta-maintenance.pid
MAINT_LOG=/tmp/kartawarta-maintenance.log
PORT=3000

# Reset status — anything that consumed an old "OK" before this run started
# is now stale and the poller should treat it as in-progress.
rm -f "$STATUS_FILE"

start_maintenance() {
  # Fill the app port with the branded maintenance page while the real app is
  # down. Best-effort: if it can't start, the deploy still proceeds.
  [ -f scripts/maintenance-server.js ] || return 0
  PORT="$PORT" setsid node scripts/maintenance-server.js > "$MAINT_LOG" 2>&1 < /dev/null &
  echo $! > "$MAINT_PID_FILE"
  sleep 1
}

stop_maintenance() {
  if [ -f "$MAINT_PID_FILE" ]; then
    kill "$(cat "$MAINT_PID_FILE" 2>/dev/null)" 2>/dev/null || true
    rm -f "$MAINT_PID_FILE"
  fi
  # Belt-and-suspenders: kill any stray maintenance server still holding 3000,
  # otherwise the real app can't rebind the port.
  pkill -f 'scripts/maintenance-server.js' 2>/dev/null || true
  sleep 1
}

fail() {
  echo "FAIL: $1" > "$STATUS_FILE"
  # Roll back to the previous build if this one didn't produce a usable .next,
  # so the site recovers to the last good version instead of staying down.
  if [ ! -f .next/BUILD_ID ] && [ -d .next.old ]; then
    rm -rf .next
    mv .next.old .next
  fi
  stop_maintenance
  pm2 restart kartawarta --update-env 2>/dev/null \
    || pm2 start ecosystem.config.js 2>/dev/null || true
  rm -f "$LOCK"
  exit 1
}

cd "$APP_DIR" || { echo "FAIL: cannot cd to $APP_DIR" > "$STATUS_FILE"; exit 1; }

# Snapshot load + memory at deploy start. Helps diagnose the recurring
# "dial tcp :22 i/o timeout" the GitHub runner hits on back-to-back deploys:
# if a prior build is still running here, load1 will be high and free RAM low,
# confirming the VPS was simply too busy for sshd to accept the next connect.
echo "=== deploy start (UTC $(date -u '+%Y-%m-%d %H:%M:%S')) ==="
uptime || true
free -m 2>/dev/null | head -2 || true
pgrep -af 'next/dist/build|next build' || echo "(no build currently running)"
echo "==========================================================="

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

# Pull latest source FIRST so the maintenance assets + deploy logic are the
# newest version before we touch the running app. The live app serves a
# precompiled .next, so rewriting source files does not affect it yet.
# Drop ANY local file modifications — hotfixes via scp occasionally leave the
# working tree dirty.
git fetch origin master || fail "git fetch failed"
git reset --hard origin/master || fail "git reset failed"

# Take the app down and immediately put up the branded maintenance page so
# visitors see Kartawarta's page (not Cloudflare's 502) for the whole rebuild.
pm2 stop kartawarta || true
sleep 1
start_maintenance

npm install --no-audit --no-fund || fail "npm install failed"
npx prisma generate || fail "prisma generate failed"

# Apply additive schema changes so the regenerated client never references DB
# columns/tables that don't exist yet (that mismatch 500s every query touching
# the changed model). No --accept-data-loss: a destructive diff aborts the
# deploy instead of silently dropping data.
npx prisma db push --skip-generate || fail "prisma db push failed"

# Keep the previous build as .next.old, then build a fresh .next. If the build
# fails, fail() restores .next.old so the site returns to the last good build.
rm -rf .next.old
[ -d .next ] && mv .next .next.old

# Memory-capped, telemetry-disabled, low-priority build to keep other PM2
# apps responsive on a shared ~16 GB VPS.
NODE_OPTIONS='--max-old-space-size=4096' NEXT_TELEMETRY_DISABLED=1 \
  nice -n 10 npm run build || fail "next build failed"

[ -f .next/BUILD_ID ] || fail "BUILD_ID missing — build failed silently"

# Hand port 3000 back to the real app: stop maintenance, then (re)start.
stop_maintenance
pm2 restart kartawarta --update-env \
  || pm2 start ecosystem.config.js \
  || fail "pm2 restart failed"
sleep 3
pm2 list | grep kartawarta || true

# Build succeeded and the app is back — drop the rollback copy.
rm -rf .next.old

echo "OK" > "$STATUS_FILE"
rm -f "$LOCK"
exit 0
