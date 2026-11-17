import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_MS = 10 * 60_000;
const LOCK_PREFIX = "cron_lock_";

// Fallback token registry only for legacy tryAdvisoryLock/releaseAdvisoryLock callers.
const legacyTokens = new Map<string, string>();

/**
 * Acquire an atomic, lease-based PostgreSQL lock stored in `system_settings`.
 *
 * Uses a single-statement `INSERT ... ON CONFLICT DO UPDATE ... WHERE expired`
 * query so connection pooling (PgBouncer / Prisma pool) never splits lock
 * acquisition and release across different backend PostgreSQL sessions.
 *
 * Returns an opaque owner token string when acquired, or `null` if another
 * active run holds a non-expired lease (or on database error).
 */
export async function acquireCronLock(
  key: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<string | null> {
  const token = randomBytes(16).toString("hex");
  const nowMs = Date.now();
  const expiresAt = nowMs + Math.max(1_000, Math.floor(ttlMs));
  const settingKey = `${LOCK_PREFIX}${key}`;
  const value = `${expiresAt}:${token}`;
  const nowStr = String(nowMs);

  try {
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      INSERT INTO "system_settings" ("id", "key", "value")
      VALUES (${settingKey}, ${settingKey}, ${value})
      ON CONFLICT ("key") DO UPDATE
        SET "value" = EXCLUDED."value"
        WHERE (
          CASE
            WHEN split_part("system_settings"."value", ':', 1) ~ '^[0-9]{1,15}$'
            THEN (split_part("system_settings"."value", ':', 1))::bigint
            ELSE 0
          END
        ) <= (${nowStr})::bigint
      RETURNING "value"
    `;

    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.value === value) {
      return token;
    }
    return null;
  } catch (err) {
    console.error(`[cron-lock] Failed to acquire lock "${key}":`, err);
    return null;
  }
}

/**
 * Release a lease lock only if the stored owner token matches `token`.
 * Safe against deleting another worker's lock after TTL expiration.
 */
export async function releaseCronLock(
  key: string,
  token: string | null | undefined,
): Promise<void> {
  if (!token) return;
  const settingKey = `${LOCK_PREFIX}${key}`;
  try {
    await prisma.$executeRaw`
      DELETE FROM "system_settings"
      WHERE "key" = ${settingKey}
        AND split_part("value", ':', 2) = ${token}
    `;
  } catch (err) {
    console.warn(`[cron-lock] Failed to release lock "${key}":`, err);
  }
}

/**
 * Legacy boolean wrapper for `acquireCronLock`. Prefer `acquireCronLock` +
 * `releaseCronLock` with an explicit owner token in new code.
 */
export async function tryAdvisoryLock(
  key: string,
  ttlMs = DEFAULT_TTL_MS,
): Promise<boolean> {
  const token = await acquireCronLock(key, ttlMs);
  if (!token) return false;
  legacyTokens.set(key, token);
  return true;
}

/**
 * Legacy boolean-pair release wrapper.
 */
export async function releaseAdvisoryLock(key: string): Promise<void> {
  const token = legacyTokens.get(key);
  legacyTokens.delete(key);
  if (token) {
    await releaseCronLock(key, token);
  }
}
