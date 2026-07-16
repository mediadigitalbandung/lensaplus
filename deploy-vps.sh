#!/bin/bash
# ============================================
# Lensaplus — Full Self-Hosted VPS Deployment
# Ubuntu 24.04 | PostgreSQL + Node.js + Nginx
# ============================================
set -e

DOMAIN="lensaplus.com"
APP_DIR="/var/www/lensaplus"
REPO="https://github.com/mediadigitalbandung/lensaplus.git"
DB_NAME="lensaplus"
DB_USER="lensaplus"
DB_PASS=$(openssl rand -hex 16)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
SETUP_KEY=$(openssl rand -hex 12)
CRON_SECRET=$(openssl rand -hex 12)

echo "=========================================="
echo "  Lensaplus — Full VPS Setup"
echo "=========================================="

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
  cd $APP_DIR && git pull origin master
else
  git clone $REPO $APP_DIR
fi
cd $APP_DIR

# 7. Create .env
echo ""
echo "[7/10] Creating .env..."
cat > $APP_DIR/.env << EOF
# Database (Local PostgreSQL)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

# NextAuth
NEXTAUTH_URL="https://${DOMAIN}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# Setup key (for /api/setup?key=YOUR_KEY)
SETUP_KEY="${SETUP_KEY}"

# App
NEXT_PUBLIC_APP_URL="https://${DOMAIN}"
NEXT_PUBLIC_APP_NAME="Lensaplus"

# Cron
CRON_SECRET="${CRON_SECRET}"

# Email (Resend — optional, isi nanti)
# RESEND_API_KEY=""
# EMAIL_FROM="Lensaplus <noreply@lensaplus.com>"
EOF

echo "  .env created"

# 8. Install deps, push schema & build
echo ""
echo "[8/10] Installing dependencies & building..."
npm ci
npx prisma db push --accept-data-loss
npx prisma generate
npm run build

# 9. Start with PM2
echo ""
echo "[9/10] Starting app with PM2..."
pm2 delete lensaplus 2>/dev/null || true
PORT=3000 pm2 start npm --name "lensaplus" -- start
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
        proxy_pass http://127.0.0.1:3000;
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
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /_next/image {
        proxy_pass http://127.0.0.1:3000;
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

# Seed initial data
echo ""
echo "Seeding initial users..."
curl -s "http://localhost:3000/api/setup?key=${SETUP_KEY}" > /dev/null 2>&1 || true

# Save credentials
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
  NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
  SETUP_KEY:       ${SETUP_KEY}
  CRON_SECRET:     ${CRON_SECRET}

URLs:
  http://${DOMAIN}
  http://145.79.15.99:3000 (direct)

PM2 Commands:
  pm2 status              — check status
  pm2 logs lensaplus     — view logs
  pm2 restart lensaplus  — restart app

Update & Deploy:
  cd ${APP_DIR} && git pull && npm ci && npx prisma db push && npm run build && pm2 restart lensaplus

Setup URL (first time):
  https://${DOMAIN}/api/setup?key=${SETUP_KEY}

============================================
EOF

echo ""
echo "=========================================="
echo "  DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "  Website:  http://145.79.15.99  (atau https://${DOMAIN} jika DNS ready)"
echo ""
echo "  Credentials saved to: /root/lensaplus-credentials.txt"
echo "  View: cat /root/lensaplus-credentials.txt"
echo ""
echo "  SETUP_KEY: ${SETUP_KEY}"
echo "  Buka: https://${DOMAIN}/api/setup?key=${SETUP_KEY}"
echo "  untuk seed user admin & editor awal."
echo ""
echo "=========================================="
