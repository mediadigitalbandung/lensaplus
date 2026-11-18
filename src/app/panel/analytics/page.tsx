"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";

const MANAGEMENT_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR"];

interface AnalyticsData {
  overview: {
    totalViews: number;
    totalArticles: number;
    publishedArticles: number;
    totalComments: number;
    totalUsers: number;
    articlesToday: number;
    articlesWeek: number;
    articlesMonth: number;
  };
  topArticles: { title: string; slug: string; views: number; category: string; publishedAt: string }[];
  categoryStats: { name: string; slug: string; articles: number; views: number }[];
  recentActivity: { title: string; slug: string; views: number; author: string; category: string; publishedAt: string }[];
  dailyChart: { date: string; count: number }[];
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border border-t-2 border-t-primary bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-txt-muted">{label}</p>
        {sub && <span className="text-xs font-semibold text-emerald-700">{sub}</span>}
      </div>
      <p className="text-2xl font-bold text-txt-primary tabular-nums">{typeof value === "number" ? value.toLocaleString("id-ID") : value}</p>
    </div>
  );
}

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[9px] font-bold text-txt-primary">{d.count || ""}</span>
          <div
            className="w-full rounded-t-md bg-primary/80 hover:bg-primary transition-colors min-h-[2px]"
            style={{ height: `${(d.count / max) * 100}%` }}
            title={`${d.date}: ${d.count} artikel`}
          />
          <span className="text-[8px] text-txt-muted whitespace-pre-line leading-tight w-full text-center">{d.date.replace(" ", "\n")}</span>
        </div>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}h lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export default function AnalyticsDashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const userRole = (session?.user?.role as string) || "";
  const isAuthorized = MANAGEMENT_ROLES.includes(userRole);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== "loading" && !isAuthorized) {
      router.replace("/panel/dashboard");
    }
  }, [sessionStatus, isAuthorized, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/panel/analytics");
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Gagal memuat data analytics (HTTP ${res.status})`);
      }
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated" && isAuthorized) {
      fetchData();
    }
  }, [sessionStatus, isAuthorized, fetchData]);

  if (sessionStatus === "loading" || !isAuthorized || loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-lg bg-surface-tertiary" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-lg bg-surface-tertiary" />)}
        </div>
        <div className="h-60 rounded-lg bg-surface-tertiary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-300 border-l-4 border-l-red-600 bg-surface p-5 text-sm text-red-700 flex items-center justify-between gap-3">
        <span>{error || "Gagal memuat data analytics."}</span>
        <button type="button" onClick={fetchData} className="btn-ghost text-xs font-semibold text-primary">
          Coba Lagi
        </button>
      </div>
    );
  }

  const { overview, topArticles, categoryStats, recentActivity, dailyChart } = data;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">Analytics</h1>
          <p className="text-base text-txt-secondary">Performa website Lensaplus</p>
        </div>
        <button onClick={fetchData} className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tayangan" value={overview.totalViews} />
        <StatCard label="Artikel Dipublikasi" value={overview.publishedArticles} />
        <StatCard label="Total Komentar" value={overview.totalComments} />
        <StatCard label="Tim Aktif" value={overview.totalUsers} />
      </div>

      {/* Article Production Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card text-center">
          <p className="text-3xl font-bold text-primary">{overview.articlesToday}</p>
          <p className="text-xs text-txt-muted mt-1">Hari Ini</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card text-center">
          <p className="text-3xl font-bold text-primary">{overview.articlesWeek}</p>
          <p className="text-xs text-txt-muted mt-1">Minggu Ini</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card text-center">
          <p className="text-3xl font-bold text-primary">{overview.articlesMonth}</p>
          <p className="text-xs text-txt-muted mt-1">Bulan Ini</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Daily Chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-sm font-bold text-txt-primary mb-4 border-l-[3px] border-primary pl-2.5">
            Artikel Dipublikasi (14 Hari Terakhir)
          </h3>
          <BarChart data={dailyChart} />
        </div>

        {/* Category Stats */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-sm font-bold text-txt-primary mb-4 border-l-[3px] border-primary pl-2.5">
            Performa Kategori
          </h3>
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {categoryStats.map((c, i) => {
              const maxViews = categoryStats[0]?.views || 1;
              return (
                <div key={c.slug}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-txt-primary font-medium">{c.name}</span>
                    <span className="text-txt-muted">{c.views.toLocaleString("id-ID")} views · {c.articles} artikel</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-tertiary overflow-hidden">
                    <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${(c.views / maxViews) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Articles */}
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">Top 10 Artikel</h3>
          </div>
          <div className="divide-y divide-border">
            {topArticles.map((a, i) => (
              <div key={a.slug} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-secondary">
                <span className={`w-6 shrink-0 font-mono text-xs font-bold tabular-nums ${
                  i < 3 ? "text-primary" : "text-txt-muted"
                }`}>{String(i + 1).padStart(2, "0")}.</span>
                <div className="flex-1 min-w-0">
                  <Link href={`/berita/${a.slug}`} className="text-sm font-medium text-txt-primary hover:text-primary truncate block">{a.title}</Link>
                  <span className="text-[10px] text-txt-muted">{a.category}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-txt-primary">{a.views.toLocaleString("id-ID")}</span>
                  <span className="block text-[10px] text-txt-muted">views</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">Artikel Terbaru</h3>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.map((a) => (
              <div key={a.slug} className="px-5 py-3 hover:bg-surface-secondary">
                <Link href={`/berita/${a.slug}`} className="text-sm font-medium text-txt-primary hover:text-primary line-clamp-1">{a.title}</Link>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-txt-muted">
                  <span>{a.author}</span>
                  <span>·</span>
                  <span>{a.category}</span>
                  <span>·</span>
                  <span>{a.views.toLocaleString("id-ID")} views</span>
                  <span>·</span>
                  <span>{timeAgo(a.publishedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
