"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Eye, FileText, Users, MessageCircle, TrendingUp, Calendar, BarChart3, RefreshCw, ArrowUp, Trophy, Clock } from "lucide-react";

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

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon size={18} />
        </div>
        {sub && <span className="text-xs font-medium text-green-500 flex items-center gap-0.5"><ArrowUp size={10} /> {sub}</span>}
      </div>
      <p className="text-2xl font-bold text-txt-primary">{typeof value === "number" ? value.toLocaleString("id-ID") : value}</p>
      <p className="text-xs text-txt-muted mt-1">{label}</p>
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
          <span className="text-[8px] text-txt-muted truncate w-full text-center">{d.date.replace(" ", "\n")}</span>
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
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/panel/analytics");
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
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

  if (!data) return <p className="text-txt-muted">Gagal memuat data analytics.</p>;

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
        <StatCard label="Total Tayangan" value={overview.totalViews} icon={Eye} color="bg-blue-50 text-blue-600" />
        <StatCard label="Artikel Dipublikasi" value={overview.publishedArticles} icon={FileText} color="bg-green-50 text-green-600" />
        <StatCard label="Total Komentar" value={overview.totalComments} icon={MessageCircle} color="bg-purple-50 text-purple-600" />
        <StatCard label="Tim Aktif" value={overview.totalUsers} icon={Users} color="bg-orange-50 text-orange-600" />
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
          <h3 className="text-sm font-bold text-txt-primary mb-4 flex items-center gap-1.5">
            <Calendar size={14} className="text-primary" /> Artikel Dipublikasi (14 Hari Terakhir)
          </h3>
          <BarChart data={dailyChart} />
        </div>

        {/* Category Stats */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-sm font-bold text-txt-primary mb-4 flex items-center gap-1.5">
            <BarChart3 size={14} className="text-primary" /> Performa Kategori
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
            <h3 className="text-sm font-bold text-txt-primary flex items-center gap-1.5"><Trophy size={14} className="text-yellow-500" /> Top 10 Artikel</h3>
          </div>
          <div className="divide-y divide-border">
            {topArticles.map((a, i) => (
              <div key={a.slug} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-secondary">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  i < 3 ? "bg-yellow-50 text-yellow-600" : "bg-surface-tertiary text-txt-muted"
                }`}>{i + 1}</span>
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
            <h3 className="text-sm font-bold text-txt-primary flex items-center gap-1.5"><Clock size={14} className="text-primary" /> Artikel Terbaru</h3>
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
                  <span className="flex items-center gap-0.5"><Eye size={8} /> {a.views.toLocaleString("id-ID")}</span>
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
