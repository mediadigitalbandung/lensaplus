#!/usr/bin/env node
/**
 * One-shot migration: encrypt existing plaintext SystemSetting values.
 *
 * Usage:
 *   node tools/migrate-encrypt-settings.mjs          # dry-run (default)
 *   node tools/migrate-encrypt-settings.mjs --apply  # actually write to DB
 *
 * Requirements:
 *   - SETTINGS_ENCRYPTION_KEY must be set in environment (or .env loaded manually)
 *   - DATABASE_URL must be set
 *
 * The script skips rows that are already encrypted (value starts with "v1:").
 */

import { createCipheriv, randomBytes } from "crypto";
import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ─── Load .env manually (not relying on dotenv package) ────────────────────
function loadEnv() {
  const envPath = resolve(projectRoot, ".env");
  try {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env not found — rely on already-exported env vars
  }
}
loadEnv();

// ─── Args ──────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes("--apply");

if (DRY_RUN) {
  console.log("[migrate-encrypt-settings] DRY-RUN mode. Pass --apply to write changes.");
} else {
  console.log("[migrate-encrypt-settings] APPLY mode — will write encrypted values to DB.");
}

// ─── Encryption (mirrors src/lib/crypto-secrets.ts) ───────────────────────
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = "v1:";

function getKey() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) {
    console.error(
      "ERROR: SETTINGS_ENCRYPTION_KEY is not set.\n" +
      "Generate one with:  openssl rand -base64 32\n" +
      "Then add to .env:   SETTINGS_ENCRYPTION_KEY=<output>"
    );
    process.exit(1);
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    console.error(
      `ERROR: SETTINGS_ENCRYPTION_KEY decodes to ${buf.length} bytes (need 32).\n` +
      "Re-generate with:  openssl rand -base64 32"
    );
    process.exit(1);
  }
  return buf;
}

function encryptSecret(plaintext, key) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), ct.toString("base64"), tag.toString("base64")].join(":");
}

function isAlreadyEncrypted(value) {
  return value.startsWith(PREFIX);
}

// ─── Sensitive keys (mirrors SENSITIVE_SETTING_KEYS) ─────────────────────
const SENSITIVE_SETTING_KEYS = [
  "deepseek_api_key",
  "anthropic_api_key",
  "google_credentials_json",
  "cloudflare_api_token",
  "twitter_consumer_key",
  "twitter_consumer_secret",
  "twitter_access_token",
  "twitter_access_secret",
  "twitter_bearer_token",
  "resend_api_key",
  "indexnow_key",
];

const SENSITIVE_PATTERN = /(_secret|_token|_key)$/i;

function isSensitiveKey(key) {
  if (SENSITIVE_SETTING_KEYS.includes(key)) return true;
  return SENSITIVE_PATTERN.test(key);
}

// ─── Prisma (loaded via require from project node_modules) ────────────────
const require = createRequire(import.meta.url);
let PrismaClient;
try {
  ({ PrismaClient } = require(resolve(projectRoot, "node_modules/@prisma/client")));
} catch (e) {
  console.error("ERROR: Could not load @prisma/client:", e.message);
  process.exit(1);
}

const prisma = new PrismaClient();

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const key = getKey();

  // Fetch ALL settings and filter to sensitive ones
  const allSettings = await prisma.systemSetting.findMany();
  const sensitiveRows = allSettings.filter((row) => isSensitiveKey(row.key));

  if (sensitiveRows.length === 0) {
    console.log("[migrate-encrypt-settings] No sensitive settings found in DB.");
    return;
  }

  console.log(`\nFound ${sensitiveRows.length} sensitive setting(s):\n`);

  let skipped = 0;
  let toEncrypt = 0;
  let encrypted = 0;
  let errors = 0;

  for (const row of sensitiveRows) {
    if (isAlreadyEncrypted(row.value)) {
      console.log(`  SKIP  ${row.key} — already encrypted (v1:...)`);
      skipped++;
      continue;
    }

    // Show only last 4 chars of value for verification
    const preview = row.value.length > 4
      ? "••••••••" + row.value.slice(-4)
      : "••••••••";
    console.log(`  WILL ENCRYPT  ${row.key}  (current: ${preview})`);
    toEncrypt++;

    if (!DRY_RUN) {
      try {
        const encryptedValue = encryptSecret(row.value, key);
        await prisma.systemSetting.update({
          where: { key: row.key },
          data: { value: encryptedValue },
        });
        console.log(`  OK    ${row.key} encrypted.`);
        encrypted++;
      } catch (e) {
        console.error(`  ERROR encrypting ${row.key}: ${e.message}`);
        errors++;
      }
    }
  }

  console.log("\n─── Summary ───────────────────────────────────────");
  console.log(`  Total sensitive settings : ${sensitiveRows.length}`);
  console.log(`  Already encrypted (skip) : ${skipped}`);
  console.log(`  To encrypt               : ${toEncrypt}`);
  if (!DRY_RUN) {
    console.log(`  Successfully encrypted   : ${encrypted}`);
    console.log(`  Errors                   : ${errors}`);
  } else {
    console.log(`  (dry-run — no changes written)`);
  }

  if (DRY_RUN && toEncrypt > 0) {
    console.log("\nRun with --apply to encrypt these values.");
  }
  if (!DRY_RUN && errors === 0 && toEncrypt > 0) {
    console.log("\nMigration complete. All sensitive settings are now encrypted.");
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
