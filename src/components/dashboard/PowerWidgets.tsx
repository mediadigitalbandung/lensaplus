"use client";

/**
 * PowerWidgets — extra dashboard panels driven by /api/panel/dashboard-extras.
 *
 * Bundled into one file because all five widgets share the same fetch + auto-
 * refresh hook. Splitting them later is fine but right now they always render
 * together.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

interface ExtrasResponse {
  pipeline: {
    draft: number;
    inReview: number;
    approved: number;
    published: number;
    bottleneck: "review" | "publish" | null;
  };
  pendingItems: {
    sorotanFailed: number;
    aiFlaggedArticles: number;
    oldPendingReports: number;
    oldPendingComments: number;
    totalPending: number;
  };
  aiBreakdown: {
    feature: string;
    runs: number;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
  }[];
  topAuthors: {
    week: { id: string; name: string; avatar: string | null; role: string; count: number }[];
    month: { id: string; name: string; avatar: string | null; role: string; count: number }[];
  };
  backup: {
    status: "healthy" | "stale" | "failed" | "unknown";
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    lastDurationMs: number | null;
  };
  install: {
    pwaInstall: number;
    pwaLaunch: number;
    apkDownload: number;
    total: number;
    lastPwaInstallAt: string | null;
    lastPwaLaunchAt: string | null;
    lastApkDownloadAt: string | null;
  };
}

const REFRESH_INTERVAL_MS = 60_000;

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

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("id-ID");
}

const FEATURE_LABEL: Record<string, string> = {
  article_draft: "Auto Artikel",
  faq: "Generate FAQ",
  sorotan: "Sorotan",
  seo: "SEO Title/Desc",
  bulk_seo: "Bulk SEO",
  bulk_tags: "Bulk Tags",
  caption: "Caption Sosmed",
};

export default function PowerWidgets({ isAdmin }: { isAdmin: boolean }) {
  const [data, setData] = useState<ExtrasResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/panel/dashboard-extras", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error) return null;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PendingItemsWidget data={data.pendingItems} />
      <PipelineWidget data={data.pipeline} />
      <AIBreakdownWidget data={data.aiBreakdown} />
      <TopAuthorsWidget data={data.topAuthors} />
      <InstallStatsWidget data={data.install} />
      {isAdmin && <BackupWidget data={data.backup} />}
    </div>
  );
}

/* ─── Install Attribution ───────────────────────────────────────────────── */
function InstallStatsWidget({ data }: { data: ExtrasResponse["install"] }) {
  const channels = [
    {
      label: "PWA Install",
      hint: "Pasang via Chrome / Edge",
      count: data.pwaInstall,
      lastAt: data.lastPwaInstallAt,
      barColor: "bg-emerald-600",
    },
    {
      label: "PWA Launch",
      hint: "Buka dari home screen",
      count: data.pwaLaunch,
      lastAt: data.lastPwaLaunchAt,
      barColor: "bg-blue-600",
    },
    {
      label: "APK Download",
      hint: "Klik unduh APK manual",
      count: data.apkDownload,
      lastAt: data.lastApkDownloadAt,
      barColor: "bg-amber-600",
    },
  ];
  const max = Math.max(...channels.map((c) => c.count), 1);

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
          Atribusi Pasang Aplikasi
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">
          Total: {(data.pwaInstall + data.apkDownload).toLocaleString("id-ID")}
        </span>
      </div>
      <div className="p-5 space-y-3">
        {channels.map((c) => {
          const pct = (c.count / max) * 100;
          return (
            <div key={c.label}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-txt-primary">{c.label}</p>
                  <p className="text-[10px] text-txt-muted">
                    {c.hint}
                    {c.lastAt ? ` · Terakhir ${relativeTime(c.lastAt)}` : ""}
                  </p>
                </div>
                <span className="text-base font-bold text-txt-primary tabular-nums">
                  {c.count.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${c.barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {data.pwaInstall + data.apkDownload === 0 && (
          <p className="text-xs text-txt-muted text-center pt-2">
            Belum ada install tercatat. Promote{" "}
            <Link href="/unduh" className="text-primary underline">/unduh</Link>{" "}
            di sosial media untuk mulai dapat install.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Pending Items ─────────────────────────────────────────────────────── */
function PendingItemsWidget({ data }: { data: ExtrasResponse["pendingItems"] }) {
  const items = [
    {
      label: "Sorotan gagal indexing",
      count: data.sorotanFailed,
      href: "/panel/sorotan?indexStatus=failed",
      color: "text-amber-700",
    },
    {
      label: "Artikel di-flag AI guardrail",
      count: data.aiFlaggedArticles,
      href: "/panel/artikel?flag=ai",
      color: "text-red-700",
    },
    {
      label: "Laporan pending > 48 jam",
      count: data.oldPendingReports,
      href: "/panel/laporan",
      color: "text-orange-700",
    },
    {
      label: "Komentar pending > 24 jam",
      count: data.oldPendingComments,
      href: "/panel/komentar?filter=pending",
      color: "text-amber-700",
    },
  ];
  const allClear = data.totalPending === 0;
  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
          Butuh Tindakan
        </h2>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${allClear ? "text-emerald-700" : "text-red-700"}`}>
          {allClear ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {allClear ? "Semua aman" : `${data.totalPending} item`}
        </span>
      </div>
      <div className="divide-y divide-border">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className={`flex items-center justify-between px-5 py-3 transition-colors ${
              it.count > 0 ? "hover:bg-surface-secondary/40" : "opacity-60"
            }`}
          >
            <span className="text-sm font-medium text-txt-primary truncate pr-3">
              {it.label}
            </span>
            <span className={`shrink-0 tabular-nums text-sm font-bold ${it.count > 0 ? it.color : "text-txt-muted"}`}>
              {it.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Pipeline funnel ───────────────────────────────────────────────────── */
function PipelineWidget({ data }: { data: ExtrasResponse["pipeline"] }) {
  const stages = [
    { label: "Draf", count: data.draft, status: "DRAFT", barColor: "bg-stone-400" },
    { label: "Review", count: data.inReview, status: "IN_REVIEW", barColor: "bg-amber-500" },
    { label: "Disetujui", count: data.approved, status: "APPROVED", barColor: "bg-blue-600" },
    { label: "Published", count: data.published, status: "PUBLISHED", barColor: "bg-emerald-600" },
  ];
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
          Pipeline Editorial
        </h2>
        {data.bottleneck && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Bottleneck di {data.bottleneck === "review" ? "review" : "publish"}
          </span>
        )}
      </div>
      <div className="p-5 space-y-3">
        {stages.map((s) => {
          const pct = (s.count / max) * 100;
          return (
            <Link
              key={s.label}
              href={`/panel/artikel?status=${s.status}`}
              className="block group"
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="flex-1 text-sm font-semibold text-txt-primary group-hover:text-primary transition-colors">
                  {s.label}
                </span>
                <span className="text-base font-bold text-txt-primary tabular-nums">
                  {s.count.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${s.barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── AI Usage breakdown ────────────────────────────────────────────────── */
function AIBreakdownWidget({ data }: { data: ExtrasResponse["aiBreakdown"] }) {
  const total = data.reduce((s, f) => s + f.totalTokens, 0);
  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
          Konsumsi AI per Fitur
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">
          30 hari · {fmtTokens(total)} tokens
        </span>
      </div>
      <div className="p-5">
        {data.length === 0 ? (
          <p className="text-sm text-txt-muted py-4 text-center">Belum ada penggunaan AI 30 hari terakhir.</p>
        ) : (
          <div className="space-y-3">
            {data.map((f) => {
              const pct = total > 0 ? (f.totalTokens / total) * 100 : 0;
              return (
                <div key={f.feature}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-txt-primary">
                      {FEATURE_LABEL[f.feature] || f.feature}
                    </span>
                    <span className="text-xs text-txt-muted tabular-nums">
                      {fmtTokens(f.totalTokens)} · {f.runs} run
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Top authors leaderboard ───────────────────────────────────────────── */
function TopAuthorsWidget({ data }: { data: ExtrasResponse["topAuthors"] }) {
  const [tab, setTab] = useState<"week" | "month">("week");
  const list = data[tab];
  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
          Top Penulis
        </h2>
        <div className="flex items-center gap-3">
          {(["week", "month"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`border-b-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-txt-secondary hover:text-primary"
              }`}
            >
              {t === "week" ? "Minggu" : "Bulan"}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {list.length === 0 ? (
          <p className="text-sm text-txt-muted py-8 text-center">Belum ada artikel published di periode ini.</p>
        ) : (
          list.map((u, i) => (
            <Link
              key={u.id}
              href={`/penulis/${u.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-surface-secondary/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-5 shrink-0 font-mono text-xs font-bold tabular-nums ${i < 3 ? "text-primary" : "text-txt-muted"}`}>
                  {String(i + 1).padStart(2, "0")}.
                </span>
                {u.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="h-8 w-8 rounded-full object-cover bg-surface-secondary"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full border border-border bg-surface-container-low text-primary flex items-center justify-center text-xs font-bold">
                    {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-txt-primary truncate">{u.name}</span>
              </div>
              <span className="shrink-0 text-sm font-bold text-txt-primary tabular-nums">
                {u.count} <span className="text-xs text-txt-muted font-normal">artikel</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Backup status ─────────────────────────────────────────────────────── */
function BackupWidget({ data }: { data: ExtrasResponse["backup"] }) {
  const statusMeta: Record<typeof data.status, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
    healthy: { label: "Sehat", color: "text-emerald-700", Icon: CheckCircle2 },
    stale: { label: "Stale", color: "text-amber-700", Icon: Clock },
    failed: { label: "Gagal", color: "text-red-700", Icon: XCircle },
    unknown: { label: "Belum dikenali", color: "text-txt-muted", Icon: AlertCircle },
  };
  const meta = statusMeta[data.status];
  const Icon = meta.Icon;
  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
          Backup Database
        </h2>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>
          <Icon size={12} /> {meta.label}
        </span>
      </div>
      <div className="p-5 space-y-2.5">
        <Row label="Backup terakhir" value={relativeTime(data.lastSuccessAt)} mono />
        <Row label="Run terakhir" value={relativeTime(data.lastRunAt)} mono />
        {data.lastDurationMs !== null && (
          <Row label="Durasi" value={`${(data.lastDurationMs / 1000).toFixed(1)}s`} mono />
        )}
        {data.lastError && (
          <div className="mt-2 border-l-4 border-red-600 pl-3 py-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Error</p>
            <p className="mt-0.5 text-xs font-mono text-red-700 line-clamp-3 break-all">
              {data.lastError}
            </p>
          </div>
        )}
        {data.status === "stale" && (
          <p className="text-xs text-yellow-700 mt-2">
            Backup terakhir &gt; 36 jam yang lalu — cek crontab + permission.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-txt-secondary">{label}</span>
      <span className={`font-medium text-txt-primary ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
