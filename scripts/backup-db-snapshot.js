require("dotenv").config();
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function createSnapshot() {
  const backupDir = "/var/backups/lensaplus";
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(backupDir, `lensaplus-recycle-snapshot-${timestamp}.sql.gz`);

  console.log(`📦 Creating safety snapshot for Lensaplus database...`);
  console.log(`   Destination: ${backupFile}`);

  try {
    execSync(`sudo -u postgres pg_dump -d lensaplus | gzip > "${backupFile}"`);
    console.log(`✅ Safety snapshot created successfully! (${fs.statSync(backupFile).size} bytes)`);
    return backupFile;
  } catch (err) {
    console.error("❌ Failed to create snapshot:", err.message);
    return null;
  }
}

if (require.main === module) {
  createSnapshot();
}

module.exports = { createSnapshot };
