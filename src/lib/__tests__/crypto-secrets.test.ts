/**
 * Unit tests for src/lib/crypto-secrets.ts
 *
 * Tests:
 *   1. encrypt → decrypt round-trip returns original plaintext
 *   2. Two encryptions of same value produce different ciphertexts (random IV)
 *   3. decryptSecret with unknown format (no v1: prefix) returns input as-is
 *   4. encryptSecret with no key returns plaintext unchanged
 *   5. decryptSecret with no key and plain value returns value unchanged
 *   6. decryptSecret with no key but v1: value throws
 *   7. isEncrypted correctly identifies v1: prefix
 *   8. isSensitiveKey covers explicit list and pattern heuristic
 *   9. maskSecret always hides all but last 4 chars
 *  10. encryptSecret with wrong key length throws on key decode
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// We load the module fresh per group so env changes take effect.
// vitest does module caching — use dynamic import after setting env.

const VALID_KEY_B64 = Buffer.alloc(32, 0xab).toString("base64"); // deterministic 32-byte key

function setKey(value: string | undefined) {
  if (value === undefined) {
    delete process.env.SETTINGS_ENCRYPTION_KEY;
  } else {
    process.env.SETTINGS_ENCRYPTION_KEY = value;
  }
}

// Helper: fresh import so each test group picks up the current env.
async function importFresh() {
  // Vitest doesn't invalidate module cache between imports in the same test run,
  // but crypto-secrets reads the env at call time (not module load time), so
  // we can reuse the import and just change env between calls.
  return import("../crypto-secrets");
}

describe("crypto-secrets — with key configured", () => {
  beforeEach(() => {
    setKey(VALID_KEY_B64);
  });

  afterEach(() => {
    setKey(undefined);
  });

  it("Test 1: encrypt then decrypt returns original plaintext", async () => {
    const { encryptSecret, decryptSecret } = await importFresh();
    const original = "sk-ant-api03-supersecretkey123";
    const encrypted = encryptSecret(original);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it("Test 2: two encryptions of the same value produce different ciphertexts (random IV)", async () => {
    const { encryptSecret } = await importFresh();
    const original = "same-value-twice";
    const enc1 = encryptSecret(original);
    const enc2 = encryptSecret(original);
    // Both must be valid v1: format
    expect(enc1.startsWith("v1:")).toBe(true);
    expect(enc2.startsWith("v1:")).toBe(true);
    // But must differ due to random IV
    expect(enc1).not.toBe(enc2);
  });

  it("Test 3: decrypt unknown format (no v1: prefix) returns input as-is (legacy plaintext)", async () => {
    const { decryptSecret } = await importFresh();
    const legacy = "plaintext-api-key-stored-before-encryption";
    expect(decryptSecret(legacy)).toBe(legacy);
  });

  it("Test 4: decrypt with corrupted ciphertext throws (tampering detection)", async () => {
    const { encryptSecret, decryptSecret } = await importFresh();
    const encrypted = encryptSecret("sensitive-data");
    // Split "v1:iv:ct:tag" and corrupt the ciphertext segment
    const parts = encrypted.split(":");
    // parts = ["v1", iv_b64, ct_b64, tag_b64]
    // Corrupt the ciphertext by replacing it with a completely different base64 value
    const corruptedCt = Buffer.alloc(16, 0xff).toString("base64");
    parts[2] = corruptedCt;
    const tampered = parts.join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("Test 5: isEncrypted returns true for v1: prefix, false otherwise", async () => {
    const { isEncrypted, encryptSecret } = await importFresh();
    const encrypted = encryptSecret("some-key");
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted("plaintext")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });

  it("Test 6: round-trip with multi-line Google JSON credential", async () => {
    const { encryptSecret, decryptSecret } = await importFresh();
    const json = JSON.stringify({
      type: "service_account",
      client_email: "test@project.iam.gserviceaccount.com",
      private_key: "-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n",
    });
    expect(decryptSecret(encryptSecret(json))).toBe(json);
  });
});

describe("crypto-secrets — without key configured", () => {
  beforeEach(() => {
    setKey(undefined);
  });

  afterEach(() => {
    setKey(undefined);
  });

  it("Test 7: encryptSecret returns plaintext as-is when no key set", async () => {
    const { encryptSecret } = await importFresh();
    const value = "my-api-key";
    const result = encryptSecret(value);
    expect(result).toBe(value);
    expect(result.startsWith("v1:")).toBe(false);
  });

  it("Test 8: decryptSecret returns plaintext as-is for non-v1 value when no key set", async () => {
    const { decryptSecret } = await importFresh();
    const value = "legacy-plain-value";
    expect(decryptSecret(value)).toBe(value);
  });

  it("Test 9: decryptSecret throws when encountering v1: value but key is not set", async () => {
    // First encrypt with key, then unset key and try to decrypt.
    setKey(VALID_KEY_B64);
    const { encryptSecret } = await importFresh();
    const encrypted = encryptSecret("need-decryption");
    setKey(undefined);
    // Re-import to pick up env change (cache miss for getKey internal warn state)
    const { decryptSecret } = await importFresh();
    expect(() => decryptSecret(encrypted)).toThrow(/SETTINGS_ENCRYPTION_KEY/);
  });
});

describe("crypto-secrets — wrong key length", () => {
  afterEach(() => {
    setKey(undefined);
  });

  it("Test 10: encryptSecret throws when key decodes to wrong byte length", async () => {
    // 16-byte key encoded as base64 — too short for AES-256
    const shortKey = Buffer.alloc(16, 0x01).toString("base64");
    setKey(shortKey);
    const { encryptSecret } = await importFresh();
    expect(() => encryptSecret("value")).toThrow(/32 bytes/);
  });
});

describe("crypto-secrets — isSensitiveKey", () => {
  it("Test 11: explicit sensitive keys are recognized", async () => {
    const { isSensitiveKey } = await importFresh();
    expect(isSensitiveKey("deepseek_api_key")).toBe(true);
    expect(isSensitiveKey("anthropic_api_key")).toBe(true);
    expect(isSensitiveKey("google_credentials_json")).toBe(true);
    expect(isSensitiveKey("cloudflare_api_token")).toBe(true);
    expect(isSensitiveKey("twitter_consumer_secret")).toBe(true);
    expect(isSensitiveKey("twitter_access_secret")).toBe(true);
    expect(isSensitiveKey("twitter_bearer_token")).toBe(true);
    expect(isSensitiveKey("resend_api_key")).toBe(true);
    expect(isSensitiveKey("indexnow_key")).toBe(true);
  });

  it("Test 12: pattern heuristic catches _secret, _token, _key suffixes", async () => {
    const { isSensitiveKey } = await importFresh();
    expect(isSensitiveKey("my_custom_secret")).toBe(true);
    expect(isSensitiveKey("some_oauth_token")).toBe(true);
    expect(isSensitiveKey("integration_api_key")).toBe(true);
  });

  it("Test 13: non-sensitive keys are not flagged", async () => {
    const { isSensitiveKey } = await importFresh();
    expect(isSensitiveKey("site_name")).toBe(false);
    expect(isSensitiveKey("enable_comments")).toBe(false);
    expect(isSensitiveKey("cloudflare_zone_id")).toBe(false);
    expect(isSensitiveKey("ga4_property_id")).toBe(false);
    expect(isSensitiveKey("auto_article_enabled")).toBe(false);
  });
});

describe("crypto-secrets — maskSecret", () => {
  it("Test 14: masks all but last 4 characters", async () => {
    const { maskSecret } = await importFresh();
    const masked = maskSecret("sk-ant-api03-abcdefghij1234");
    expect(masked).toBe("••••••••1234");
  });

  it("Test 15: short values always show bullet mask", async () => {
    const { maskSecret } = await importFresh();
    expect(maskSecret("abc")).toBe("••••••••");
    expect(maskSecret("1234")).toBe("••••••••");
  });
});
