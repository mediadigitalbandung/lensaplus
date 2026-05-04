/**
 * Cron observability — record last-success / last-failure timestamps and the
 * most recent error message per cron job, persisted to SystemSetting so the
 * panel dashboard can surface a "Cron health" widget.
 *
 * Keys written (one per job):
 *   cron_<name>_last_success_at   ISO datetime
 *   cron_<name>_last_run_at       ISO datetime (success OR failure)
 *   cron_<name>_last_error        message (only when failure)
 *   cron_<name>_last_duration_ms  number
 *
 * This is intentionally fire-and-forget — a tracker failure must NEVER take
 * down the cron itself.
 */

import { prisma } from "./prisma";

export type CronJobName =
  | "publish"
  | "auto-article"
  | "sorotan"
  | "seo-submit"
  | "backup"
  | "scrape-sources"
  | "newsletter-digest";

export interface CronRunResult {
  ok: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Record a cron run result. Always returns — never throws.
 */
export async function recordCronRun(
  name: CronJobName,
  result: CronRunResult,
): Promise<void> {
  const now = new Date().toISOString();
  const ops: Promise<unknown>[] = [
    upsertSetting(`cron_${name}_last_run_at`, now),
    upsertSetting(`cron_${name}_last_duration_ms`, String(result.durationMs)),
  ];
  if (result.ok) {
    ops.push(upsertSetting(`cron_${name}_last_success_at`, now));
    ops.push(upsertSetting(`cron_${name}_last_error`, ""));
  } else if (result.error) {
    ops.push(
      upsertSetting(`cron_${name}_last_error`, result.error.slice(0, 500)),
    );
  }
  try {
    await Promise.all(ops);
  } catch {
    /* swallow — tracker must not break the cron */
  }
}

/**
 * Wrap an async cron handler so it auto-records success/failure to
 * SystemSetting, even when the inner function returns a Response (Next.js
 * route handler style). Throws are also caught + recorded + rethrown so the
 * outer errorResponse() can format the response.
 */
export async function trackCron<T>(
  name: CronJobName,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const out = await fn();
    await recordCronRun(name, { ok: true, durationMs: Date.now() - start });
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordCronRun(name, {
      ok: false,
      durationMs: Date.now() - start,
      error: msg,
    });
    throw e;
  }
}

async function upsertSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/**
 * Read cron health for the dashboard. Returns a summary across all jobs.
 */
export async function readCronHealth(): Promise<
  {
    name: CronJobName;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    lastDurationMs: number | null;
    healthy: boolean; // last run was a success AND within reasonable time
  }[]
> {
  const jobs: CronJobName[] = [
    "publish",
    "auto-article",
    "sorotan",
    "seo-submit",
    "backup",
    "scrape-sources",
    "newsletter-digest",
  ];
  const keys = jobs.flatMap((j) => [
    `cron_${j}_last_run_at`,
    `cron_${j}_last_success_at`,
    `cron_${j}_last_error`,
    `cron_${j}_last_duration_ms`,
  ]);
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));

  return jobs.map((name) => {
    const lastRunAt = byKey.get(`cron_${name}_last_run_at`) || null;
    const lastSuccessAt = byKey.get(`cron_${name}_last_success_at`) || null;
    const errRaw = byKey.get(`cron_${name}_last_error`);
    const lastError = errRaw && errRaw.length > 0 ? errRaw : null;
    const durRaw = byKey.get(`cron_${name}_last_duration_ms`);
    const lastDurationMs = durRaw ? parseInt(durRaw, 10) : null;
    // Healthy if the last run succeeded AND there's no error logged.
    const healthy = !lastError && !!lastSuccessAt && lastSuccessAt === lastRunAt;
    return {
      name,
      lastRunAt,
      lastSuccessAt,
      lastError,
      lastDurationMs,
      healthy,
    };
  });
}
