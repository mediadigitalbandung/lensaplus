#!/usr/bin/env bash
# ==============================================================================
# Lensaplus Ubuntu VPS Initial Setup Script
# ==============================================================================
# This script sets up a clean Ubuntu VPS (22.04 LTS or 24.04 LTS) for Lensaplus.
# Run this script on the VPS as the root user:
#   sudo chmod +x vps-setup.sh && sudo ./vps-setup.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0;0m' # No Color

echo -e "${GREEN}=== Starting Lensaplus VPS Setup ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}ERROR: Please run this script as root (sudo)${NC}" >&2
  exit 1
fi

# Ask for the database password
echo -e "${YELLOW}Please enter the password for the 'lensaplus' PostgreSQL user:${NC}"
read -s DB_PASS
if [ -z "$DB_PASS" ]; then
  echo -e "${RED}ERROR: Password cannot be empty.${NC}" >&2
  exit 1
fi

# 1. Update and Upgrade System
echo -e "\n${YELLOW}[1/6] Updating system packages...${NC}"
apt-get update -y
apt-get upgrade -y

# Install common utilities
apt-get install -y curl git build-essential ufw software-properties-common jq

# 2. Install Node.js 20.x
echo -e "\n${YELLOW}[2/6] Installing Node.js v20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
echo -e "Node version: $(node -v)"
echo -e "NPM version: $(npm -v)"

# 3. Install PostgreSQL
echo -e "\n${YELLOW}[3/6] Installing PostgreSQL...${NC}"
apt-get install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create Database and User
echo -e "${YELLOW}Setting up PostgreSQL database and user...${NC}"
# Drop user and db if they exist to avoid conflict on retry
sudo -u postgres psql -c "DROP DATABASE IF EXISTS lensaplus;" || true
sudo -u postgres psql -c "DROP USER IF EXISTS lensaplus;" || true

# Setup fresh user and DB
sudo -u postgres psql -c "CREATE USER lensaplus WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE lensaplus OWNER lensaplus;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lensaplus TO lensaplus;"

# Allow local connections (standard PostgreSQL pg_hba.conf is usually preconfigured for md5/scram-sha-256)
systemctl restart postgresql

# 4. Install Global NPM Packages (PM2)
echo -e "\n${YELLOW}[4/6] Installing PM2...${NC}"
npm install -g pm2
pm2 --version

# 5. Install Nginx and Certbot
echo -e "\n${YELLOW}[5/6] Installing Nginx and Certbot...${NC}"
apt-get install -y nginx certbot python3-certbot-nginx

# Start Nginx
systemctl start nginx
systemctl enable nginx

# 6. Setup Folders and Logs
echo -e "\n${YELLOW}[6/6] Creating deployment folders and log files...${NC}"
# Backup folders
mkdir -p /var/backups/lensaplus/pre-push

# Log files
touch /var/log/lensaplus-cron.log \
      /var/log/lensaplus-backup.log \
      /var/log/lensaplus-uploads-backup.log \
      /var/log/lensaplus-offsite.log \
      /var/log/lensaplus-backup-verify.log \
      /var/log/lensaplus-restore-drill.log \
      /var/log/lensaplus-deploy.log

# Set permissions
chown -R root:root /var/backups/lensaplus
chmod -R 755 /var/backups/lensaplus
chown root:root /var/log/lensaplus-*.log
chmod 644 /var/log/lensaplus-*.log

# Configure Firewall
echo -e "\n${YELLOW}Configuring Firewall (UFW)...${NC}"
ufw allow OpenSSH
ufw allow 'Nginx Full'
# Enable UFW (skip interactive prompt)
ufw --force enable
ufw status

echo -e "\n${GREEN}=== Lensaplus VPS Setup Completed Successfully! ===${NC}"
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Point your domain A records to this VPS IP."
echo -e "2. Clone your repository into: /var/www/lensaplus"
echo -e "3. Create a .env file from scripts/lensaplus.env.example"
echo -e "4. Follow Step 4 to Step 6 of the Implementation Plan to build the app, set up Nginx SSL, and add crontabs."
