require("dotenv").config();
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function restoreLatest() {
  const backupDir = "/var/backups/lensaplus";
  if (!fs.existsSync(backupDir)) {
    console.error("❌ No backup directory found at /var/backups/lensaplus");
    return;
  }

  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith(".sql.gz"))
    .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.error("❌ No snapshot backups found in /var/backups/lensaplus");
    return;
  }

  const latest = files[0];
  console.log(`♻️ Restoring Lensaplus database from latest snapshot...`);
  console.log(`   Snapshot File: ${latest.path} (${new Date(latest.time).toLocaleString()})`);

  try {
    execSync(`sudo -u postgres psql -d lensaplus -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'`);
    execSync(`zcat "${latest.path}" | sudo -u postgres psql -d lensaplus`);
    execSync(`sudo -u postgres psql -d lensaplus -c 'GRANT ALL ON SCHEMA public TO kartawarta; GRANT ALL ON ALL TABLES IN SCHEMA public TO kartawarta; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO kartawarta;'`);
    console.log(`✅ Lensaplus database restored successfully from snapshot!`);
  } catch (err) {
    console.error("❌ Failed to restore snapshot:", err.message);
  }
}

if (require.main === module) {
  restoreLatest();
}

module.exports = { restoreLatest };
