/**
 * TOTP (RFC 6238) + backup codes — self-contained, no external dependency.
 * Compatible with Google Authenticator / Authy (SHA1, 6 digits, 30s period).
 *
 * Pure crypto only (no DB). The API layer encrypts the secret at rest via
 * crypto-secrets and persists it on the user row.
 */

import crypto from "crypto";

const PERIOD = 30; // seconds
const DIGITS = 6;
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// ── Base32 (RFC 4648, no padding) ───────────────────────────────────────────
function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Generate a new base32 TOTP secret (160-bit). */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** Compute the TOTP code for a given secret at a given counter (time step). */
function hotp(secretBase32: string, counter: number): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Current TOTP code (mainly for tests/debug). */
export function totpNow(secretBase32: string, atMs = Date.now()): string {
  return hotp(secretBase32, Math.floor(atMs / 1000 / PERIOD));
}

/**
 * Verify a user-entered 6-digit code, allowing ±`window` steps of clock drift.
 * Timing-safe comparison.
 */
export function verifyTotp(secretBase32: string, token: string, window = 1, atMs = Date.now()): boolean {
  const cleaned = (token || "").replace(/\D/g, "");
  if (cleaned.length !== DIGITS) return false;
  const counter = Math.floor(atMs / 1000 / PERIOD);
  for (let d = -window; d <= window; d++) {
    const expected = hotp(secretBase32, counter + d);
    const a = Buffer.from(expected);
    const b = Buffer.from(cleaned);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Build the otpauth:// URI for QR enrollment. */
export function otpauthUri(secretBase32: string, account: string, issuer = "Lensaplus"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── Backup codes ─────────────────────────────────────────────────────────────
const BACKUP_COUNT = 10;

/** Generate plaintext backup codes (shown ONCE) — format "xxxx-xxxx". */
export function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_COUNT }, () => {
    const hex = crypto.randomBytes(4).toString("hex"); // 8 hex chars
    return `${hex.slice(0, 4)}-${hex.slice(4)}`;
  });
}

const norm = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, "");
export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(norm(code)).digest("hex");
}

/** Serialize hashed backup codes for DB storage. */
export function hashBackupCodes(codes: string[]): string {
  return JSON.stringify(codes.map(hashBackupCode));
}

/**
 * Check a backup code against the stored hash list. Returns the remaining
 * serialized list (with the used code removed) if matched, else null.
 */
export function consumeBackupCode(storedJson: string | null, code: string): string | null {
  if (!storedJson) return null;
  let hashes: string[];
  try { hashes = JSON.parse(storedJson); } catch { return null; }
  if (!Array.isArray(hashes)) return null;
  const target = hashBackupCode(code);
  const idx = hashes.findIndex((h) => {
    const a = Buffer.from(h);
    const b = Buffer.from(target);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (idx === -1) return null;
  hashes.splice(idx, 1);
  return JSON.stringify(hashes);
}
