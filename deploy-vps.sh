#!/bin/bash
# ============================================
# Lensaplus — Initial One-Time VPS Bootstrap Script
# Ubuntu 24.04 | PostgreSQL + Node.js + Nginx + PM2
# ============================================
#
# PERINGATAN OPERATOR:
#   Skrip ini HANYA untuk provisioning awal (first-time setup) pada VPS baru.
#   Untuk deployment / pembaruan produksi rutin pada VPS yang sudah berjalan,
#   GUNAKAN SELALU:
#
#     cd /var/www/lensaplus && bash scripts/deploy-vps.sh
#
# Required environment variables generated in /var/www/lensaplus/.env:
#   - DATABASE_URL
#   - NEXTAUTH_URL, NEXTAUTH_SECRET
#   - SETTINGS_ENCRYPTION_KEY (32-byte base64 via `openssl rand -base64 32`)
#   - SETUP_KEY, CRON_SECRET
# ============================================
set -euo pipefail

DOMAIN="lensaplus.com"
APP_DIR="/var/www/lensaplus"
REPO="https://github.com/mediadigitalbandung/lensaplus.git"
DB_NAME="lensaplus"
DB_USER="lensaplus"
DB_PASS=$(openssl rand -hex 16)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
SETTINGS_ENCRYPTION_KEY=$(openssl rand -base64 32)
SETUP_KEY=$(openssl rand -hex 12)
CRON_SECRET=$(openssl rand -hex 12)

ensure_settings_encryption_key() {
  # Safely ensure SETTINGS_ENCRYPTION_KEY exists and is non-empty in an existing
  # .env file without ever overwriting an already-configured key.
  local env_file="$1"
  [ -f "$env_file" ] || return 0

  local has_key_line=0
  local has_non_empty=0
  local line=""
  local raw_val=""

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    local trimmed_left="${line#"${line%%[![:space:]]*}"}"
    if [[ "$trimmed_left" == SETTINGS_ENCRYPTION_KEY=* ]]; then
      has_key_line=1
      raw_val="${trimmed_left#SETTINGS_ENCRYPTION_KEY=}"
      raw_val="$(printf '%s' "$raw_val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
      if [ -n "$raw_val" ]; then
        has_non_empty=1
        break
      fi
    fi
  done < "$env_file"

  if [ "$has_non_empty" -eq 1 ]; then
    echo "  SETTINGS_ENCRYPTION_KEY already set in $env_file (preserved)"
    return 0
  fi

  local new_key=""
  new_key="$(openssl rand -base64 32 | tr -d '\r\n')"
  if [ "$has_key_line" -eq 1 ]; then
    local tmp_env="${env_file}.tmp.$$"
    NEW_KEY="$new_key" awk '
      BEGIN { updated = 0 }
      /^[[:space:]]*SETTINGS_ENCRYPTION_KEY=/ && !updated {
        print "SETTINGS_ENCRYPTION_KEY=\"" ENVIRON["NEW_KEY"] "\""
        updated = 1
        next
      }
      { print }
    ' "$env_file" > "$tmp_env"
    chmod --reference="$env_file" "$tmp_env" 2>/dev/null || chmod 600 "$tmp_env"
    mv "$tmp_env" "$env_file"
    echo "  Populated empty SETTINGS_ENCRYPTION_KEY in $env_file (32-byte base64)"
  else
    if [ -s "$env_file" ] && [ -n "$(tail -c 1 "$env_file" 2>/dev/null)" ]; then
      printf '\n' >> "$env_file"
    fi
    {
      printf '\n# Settings AES-256-GCM encryption key (32-byte base64, auto-generated)\n'
      printf 'SETTINGS_ENCRYPTION_KEY="%s"\n' "$new_key"
    } >> "$env_file"
    echo "  Generated and appended SETTINGS_ENCRYPTION_KEY to $env_file (32-byte base64)"
  fi
}

echo "=========================================="
echo "  Lensaplus — Initial VPS Bootstrap"
echo "  (For routine deploys, use: bash scripts/deploy-vps.sh)"
echo "=========================================="

# Guard against accidental re-run on an already-provisioned production server
if [ -f "$APP_DIR/.env" ] && [ "${ALLOW_REBOOTSTRAP:-0}" != "1" ]; then
  echo ""
  echo "ERROR: $APP_DIR/.env sudah ada — server ini sudah di-provision."
  echo "Untuk deploy pembaruan produksi rutin, jalankan:"
  echo "  cd $APP_DIR && bash scripts/deploy-vps.sh"
  echo ""
  echo "Jika Anda benar-benar ingin menjalankan ulang bootstrap (tanpa menimpa .env),"
  echo "jalankan dengan: ALLOW_REBOOTSTRAP=1 bash deploy-vps.sh"
  exit 1
fi

# 1. Update system
echo ""
echo "[1/10] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y

# 2. Install Node.js 20
echo ""
echo "[2/10] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "  Node.js $(node -v)"
echo "  npm $(npm -v)"

# 3. Install PostgreSQL
echo ""
echo "[3/10] Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# Create database & user
echo "  Creating database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"
echo "  Database '${DB_NAME}' ready"

# 4. Install Nginx & Certbot
echo ""
echo "[4/10] Installing Nginx & Certbot..."
apt install -y nginx certbot python3-certbot-nginx
systemctl enable nginx

# 5. Install PM2
echo ""
echo "[5/10] Installing PM2..."
npm install -g pm2

# 6. Clone repo
echo ""
echo "[6/10] Cloning repository..."
mkdir -p /var/www
if [ -d "$APP_DIR" ]; then
  echo "  Directory exists, pulling latest..."
  cd "$APP_DIR" && git pull origin master
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

