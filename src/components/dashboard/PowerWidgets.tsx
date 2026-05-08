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
  Archive,
  Award,
  Bot,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Flag,
  GitBranch,
  Highlighter,
  MessageSquare,
  Trophy,
  Users,
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
    let timer: ReturnType<typeof setInterval> | undefined;
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
    timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
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
      {isAdmin && <BackupWidget data={data.backup} />}
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
      icon: Highlighter,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Artikel di-flag AI guardrail",
      count: data.aiFlaggedArticles,
      href: "/panel/artikel?flag=ai",
      icon: Flag,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Laporan pending > 48 jam",
      count: data.oldPendingReports,
      href: "/panel/laporan",
      icon: AlertCircle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Komentar pending > 24 jam",
      count: data.oldPendingComments,
      href: "/panel/komentar?filter=pending",
      icon: MessageSquare,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
  ];
  const allClear = data.totalPending === 0;
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${allClear ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
            {allClear ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          </div>
          Butuh Tindakan
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${allClear ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {allClear ? "Semua aman" : `${data.totalPending} item`}
        </span>
      </div>
      <div className="divide-y divide-border">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <Link
              key={it.label}
              href={it.href}
              className={`flex items-center justify-between px-5 py-3 transition-colors ${
                it.count > 0 ? "hover:bg-surface-secondary/40" : "opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${it.bg} ${it.color} shrink-0`}>
                  <Icon size={14} />
                </div>
                <span className="text-sm font-medium text-txt-primary truncate">
                  {it.label}
                </span>
              </div>
              <span className={`shrink-0 tabular-nums text-sm font-bold ${it.count > 0 ? it.color : "text-txt-muted"}`}>
                {it.count}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Pipeline funnel ───────────────────────────────────────────────────── */
function PipelineWidget({ data }: { data: ExtrasResponse["pipeline"] }) {
  const stages = [
    { label: "Draf", count: data.draft, status: "DRAFT", icon: FileText, color: "text-gray-600", bg: "bg-gray-100" },
    { label: "Review", count: data.inReview, status: "IN_REVIEW", icon: Clock, color: "text-yellow-700", bg: "bg-yellow-100" },
    { label: "Disetujui", count: data.approved, status: "APPROVED", icon: CheckCircle2, color: "text-blue-700", bg: "bg-blue-100" },
    { label: "Published", count: data.published, status: "PUBLISHED", icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-100" },
  ];
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <GitBranch size={14} />
          </div>
          Pipeline Editorial
        </h2>
        {data.bottleneck && (
          <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-yellow-50 text-yellow-700">
            ⚠ Bottleneck di {data.bottleneck === "review" ? "review" : "publish"}
          </span>
        )}
      </div>
      <div className="p-5 space-y-3">
        {stages.map((s) => {
          const Icon = s.icon;
          const pct = (s.count / max) * 100;
          return (
            <Link
              key={s.label}
              href={`/panel/artikel?status=${s.status}`}
              className="block group"
            >
              <div className="flex items-center gap-3 mb-1">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.bg} ${s.color} shrink-0`}>
                  <Icon size={14} />
                </div>
                <span className="flex-1 text-sm font-semibold text-txt-primary group-hover:text-primary transition-colors">
                  {s.label}
                </span>
                <span className="text-base font-bold text-txt-primary tabular-nums">
                  {s.count.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="ml-11 h-2 rounded-full bg-surface-tertiary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${s.bg.replace("bg-", "bg-").replace("-100", "-500")}`}
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
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Bot size={14} />
          </div>
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
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Trophy size={14} />
          </div>
          Top Penulis
        </h2>
        <div className="flex items-center gap-1 rounded-full bg-surface-secondary p-0.5">
          {(["week", "month"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                tab === t ? "bg-primary text-white" : "text-txt-secondary"
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
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? "bg-primary text-white" : "bg-surface-tertiary text-txt-secondary"}`}>
                  {i + 1}
                </span>
                {u.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="h-8 w-8 rounded-full object-cover bg-surface-secondary"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-light text-primary flex items-center justify-center text-xs font-bold">
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
  const statusMeta: Record<typeof data.status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    healthy: { label: "Sehat", cls: "bg-emerald-50 text-emerald-700", Icon: CheckCircle2 },
    stale: { label: "Stale", cls: "bg-yellow-50 text-yellow-700", Icon: Clock },
    failed: { label: "Gagal", cls: "bg-red-50 text-red-700", Icon: XCircle },
    unknown: { label: "Belum dikenali", cls: "bg-gray-50 text-gray-700", Icon: AlertCircle },
  };
  const meta = statusMeta[data.status];
  const Icon = meta.Icon;
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-txt-primary">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.cls}`}>
            <Database size={14} />
          </div>
          Backup Database
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.cls}`}>
          <Icon size={10} className="inline -mt-0.5 mr-0.5" /> {meta.label}
        </span>
      </div>
      <div className="p-5 space-y-2.5">
        <Row label="Backup terakhir" value={relativeTime(data.lastSuccessAt)} mono />
        <Row label="Run terakhir" value={relativeTime(data.lastRunAt)} mono />
        {data.lastDurationMs !== null && (
          <Row label="Durasi" value={`${(data.lastDurationMs / 1000).toFixed(1)}s`} mono />
        )}
        {data.lastError && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
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
