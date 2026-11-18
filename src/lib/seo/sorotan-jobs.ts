import { randomUUID } from "node:crypto";
import {
  generateSorotan,
  type GenerateSorotanOptions,
  type GenerateSorotanResult,
} from "./sorotan-generator";

export interface SorotanJobStatus {
  jobId: string;
  status: "running" | "done";
  totalArticles: number;
  completedArticles: number;
  currentArticleId: string | null;
  articleIds: string[];
  totalCreated: number;
  totalSkipped: number;
  totalErrors: number;
  errors: string[];
  results: GenerateSorotanResult[];
  startedAt: string;
  finishedAt: string | null;
}

const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_STORED_JOBS = 100;
const MAX_JOB_ERRORS = 20;

const globalForSorotanJobs = globalThis as unknown as {
  __lensaplusSorotanJobs?: Map<string, SorotanJobStatus>;
};

function getJobStore(): Map<string, SorotanJobStatus> {
  if (!globalForSorotanJobs.__lensaplusSorotanJobs) {
    globalForSorotanJobs.__lensaplusSorotanJobs = new Map();
  }
  return globalForSorotanJobs.__lensaplusSorotanJobs;
}

function pruneJobs(store: Map<string, SorotanJobStatus>): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of store.entries()) {
    if (
      job.status === "done" &&
      job.finishedAt &&
      new Date(job.finishedAt).getTime() < cutoff
    ) {
      store.delete(id);
    }
  }
  while (store.size > MAX_STORED_JOBS) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

/**
 * Start a background Sorotan generation job for one or more articles.
 * Returns the initial job snapshot immediately so HTTP requests never hit
 * upstream proxy timeouts (Nginx 60s 504 / Cloudflare 100s 524).
 */
export function startSorotanJob(
  articleIds: string[],
  opts?: GenerateSorotanOptions,
): SorotanJobStatus {
  const store = getJobStore();
  pruneJobs(store);

  const uniqueIds = Array.from(new Set(articleIds.filter(Boolean)));
  const jobId = randomUUID();
  const nowIso = new Date().toISOString();

  const job: SorotanJobStatus = {
    jobId,
    status: uniqueIds.length === 0 ? "done" : "running",
    totalArticles: uniqueIds.length,
    completedArticles: 0,
    currentArticleId: uniqueIds[0] ?? null,
    articleIds: uniqueIds,
    totalCreated: 0,
    totalSkipped: 0,
    totalErrors: 0,
    errors: [],
    results: [],
    startedAt: nowIso,
    finishedAt: uniqueIds.length === 0 ? nowIso : null,
  };

  store.set(jobId, job);

  if (uniqueIds.length > 0) {
    void (async () => {
      try {
        for (const id of uniqueIds) {
          job.currentArticleId = id;
          try {
            const r = await generateSorotan(id, opts);
            job.results.push(r);
            job.totalCreated += r.created;
            job.totalSkipped += r.skipped;
            job.totalErrors += r.errors.length;
            for (const errMsg of r.errors) {
              if (job.errors.length < MAX_JOB_ERRORS) {
                job.errors.push(errMsg);
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            job.totalErrors += 1;
            if (job.errors.length < MAX_JOB_ERRORS) {
              job.errors.push(msg);
            }
            job.results.push({
              articleId: id,
              created: 0,
              skipped: 0,
              errors: [msg],
              sorotanIds: [],
            });
          } finally {
            job.completedArticles += 1;
          }
        }
      } finally {
        job.currentArticleId = null;
        job.status = "done";
        job.finishedAt = new Date().toISOString();
      }
    })();
  }

  return job;
}

export function getSorotanJob(jobId: string): SorotanJobStatus | null {
  if (!jobId) return null;
  const store = getJobStore();
  pruneJobs(store);
  return store.get(jobId) ?? null;
}
