/**
 * Postgres session-level advisory locks for cron idempotency.
 *
 * pg_try_advisory_lock acquires a session-level lock immediately — no
 * blocking. Returns true if the lock was acquired, false if another session
 * already holds it. The lock is released automatically when the DB session
 * closes (end of the Prisma connection), or explicitly via
 * releaseAdvisoryLock().
 *
 * Use this for cron handlers that are non-idempotent (auto-article, sorotan)
 * to prevent concurrent invocations (e.g. Vercel cron + manual curl arriving
 * within the same interval window) from producing duplicate rows.
 */

import { prisma } from "@/lib/prisma";

/**
 * Hash a string key to a signed 63-bit integer suitable for
 * pg_try_advisory_lock. Uses a simple polynomial rolling hash.
 * The sign bit is always 0 to stay safely in Postgres bigint range.
 */
function keyToInt(key: string): bigint {
  let hash = BigInt(0);
  const MOD = (BigInt(1) << BigInt(63)) - BigInt(1); // 2^63 - 1
  for (let i = 0; i < key.length; i++) {
    hash = (hash * BigInt(31) + BigInt(key.charCodeAt(i))) & MOD;
  }
  return hash;
}

/**
 * Attempt to acquire a Postgres session-level advisory lock.
 *
 * @param key  Stable string identifier, e.g. "cron:auto-article".
 * @returns    true if lock was acquired; false if already held by another
 *             session (another cron invocation is in progress — caller
 *             should return a 200 SKIP response).
 */
export async function tryAdvisoryLock(key: string): Promise<boolean> {
  const id = keyToInt(key);
  const result = await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT pg_try_advisory_lock(${id}::bigint) AS ok
  `;
  return result[0]?.ok === true;
}

/**
 * Release a previously acquired advisory lock.
 * Call in a finally block so the lock is freed even when the handler
 * throws, allowing the next cron invocation to proceed without waiting
 * for the DB session to close naturally.
 *
 * Safe to call even if the lock was not acquired (pg_advisory_unlock
 * returns false rather than erroring in that case).
 */
export async function releaseAdvisoryLock(key: string): Promise<void> {
  const id = keyToInt(key);
  await prisma.$executeRaw`SELECT pg_advisory_unlock(${id}::bigint)`;
}
