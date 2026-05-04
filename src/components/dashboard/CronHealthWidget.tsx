"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
} from "lucide-react";

interface CronJob {
  name: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  healthy: boolean;
}

const JOB_LABELS: Record<string, string> = {
  publish: "Publish Terjadwal",
  "auto-article": "Auto Artikel AI",
  sorotan: "Generate Sorotan",
  "seo-submit": "SEO Indexing Ping",
  backup: "Backup DB",
  "scrape-sources": "Scrape Sumber",
};

const EXPECTED_INTERVAL_MIN: Record<string, number> = {
  publish: 5,
  "auto-article": 60,
  sorotan: 60,
  "seo-submit": 720,
  backup: 1440,
  "scrape-sources": 240,
};

function relativeTime(iso: string | null): string {
  if (!iso) return "belum pernah";
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

function isStale(job: CronJob): boolean {
  if (!job.lastRunAt) return true;
  const expectedMs = (EXPECTED_INTERVAL_MIN[job.name] || 60) * 60_000;
  // Tolerate 2x expected interval before flagging stale.
  return Date.now() - new Date(job.lastRunAt).getTime() > expectedMs * 2;
}

export default function CronHealthWidget() {
  const [jobs, setJobs] = useState<CronJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/panel/cron-health");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setJobs(json.data?.jobs || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return null;
  if (!jobs) {
    return (
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden animate-pulse">
        <div className="border-b border-border px-5 py-3.5">
          <div className="h-5 w-32 rounded bg-surface-tertiary" />
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-secondary" />
          ))}
        </div>
      </div>
    );
  }

  const totalErrored = jobs.filter((j) => !!j.lastError).length;
  const totalStale = jobs.filter(isStale).length;
  const allHealthy = totalErrored === 0 && totalStale === 0;

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              allHealthy ? "bg-emerald-50 text-emerald-600" : "bg-yellow-50 text-yellow-600"
            }`}
          >
            <Activity size={14} />
          </div>
          Kesehatan Cron
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            allHealthy
              ? "bg-emerald-50 text-emerald-700"
              : totalErrored > 0
              ? "bg-red-50 text-red-700"
              : "bg-yellow-50 text-yellow-700"
          }`}
        >
          {allHealthy
            ? "Sehat"
            : totalErrored > 0
            ? `${totalErrored} error`
            : `${totalStale} terlambat`}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {jobs.map((job, idx) => {
          const stale = isStale(job);
          const errored = !!job.lastError;
          const Icon = errored ? XCircle : stale ? AlertTriangle : CheckCircle;
          const color = errored
            ? "text-red-500"
            : stale
            ? "text-yellow-500"
            : "text-emerald-500";
          return (
            <div
              key={job.name}
              className={`p-4 ${idx % 2 === 0 ? "" : ""} ${
                idx >= 2 ? "sm:border-t sm:border-border" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-txt-primary truncate">
                  {JOB_LABELS[job.name] || job.name}
                </span>
                <Icon size={14} className={`${color} shrink-0 mt-0.5`} />
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-txt-muted">
                <Clock size={10} />
                <span>{relativeTime(job.lastSuccessAt || job.lastRunAt)}</span>
                {job.lastDurationMs !== null && (
                  <span className="text-txt-muted/60">
                    · {(job.lastDurationMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {errored && (
                <p className="mt-1.5 text-[10px] text-red-600 line-clamp-2 font-mono">
                  {job.lastError}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-t border-border px-5 py-2.5 bg-surface-secondary/30">
        <Link
          href="/panel/aktivitas"
          className="text-[11px] font-semibold text-primary hover:text-primary-dark"
        >
          Lihat audit log lengkap &rarr;
        </Link>
      </div>
    </div>
  );
}