# 7. Create .env (never overwrite an existing .env)
echo ""
echo "[7/10] Configuring .env..."
CREATED_FRESH_ENV=0
if [ -f "$APP_DIR/.env" ]; then
  echo "  Existing .env preserved (will not overwrite)"
  ensure_settings_encryption_key "$APP_DIR/.env"
else
  cat > "$APP_DIR/.env" << EOF
# Database (Local PostgreSQL)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

# NextAuth
NEXTAUTH_URL="https://${DOMAIN}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# Settings AES-256-GCM encryption key (32-byte base64: openssl rand -base64 32)
SETTINGS_ENCRYPTION_KEY="${SETTINGS_ENCRYPTION_KEY}"

# Setup key (for /api/setup?key=YOUR_KEY)
SETUP_KEY="${SETUP_KEY}"

# App
NEXT_PUBLIC_APP_URL="https://${DOMAIN}"
NEXT_PUBLIC_SITE_URL="https://${DOMAIN}"
NEXT_PUBLIC_APP_NAME="Lensaplus"

# Cron
CRON_SECRET="${CRON_SECRET}"

# Email (Resend — optional, isi nanti)
# RESEND_API_KEY=""
# EMAIL_FROM="Lensaplus <noreply@lensaplus.com>"
EOF
  chmod 600 "$APP_DIR/.env"
  CREATED_FRESH_ENV=1
  echo "  .env created (chmod 600)"
fi

# 8. Install deps, push schema (WITHOUT --accept-data-loss), typecheck & build
echo ""
echo "[8/10] Installing dependencies, verifying schema/types & building..."
npm ci
npx prisma generate
# Never pass --accept-data-loss; destructive schema changes must be reviewed manually.
npx prisma db push --skip-generate
npx tsc --noEmit
npm run build

# 9. Start with PM2
echo ""
echo "[9/10] Starting app with PM2..."
pm2 delete lensaplus 2>/dev/null || true
if [ -f "$APP_DIR/ecosystem.config.js" ]; then
  pm2 start "$APP_DIR/ecosystem.config.js" --only lensaplus
else
  PORT=3002 pm2 start npm --name "lensaplus" -- start
fi
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# Wait for app to start
echo "  Waiting for app to start..."
sleep 5

# 10. Configure Nginx
echo ""
echo "[10/10] Configuring Nginx..."
cat > /etc/nginx/sites-available/lensaplus << 'NGINXEOF'
server {
    listen 80;
    server_name lensaplus.com www.lensaplus.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        client_max_body_size 20M;
    }

    location /_next/static {
        proxy_pass http://127.0.0.1:3002;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /_next/image {
        proxy_pass http://127.0.0.1:3002;
        add_header Cache-Control "public, max-age=86400";
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/lensaplus /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# SSL — only if DNS is pointing to this server
echo ""
echo "Attempting SSL setup..."
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} \
  --non-interactive --agree-tos \
  -m mediadigitalbandung@gmail.com 2>/dev/null && \
  echo "  SSL certificate installed!" || \
  echo "  SSL skipped (DNS not ready yet). Run later: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"

# Enable auto-renew
systemctl enable certbot.timer 2>/dev/null || true

# Firewall
echo ""
echo "Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Seed initial data (only on fresh install)
if [ "$CREATED_FRESH_ENV" -eq 1 ]; then
  echo ""
  echo "Seeding initial users..."
  curl -s "http://localhost:3002/api/setup?key=${SETUP_KEY}" > /dev/null 2>&1 || true

  # Save credentials (chmod 600)
  cat > /root/lensaplus-credentials.txt << EOF
============================================
  LENSAPLUS — Server Credentials
  Generated: $(date)
============================================

Database:
  Host:     localhost
  Port:     5432
  Name:     ${DB_NAME}
  User:     ${DB_USER}
  Password: ${DB_PASS}
  URL:      postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}

App:
  NEXTAUTH_SECRET:         ${NEXTAUTH_SECRET}
  SETTINGS_ENCRYPTION_KEY: ${SETTINGS_ENCRYPTION_KEY}
  SETUP_KEY:               ${SETUP_KEY}
  CRON_SECRET:             ${CRON_SECRET}

URLs:
  http://${DOMAIN}
  http://145.79.15.99:3002 (direct)

PM2 Commands:
  pm2 status              — check status
  pm2 logs lensaplus     — view logs
  pm2 restart lensaplus  — restart app

Update & Routine Deploy (ALWAYS use scripts/deploy-vps.sh):
  cd ${APP_DIR} && bash scripts/deploy-vps.sh

Setup URL (first time):
  https://${DOMAIN}/api/setup?key=${SETUP_KEY}

============================================
EOF
  chmod 600 /root/lensaplus-credentials.txt
fi

echo ""
echo "=========================================="
echo "  BOOTSTRAP COMPLETE!"
echo "=========================================="
echo ""
echo "  Website:  http://145.79.15.99  (atau https://${DOMAIN} jika DNS ready)"
echo "  Routine deploys: cd ${APP_DIR} && bash scripts/deploy-vps.sh"
if [ "$CREATED_FRESH_ENV" -eq 1 ]; then
  echo ""
  echo "  Credentials saved to: /root/lensaplus-credentials.txt"
  echo "  SETUP_KEY: ${SETUP_KEY}"
  echo "  Buka: https://${DOMAIN}/api/setup?key=${SETUP_KEY}"
fi
echo ""
echo "=========================================="
