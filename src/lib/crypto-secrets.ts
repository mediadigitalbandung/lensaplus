/**
 * AES-256-GCM encryption for sensitive SystemSetting values.
 *
 * Key source: env `SETTINGS_ENCRYPTION_KEY` (base64-encoded 32 bytes).
 * Generate:   openssl rand -base64 32
 *
 * Stored format: "v1:<iv_b64>:<ct_b64>:<tag_b64>"
 * Legacy (no prefix): plaintext, returned as-is by decryptSecret.
 *
 * When SETTINGS_ENCRYPTION_KEY is not set:
 *   - encryptSecret returns the plaintext unchanged (dev-friendly)
 *   - decryptSecret returns the stored value unchanged
 *   - A one-time console.warn fires the first time either function runs
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;    // 96-bit IV — recommended for GCM
const TAG_BYTES = 16;   // 128-bit auth tag
const PREFIX = "v1:";

let _keyWarnFired = false;

function getKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) {
    if (!_keyWarnFired) {
      _keyWarnFired = true;
      console.warn(
        "[crypto-secrets] SETTINGS_ENCRYPTION_KEY is not set. " +
          "Sensitive settings will be stored UNENCRYPTED. " +
          "Generate a key with: openssl rand -base64 32",
      );
    }
    return null;
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `[crypto-secrets] SETTINGS_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${buf.length}). ` +
        "Re-generate with: openssl rand -base64 32",
    );
  }
  return buf;
}

/**
 * Encrypt a plaintext string.
 * Returns "v1:<iv>:<ciphertext>:<tag>" (all base64).
 * If SETTINGS_ENCRYPTION_KEY is not configured, returns plaintext as-is.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  }) as crypto.CipherGCM;

  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX.slice(0, -1),  // "v1"
    iv.toString("base64"),
    ct.toString("base64"),
    tag.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a stored value.
 * Detects the "v1:" prefix — if absent, returns the value as-is (legacy plaintext).
 * If SETTINGS_ENCRYPTION_KEY is not configured but a v1: value is encountered,
 * throws so the misconfiguration is surfaced loudly.
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) {
    // Legacy unencrypted value — return as-is.
    return stored;
  }

  const key = getKey();
  if (!key) {
    throw new Error(
      "[crypto-secrets] Encountered encrypted value (v1:) but SETTINGS_ENCRYPTION_KEY is not set. " +
        "Configure the key to decrypt.",
    );
  }

  const parts = stored.split(":");
  // Expected parts: ["v1", iv_b64, ct_b64, tag_b64]
  if (parts.length !== 4) {
    throw new Error("[crypto-secrets] Malformed encrypted value: expected 4 colon-separated segments.");
  }

  const [, ivB64, ctB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_BYTES,
  }) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Returns true if the stored value is encrypted with this library.
 */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

// ─── Sensitive key registry ────────────────────────────────────────

/**
 * Explicit list of SystemSetting keys that must be encrypted at rest.
 * Any key matching _sensitivePattern below is also treated as sensitive.
 */
export const SENSITIVE_SETTING_KEYS: ReadonlyArray<string> = [
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
] as const;

/** Pattern: any key containing _secret, _token, or _key suffix/substring */
const _sensitivePattern = /(_secret|_token|_key)$/i;

/**
 * Returns true if a SystemSetting key should be encrypted.
 * Covers explicit list + name-pattern heuristic.
 */
export function isSensitiveKey(key: string): boolean {
  if ((SENSITIVE_SETTING_KEYS as string[]).includes(key)) return true;
  return _sensitivePattern.test(key);
}

/**
 * Return a masked representation for display (e.g. in panel GET response).
 * Shows "••••••••" + last 4 characters so user can verify which key is stored
 * without exposing the full value.
 */
export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••••••";
  return "••••••••" + plaintext.slice(-4);
}
