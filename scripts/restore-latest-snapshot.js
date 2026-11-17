require("dotenv").config();
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function resolvePgIdentifier(value, fallback) {
  const candidate = (value || fallback).trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(candidate)) {
    throw new Error(`Invalid PostgreSQL identifier: ${candidate}`);
  }
  return candidate;
}

function resolveDbConfig() {
  let urlUser = "";
  let urlDb = "";
  if (process.env.DATABASE_URL) {
    try {
      const parsed = new URL(process.env.DATABASE_URL);
      urlUser = decodeURIComponent(parsed.username || "");
      urlDb = parsed.pathname.replace(/^\//, "");
    } catch {
      // Fallback to explicit env or defaults below
    }
  }
  return {
    dbUser: resolvePgIdentifier(process.env.DB_USER || urlUser, "lensaplus"),
    dbName: resolvePgIdentifier(process.env.DB_NAME || urlDb, "lensaplus"),
  };
}

function restoreLatest() {
  const backupDir = "/var/backups/lensaplus";
  if (!fs.existsSync(backupDir)) {
    console.error("❌ No backup directory found at /var/backups/lensaplus");
    process.exitCode = 1;
    return;
  }

  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith(".sql.gz"))
    .map(f => ({ name: f, path: path.join(backupDir, f), time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.error("❌ No snapshot backups found in /var/backups/lensaplus");
    process.exitCode = 1;
    return;
  }

  const latest = files[0];
  const { dbUser, dbName } = resolveDbConfig();
  console.log(`♻️ Restoring Lensaplus database (${dbName}) from latest snapshot...`);
  console.log(`   Snapshot File: ${latest.path} (${new Date(latest.time).toLocaleString()})`);

  try {
    execSync(`sudo -u postgres psql -d "${dbName}" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'`);
    execSync(`zcat "${latest.path}" | sudo -u postgres psql -d "${dbName}"`);
    execSync(`sudo -u postgres psql -d "${dbName}" -c 'GRANT ALL ON SCHEMA public TO "${dbUser}"; GRANT ALL ON ALL TABLES IN SCHEMA public TO "${dbUser}"; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "${dbUser}";'`);
    console.log(`✅ Lensaplus database restored successfully from snapshot (role: ${dbUser})!`);
  } catch (err) {
    console.error("❌ Failed to restore snapshot:", err.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  restoreLatest();
}

module.exports = { restoreLatest };
