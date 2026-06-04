"use client";

/**
 * Statistik Dashboard — EDITOR+
 * 4 tabs: Internal | Google Analytics | Google Search Console | Cloudflare
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  TrendingUp,
  Eye,
  Users,
  FileText,
  Search as SearchIcon,
  Cloud,
  BarChart3,
  RefreshCw,
  Loader2,
  AlertCircle,
  ExternalLink,
  Activity,
  Shield,
  Bot,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { EDITOR_ROLES } from "@/lib/roles";
import EditorTab from "./EditorTab";

// --- Types (mirror src/lib/stats/internal.ts InternalStats) ---
interface InternalStats {
  articles: {
    total: number;
    published: number;
    draft: number;
    inReview: number;
    rejected: number;
    archived: number;
    publishedInRange: number;
  };
  users: { total: number; byRole: Record<string, number>; newInRange: number };
  views: {
    total: number;
    inRange: number;
    top10: Array<{ slug: string; title: string; viewCount: number }>;
    top10InRange: Array<{ slug: string; title: string; viewCount: number; publishedAt: string | null }>;
  };
  trend: Array<{
    date: string;
    publishedCount: number;
    viewCount: number;
  }>;
  comments: { total: number; pending: number; approved: number; inRange: number };
  polls: { total: number; active: number; totalVotes: number; votesInRange: number };
  ai: {
    rangeTokens: number;
    rangeCalls: number;
    topFeatures: Array<{ feature: string; calls: number; tokens: number }>;
  };
  sorotan: {
    total: number;
    indexed: number;
    pending: number;
    submitted: number;
    failed: number;
    createdInRange: number;
  };
  social: { total: number; published: number; draft: number; publishedInRange: number };
  glossary: {
    total: number;
    viewsTotal: number;
    top5: Array<{ slug: string; istilah: string; viewCount: number }>;
  };
  ads: {
    activeCount: number;
    totalImpressions: number;
    totalClicks: number;
    ctr: number;
    top5: Array<{ id: string; name: string; impressions: number; clicks: number; ctr: number }>;
  };
  scraping: {
    sources: number;
    activeSources: number;
    articlesScrapedInRange: number;
    lastSuccessAt: string | null;
  };
  newsletter: {
    subscribers: number;
    confirmed: number;
    newInRange: number;
  };
  audit: {
    totalInRange: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; userName: string | null; count: number }>;
  };
  _meta: { from: string; to: string; cacheHit: boolean; generatedAt: string };
}

interface GA4Stats {
  pageviews: number;
  users: number;
  sessions: number;
  avgSessionDurationSec: number;
  topPages: Array<{ path: string; pageviews: number; users: number }>;
  dailyTrend: Array<{ date: string; pageviews: number; users: number }>;
  _error?: string;
}

interface GSCStats {
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  topQueries: Array<{
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>;
  dailyTrend: Array<{ date: string; impressions: number; clicks: number }>;
  _error?: string;
}

interface CFStats {
  requests: number;
  bandwidth: number;
  cachedRequests: number;
  cacheHitRate: number;
  threats: number;
  dailyTrend: Array<{
    date: string;
    requests: number;
    bandwidth: number;
    cachedRequests: number;
  }>;
  _error?: string;
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatNumber(n: number) {
  return n.toLocaleString("id-ID");
}

function formatBytes(n: number) {
  if (n === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    sizes.length - 1,
    Math.floor(Math.log(Math.abs(n)) / Math.log(k)),
  );
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// --- Stat Card ---
function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-primary bg-primary-light",
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
      <div className={`inline-flex rounded-lg p-2 ${color}`}>
        <Icon size={16} />
      </div>
      <p className="mt-2 text-2xl font-extrabold text-txt-primary">{value}</p>
      <p className="text-xs text-txt-secondary">{label}</p>
    </div>
  );
}

function NotConfiguredBanner({
  message,
  settingKey,
}: {
  message: string;
  settingKey?: string;
}) {
  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 text-yellow-600 shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-bold text-yellow-800">
            Belum terkonfigurasi
          </h3>
          <p className="mt-1 text-xs text-yellow-700">{message}</p>
          {settingKey && (
            <p className="mt-2 text-xs text-yellow-700">
              Set SystemSetting{" "}
              <code className="font-mono bg-yellow-100 px-1 py-0.5 rounded-lg">
                {settingKey}
              </code>{" "}
              di{" "}
              <Link
                href="/panel/pengaturan"
                className="underline font-semibold"
              >
                Pengaturan
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Scoped (per-author) Internal view — for non-SUPER_ADMIN ---
function ScopedInternalView({
  data,
  from,
  to,
}: {
  data: InternalStats;
  from: string;
  to: string;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-primary-light/40 border border-primary/20 px-4 py-3 text-xs text-primary/90 flex flex-wrap items-center gap-2">
        <Activity size={12} />
        <span className="font-semibold">Statistik Anda</span>
        <span className="font-mono">{from}</span>
        <span>→</span>
        <span className="font-mono">{to}</span>
        <span className="ml-auto text-primary/60">
          Hanya menampilkan performa artikel milik Anda.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Artikel Terbit (Periode)" value={formatNumber(data.articles.publishedInRange)} icon={FileText} color="text-blue-500 bg-blue-50" />
        <StatCard label="Views (Periode)" value={formatNumber(data.views.inRange)} icon={Eye} color="text-primary bg-primary-light" />
        <StatCard label="Komentar (Periode)" value={formatNumber(data.comments.inRange)} icon={Activity} color="text-yellow-500 bg-yellow-50" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Artikel Saya" value={formatNumber(data.articles.total)} icon={FileText} color="text-blue-500 bg-blue-50" />
        <StatCard label="Terbit" value={formatNumber(data.articles.published)} icon={FileText} color="text-green-600 bg-green-50" />
        <StatCard label="Draf" value={formatNumber(data.articles.draft)} icon={FileText} color="text-txt-secondary bg-surface-tertiary" />
        <StatCard label="Total Views Saya" value={formatNumber(data.views.total)} icon={Eye} color="text-primary bg-primary-light" />
      </div>

      {/* Personal AI usage — how much AI the viewer has used in this range. */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-bold text-txt-primary mb-1">Pemakaian AI Anda (Periode)</h3>
        <p className="text-xs text-txt-muted mb-4">Token &amp; permintaan AI yang Anda gunakan di rentang dipilih.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Token AI (Periode)" value={formatNumber(data.ai.rangeTokens)} icon={Bot} color="text-indigo-500 bg-indigo-50" />
          <StatCard label="Permintaan AI (Periode)" value={formatNumber(data.ai.rangeCalls)} icon={Activity} color="text-violet-500 bg-violet-50" />
        </div>
        {data.ai.topFeatures.length > 0 ? (
          <div className="mt-4 space-y-1.5">
            <p className="text-xs font-semibold text-txt-secondary">Fitur AI terbanyak</p>
            {data.ai.topFeatures.map((f) => (
              <div key={f.feature} className="flex justify-between text-sm">
                <span className="text-txt-secondary">{f.feature}</span>
                <span className="font-medium text-txt-primary">
                  {formatNumber(f.tokens)} token · {formatNumber(f.calls)}×
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-txt-muted">Belum ada aktivitas AI di rentang ini.</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-bold text-txt-primary mb-1">Trend Publikasi &amp; Views (Artikel Anda)</h3>
        <p className="text-xs text-txt-muted mb-4">Artikel Anda yang terbit + view kumulatif per hari di rentang dipilih.</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eaeb" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis yAxisId="left" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="publishedCount" stroke="#002045" strokeWidth={2} name="Terbit" />
              <Line yAxisId="right" type="monotone" dataKey="viewCount" stroke="#b7102a" strokeWidth={2} name="Views" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="border-b border-border bg-surface-secondary px-5 py-4">
          <h3 className="text-base font-bold text-txt-primary">Artikel Terpopuler Saya</h3>
          <p className="text-xs text-txt-muted mt-0.5">10 artikel Anda paling banyak dibaca (seluruh waktu)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-secondary">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-txt-secondary">#</th>
                <th className="px-5 py-3 text-left font-medium text-txt-secondary">Judul</th>
                <th className="px-5 py-3 text-right font-medium text-txt-secondary">Views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.views.top10.map((a, i) => (
                <tr key={a.slug} className="hover:bg-surface-secondary/50">
                  <td className="px-5 py-3 text-txt-muted">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-txt-primary max-w-[400px] truncate">
                    <Link href={`/berita/${a.slug}`} target="_blank" className="hover:text-primary">{a.title}</Link>
                  </td>
                  <td className="px-5 py-3 text-right font-bold">{formatNumber(a.viewCount)}</td>
                </tr>
              ))}
              {data.views.top10.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-txt-muted">Belum ada artikel terbit.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- Internal Tab ---
function InternalTab({ from, to, scope }: { from: string; to: string; scope: "all" | "me" }) {
  const [data, setData] = useState<InternalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/stats/internal?from=${from}&to=${to}&scope=${scope}`,
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [from, to, scope]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 size={24} className="mx-auto animate-spin text-primary" />
      </div>
    );
  }
  if (!data) {
    return (
      <p className="text-sm text-txt-muted py-8 text-center">
        Gagal memuat data.
      </p>
    );
  }

  // Personal scope: render only the per-author subset (no site-wide numbers).
  if (scope === "me") {
    return <ScopedInternalView data={data} from={from} to={to} />;
  }

  const roleEntries = Object.entries(data.users.byRole).map(
    ([role, count]) => ({
      role: role.replace(/_/g, " "),
      count,
    }),
  );

  return (
    <div className="space-y-6">
      {/* ── Range header — semua kartu di bawah dipisah jelas: BARU ada di rentang yang dipilih, vs lifetime totals ── */}
      <div className="rounded-xl bg-primary-light/40 border border-primary/20 px-4 py-3 text-xs text-primary/90 flex flex-wrap items-center gap-2">
        <Activity size={12} />
        <span className="font-semibold">Periode:</span>
        <span className="font-mono">{from}</span>
        <span>→</span>
        <span className="font-mono">{to}</span>
        <span className="ml-auto text-primary/60">Angka &quot;Periode&quot; mengikuti rentang. Angka &quot;Total&quot; bersifat lifetime.</span>
      </div>

      {/* Summary cards — IN-RANGE first (paling relevan untuk filter), lifetime ditarik ke kartu Total Artikel/Pengguna */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={`Artikel Terbit (Periode)`}
          value={formatNumber(data.articles.publishedInRange)}
          icon={FileText}
          color="text-blue-500 bg-blue-50"
        />
        <StatCard
          label="Views (Periode)"
          value={formatNumber(data.views.inRange)}
          icon={Eye}
          color="text-primary bg-primary-light"
        />
        <StatCard
          label="Komentar (Periode)"
          value={formatNumber(data.comments.inRange)}
          icon={Activity}
          color="text-yellow-500 bg-yellow-50"
        />
        <StatCard
          label="Vote Polling (Periode)"
          value={formatNumber(data.polls.votesInRange)}
          icon={TrendingUp}
          color="text-green-600 bg-green-50"
        />
      </div>

      {/* Lifetime summary — secondary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Artikel (Lifetime)"
          value={formatNumber(data.articles.total)}
          icon={FileText}
          color="text-blue-500 bg-blue-50"
        />
        <StatCard
          label="Total Pengguna"
          value={formatNumber(data.users.total)}
          icon={Users}
          color="text-purple-500 bg-purple-50"
        />
        <StatCard
          label="Total Views (Lifetime)"
          value={formatNumber(data.views.total)}
          icon={Eye}
          color="text-primary bg-primary-light"
        />
        <StatCard
          label="Total Komentar (Lifetime)"
          value={formatNumber(data.comments.total)}
          icon={Activity}
          color="text-yellow-500 bg-yellow-50"
        />
      </div>

      {/* Trend over selected range */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-bold text-txt-primary mb-1">
          Trend Publikasi & Views
        </h3>
        <p className="text-xs text-txt-muted mb-4">
          Setiap titik = jumlah artikel terbit + total view kumulatif di hari itu (range yang dipilih).
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eaeb" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis yAxisId="left" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" fontSize={11} />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="publishedCount"
                stroke="#002045"
                strokeWidth={2}
                name="Terbit"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="viewCount"
                stroke="#b7102a"
                strokeWidth={2}
                name="Views"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Role distribution + AI + Sorotan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-bold text-txt-primary mb-4">
            Pengguna per Role
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleEntries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaeb" />
                <XAxis dataKey="role" fontSize={10} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#002045" name="Jumlah" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-bold text-txt-primary mb-1">
            AI Usage (Periode)
          </h3>
          <p className="text-xs text-txt-muted mb-4">
            Konsumsi token Claude/DeepSeek dalam rentang yang dipilih.
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-txt-secondary">Total Calls</span>
              <span className="font-bold">
                {formatNumber(data.ai.rangeCalls)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-txt-secondary">Total Tokens</span>
              <span className="font-bold">
                {formatNumber(data.ai.rangeTokens)}
              </span>
            </div>
          </div>
          <p className="text-xs font-semibold text-txt-secondary mb-2">
            Top Features
          </p>
          <div className="space-y-1.5">
            {data.ai.topFeatures.length === 0 ? (
              <p className="text-xs text-txt-muted">Belum ada aktivitas AI di rentang ini.</p>
            ) : (
              data.ai.topFeatures.map((f) => (
                <div
                  key={f.feature}
                  className="flex justify-between text-xs text-txt-secondary"
                >
                  <span className="font-mono">{f.feature}</span>
                  <span className="font-bold text-txt-primary">{formatNumber(f.calls)} <span className="text-txt-muted font-normal">/ {formatNumber(f.tokens)} tok</span></span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top articles — split: in-range vs lifetime */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="border-b border-border bg-surface-secondary px-5 py-4">
            <h3 className="text-base font-bold text-txt-primary">
              Top Artikel — Periode
            </h3>
            <p className="text-xs text-txt-muted mt-0.5">Artikel yang terbit dalam rentang, diurut by views</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">#</th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">Judul</th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.views.top10InRange.map((a, i) => (
                  <tr key={a.slug} className="hover:bg-surface-secondary/50">
                    <td className="px-5 py-3 text-txt-muted">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-txt-primary max-w-[400px] truncate">
                      <Link href={`/berita/${a.slug}`} target="_blank" className="hover:text-primary">
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-bold">{formatNumber(a.viewCount)}</td>
                  </tr>
                ))}
                {data.views.top10InRange.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-txt-muted">Belum ada artikel terbit di periode ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="border-b border-border bg-surface-secondary px-5 py-4">
            <h3 className="text-base font-bold text-txt-primary">
              Top Artikel — Lifetime
            </h3>
            <p className="text-xs text-txt-muted mt-0.5">10 artikel paling banyak dibaca seluruh waktu</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">#</th>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">Judul</th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.views.top10.map((a, i) => (
                  <tr key={a.slug} className="hover:bg-surface-secondary/50">
                    <td className="px-5 py-3 text-txt-muted">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-txt-primary max-w-[400px] truncate">
                      <Link href={`/berita/${a.slug}`} target="_blank" className="hover:text-primary">
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-bold">{formatNumber(a.viewCount)}</td>
                  </tr>
                ))}
                {data.views.top10.length === 0 && (
                  <tr><td colSpan={3} className="px-5 py-8 text-center text-txt-muted">Belum ada data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pipeline funnel: Sorotan + Social — kontekstual ke editorial workflow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-bold text-txt-primary mb-1">Sorotan SEO</h3>
          <p className="text-xs text-txt-muted mb-3">9-angle reframing untuk long-tail SEO</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-txt-secondary">Total</span><span className="font-bold">{formatNumber(data.sorotan.total)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Indexed</span><span className="font-bold text-primary">{formatNumber(data.sorotan.indexed)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Submitted</span><span className="font-bold text-blue-600">{formatNumber(data.sorotan.submitted)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Pending</span><span className="font-bold text-yellow-600">{formatNumber(data.sorotan.pending)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Failed</span><span className="font-bold text-red-600">{formatNumber(data.sorotan.failed)}</span></div>
            <div className="border-t border-border my-2" />
            <div className="flex justify-between"><span className="text-txt-secondary">Dibuat di periode</span><span className="font-bold">{formatNumber(data.sorotan.createdInRange)}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-bold text-txt-primary mb-1">Social Media</h3>
          <p className="text-xs text-txt-muted mb-3">Auto-publish ke IG/FB/Twitter</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-txt-secondary">Total post</span><span className="font-bold">{formatNumber(data.social.total)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Published</span><span className="font-bold text-primary">{formatNumber(data.social.published)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Draft</span><span className="font-bold text-txt-muted">{formatNumber(data.social.draft)}</span></div>
            <div className="border-t border-border my-2" />
            <div className="flex justify-between"><span className="text-txt-secondary">Terbit di periode</span><span className="font-bold">{formatNumber(data.social.publishedInRange)}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-bold text-txt-primary mb-1">Newsletter</h3>
          <p className="text-xs text-txt-muted mb-3">Pelanggan mailing list</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-txt-secondary">Total subscriber</span><span className="font-bold">{formatNumber(data.newsletter.subscribers)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Confirmed</span><span className="font-bold text-primary">{formatNumber(data.newsletter.confirmed)}</span></div>
            <div className="border-t border-border my-2" />
            <div className="flex justify-between"><span className="text-txt-secondary">Daftar di periode</span><span className="font-bold">{formatNumber(data.newsletter.newInRange)}</span></div>
          </div>
        </div>
      </div>

      {/* Glossary + Ads + Scraping */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-bold text-txt-primary mb-1">Glossary</h3>
          <p className="text-xs text-txt-muted mb-3">Istilah hukum yang dilihat pembaca</p>
          <div className="flex justify-between text-sm mb-3">
            <span className="text-txt-secondary">Total istilah</span>
            <span className="font-bold">{formatNumber(data.glossary.total)}</span>
          </div>
          <div className="flex justify-between text-sm mb-4">
            <span className="text-txt-secondary">Total views</span>
            <span className="font-bold">{formatNumber(data.glossary.viewsTotal)}</span>
          </div>
          <p className="text-xs font-semibold text-txt-secondary mb-2">Top 5</p>
          <div className="space-y-1.5">
            {data.glossary.top5.length === 0 ? (
              <p className="text-xs text-txt-muted">Belum ada data view.</p>
            ) : (
              data.glossary.top5.map((g) => (
                <div key={g.slug} className="flex justify-between text-xs">
                  <Link href={`/glossary/${g.slug}`} target="_blank" className="text-txt-secondary hover:text-primary truncate max-w-[200px]">{g.istilah}</Link>
                  <span className="font-bold text-txt-primary shrink-0">{formatNumber(g.viewCount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-bold text-txt-primary mb-1">Iklan</h3>
          <p className="text-xs text-txt-muted mb-3">Performance lifetime semua slot</p>
          <div className="space-y-1.5 text-sm mb-4">
            <div className="flex justify-between"><span className="text-txt-secondary">Aktif</span><span className="font-bold">{formatNumber(data.ads.activeCount)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Impressions</span><span className="font-bold">{formatNumber(data.ads.totalImpressions)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Clicks</span><span className="font-bold">{formatNumber(data.ads.totalClicks)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">CTR</span><span className="font-bold">{(data.ads.ctr * 100).toFixed(2)}%</span></div>
          </div>
          <p className="text-xs font-semibold text-txt-secondary mb-2">Top 5</p>
          <div className="space-y-1.5">
            {data.ads.top5.length === 0 ? (
              <p className="text-xs text-txt-muted">Belum ada impression.</p>
            ) : (
              data.ads.top5.map((a) => (
                <div key={a.id} className="flex justify-between text-xs">
                  <span className="text-txt-secondary truncate max-w-[180px]">{a.name}</span>
                  <span className="text-txt-primary shrink-0">
                    <span className="font-bold">{formatNumber(a.clicks)}</span>
                    <span className="text-txt-muted"> / {formatNumber(a.impressions)} </span>
                    <span className="text-txt-muted">({(a.ctr * 100).toFixed(1)}%)</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-bold text-txt-primary mb-1">Auto-Scraping</h3>
          <p className="text-xs text-txt-muted mb-3">Sumber berita & artikel hasil paraphrase</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-txt-secondary">Sumber terdaftar</span><span className="font-bold">{formatNumber(data.scraping.sources)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Sumber aktif</span><span className="font-bold text-primary">{formatNumber(data.scraping.activeSources)}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Artikel scrape (periode)</span><span className="font-bold">{formatNumber(data.scraping.articlesScrapedInRange)}</span></div>
            <div className="border-t border-border my-2" />
            <div className="flex justify-between"><span className="text-txt-secondary">Scrape sukses terakhir</span>
              <span className="font-mono text-[10px] text-txt-muted">
                {data.scraping.lastSuccessAt
                  ? new Date(data.scraping.lastSuccessAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })
                  : "—"}
              </span>
            </div>
          </div>
          <Link href="/panel/sumber-berita" className="mt-4 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Kelola sumber <ExternalLink size={10} />
          </Link>
        </div>
      </div>

      {/* Audit log activity */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-bold text-txt-primary mb-1">Aktivitas Sistem (Periode)</h3>
        <p className="text-xs text-txt-muted mb-4">Total {formatNumber(data.audit.totalInRange)} aksi tercatat di AuditLog dalam rentang dipilih.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-txt-secondary mb-2">Top Aksi</p>
            <div className="space-y-1.5">
              {data.audit.topActions.length === 0 ? (
                <p className="text-xs text-txt-muted">Tidak ada aktivitas.</p>
              ) : (
                data.audit.topActions.map((a) => (
                  <div key={a.action} className="flex justify-between text-xs">
                    <span className="font-mono text-txt-secondary">{a.action}</span>
                    <span className="font-bold text-txt-primary">{formatNumber(a.count)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-txt-secondary mb-2">Pengguna Paling Aktif</p>
            <div className="space-y-1.5">
              {data.audit.topUsers.length === 0 ? (
                <p className="text-xs text-txt-muted">Tidak ada aktivitas user.</p>
              ) : (
                data.audit.topUsers.map((u) => (
                  <div key={u.userId} className="flex justify-between text-xs">
                    <span className="text-txt-secondary truncate max-w-[200px]">{u.userName ?? u.userId.slice(0, 8)}</span>
                    <span className="font-bold text-txt-primary">{formatNumber(u.count)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- GA4 Tab ---
function GA4Tab({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<GA4Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/stats/google-analytics?from=${from}&to=${to}`,
      );
      const json = await res.json();
      setData(json.data);
      if (!json.success) setError(json.error || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 size={24} className="mx-auto animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <NotConfiguredBanner
        message={`GA4: ${error}`}
        settingKey="google_credentials_json & ga4_property_id"
      />
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Pageviews"
          value={formatNumber(data.pageviews)}
          icon={Eye}
        />
        <StatCard
          label="Users"
          value={formatNumber(data.users)}
          icon={Users}
          color="text-purple-500 bg-purple-50"
        />
        <StatCard
          label="Sessions"
          value={formatNumber(data.sessions)}
          icon={Activity}
          color="text-blue-500 bg-blue-50"
        />
        <StatCard
          label="Avg Duration"
          value={`${Math.round(data.avgSessionDurationSec)}s`}
          icon={TrendingUp}
          color="text-yellow-500 bg-yellow-50"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-bold text-txt-primary mb-4">
          Daily Trend
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eaeb" />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="pageviews"
                stroke="#002045"
                strokeWidth={2}
                name="Pageviews"
              />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#b7102a"
                strokeWidth={2}
                name="Users"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="border-b border-border bg-surface-secondary px-5 py-4">
          <h3 className="text-base font-bold text-txt-primary">Top Pages</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-secondary">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                  Path
                </th>
                <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                  Pageviews
                </th>
                <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                  Users
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.topPages.map((p) => (
                <tr key={p.path} className="hover:bg-surface-secondary/50">
                  <td className="px-5 py-3 font-mono text-xs text-txt-primary max-w-[400px] truncate">
                    {p.path}
                  </td>
                  <td className="px-5 py-3 text-right font-bold">
                    {formatNumber(p.pageviews)}
                  </td>
                  <td className="px-5 py-3 text-right text-txt-secondary">
                    {formatNumber(p.users)}
                  </td>
                </tr>
              ))}
              {data.topPages.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-8 text-center text-txt-muted"
                  >
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- GSC Tab ---
function GSCTab({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<GSCStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/stats/google-search?from=${from}&to=${to}`,
      );
      const json = await res.json();
      setData(json.data);
      if (!json.success) setError(json.error || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 size={24} className="mx-auto animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <NotConfiguredBanner
        message={`GSC: ${error}`}
        settingKey="google_credentials_json & gsc_site_url"
      />
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Impressions"
          value={formatNumber(data.impressions)}
          icon={Eye}
        />
        <StatCard
          label="Clicks"
          value={formatNumber(data.clicks)}
          icon={ExternalLink}
          color="text-primary bg-primary-light"
        />
        <StatCard
          label="CTR"
          value={`${(data.ctr * 100).toFixed(2)}%`}
          icon={TrendingUp}
          color="text-yellow-500 bg-yellow-50"
        />
        <StatCard
          label="Avg Position"
          value={data.avgPosition.toFixed(1)}
          icon={BarChart3}
          color="text-purple-500 bg-purple-50"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-bold text-txt-primary mb-4">
          Daily Trend
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eaeb" />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="impressions"
                stroke="#002045"
                strokeWidth={2}
                name="Impressions"
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke="#b7102a"
                strokeWidth={2}
                name="Clicks"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="border-b border-border bg-surface-secondary px-5 py-4">
            <h3 className="text-base font-bold text-txt-primary">
              Top Queries
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Query
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                    Impr
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                    Clicks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topQueries.map((q, i) => (
                  <tr key={i} className="hover:bg-surface-secondary/50">
                    <td className="px-5 py-3 text-xs text-txt-primary">
                      {q.query}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {formatNumber(q.impressions)}
                    </td>
                    <td className="px-5 py-3 text-right font-bold">
                      {formatNumber(q.clicks)}
                    </td>
                  </tr>
                ))}
                {data.topQueries.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-txt-muted"
                    >
                      Belum ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <div className="border-b border-border bg-surface-secondary px-5 py-4">
            <h3 className="text-base font-bold text-txt-primary">Top Pages</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Page
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                    Impr
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                    Clicks
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topPages.map((p, i) => (
                  <tr key={i} className="hover:bg-surface-secondary/50">
                    <td className="px-5 py-3 font-mono text-xs text-txt-primary max-w-[220px] truncate">
                      {p.page}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {formatNumber(p.impressions)}
                    </td>
                    <td className="px-5 py-3 text-right font-bold">
                      {formatNumber(p.clicks)}
                    </td>
                  </tr>
                ))}
                {data.topPages.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-8 text-center text-txt-muted"
                    >
                      Belum ada data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Cloudflare Tab ---
function CloudflareTab({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<CFStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/stats/cloudflare?from=${from}&to=${to}`,
      );
      const json = await res.json();
      setData(json.data);
      if (!json.success) setError(json.error || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 size={24} className="mx-auto animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <NotConfiguredBanner
        message={`Cloudflare: ${error}`}
        settingKey="cloudflare_api_token & cloudflare_zone_id"
      />
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Requests"
          value={formatNumber(data.requests)}
          icon={Activity}
        />
        <StatCard
          label="Bandwidth"
          value={formatBytes(data.bandwidth)}
          icon={Cloud}
          color="text-blue-500 bg-blue-50"
        />
        <StatCard
          label="Cache Hit Rate"
          value={`${(data.cacheHitRate * 100).toFixed(1)}%`}
          icon={TrendingUp}
          color="text-primary bg-primary-light"
        />
        <StatCard
          label="Threats Blocked"
          value={formatNumber(data.threats)}
          icon={Shield}
          color="text-red-500 bg-red-50"
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-bold text-txt-primary mb-4">
          Requests vs Cache
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8eaeb" />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="requests"
                stroke="#002045"
                strokeWidth={2}
                name="Requests"
              />
              <Line
                type="monotone"
                dataKey="cachedRequests"
                stroke="#b7102a"
                strokeWidth={2}
                name="Cached"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// --- Page ---
export default function StatistikPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const isSuperAdmin = userRole === "SUPER_ADMIN";
  // Only SUPER_ADMIN sees the site-wide ("Umum") view — which is the only place
  // the per-role user breakdown and Sorotan SEO appear. Every other role
  // (incl. CHIEF_EDITOR / EDITOR) sees ONLY their own ("Pribadi") stats, so
  // those site-wide sections are never shown to a non-superadmin.
  const canSeeGeneral = isSuperAdmin;
  // Editor-tier (SA | CHIEF_EDITOR | EDITOR) also get the merged "Editor" tab —
  // the former /panel/statistik-editor page (review performance + team Sorotan).
  const isEditorTier = EDITOR_ROLES.includes(userRole);
  const [statScope, setStatScope] = useState<"all" | "me">("all");
  const [tab, setTab] = useState<
    "internal" | "editor" | "ga4" | "gsc" | "cf"
  >("internal");
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(ymd(thirtyDaysAgo));
  const [to, setTo] = useState(ymd(now));
  const [refreshKey, setRefreshKey] = useState(0);

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Statistik
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            {isSuperAdmin
              ? "Dashboard terpusat — Internal, GA4, GSC, dan Cloudflare."
              : canSeeGeneral
                ? "Statistik umum situs + performa pribadi Anda."
                : "Statistik performa artikel Anda."}
          </p>
        </div>
      </div>

      {/* Date range */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-txt-secondary">
            From
          </label>
          <input
            type="date"
            className="input py-1.5 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-txt-secondary">To</label>
          <input
            type="date"
            className="input py-1.5 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Umum vs Pribadi — editors+ can switch between site-wide and their own
          numbers on the Internal tab. Creators only ever see their own. */}
      {canSeeGeneral && tab === "internal" && (
        <div className="mb-6 inline-flex rounded-lg border border-border bg-surface p-1">
          {([
            { k: "all", label: "Umum" },
            { k: "me", label: "Pribadi" },
          ] as const).map((o) => (
            <button
              key={o.k}
              onClick={() => setStatScope(o.k)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                statScope === o.k
                  ? "bg-primary text-white"
                  : "text-txt-secondary hover:text-txt-primary"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {/* Tabs — editor-tier (SA | CHIEF_EDITOR | EDITOR). Editors get the merged
          "Editor" tab; the GA4/GSC/Cloudflare tabs stay SUPER_ADMIN-only.
          Creators see no tab bar — just their own Internal stats. */}
      {isEditorTier && (
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {[
          { key: "internal", label: "Internal", icon: BarChart3 },
          { key: "editor", label: "Editor", icon: Users },
          ...(isSuperAdmin
            ? [
                { key: "ga4", label: "Google Analytics", icon: TrendingUp },
                { key: "gsc", label: "Search Console", icon: SearchIcon },
                { key: "cf", label: "Cloudflare", icon: Cloud },
              ]
            : []),
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() =>
                setTab(t.key as "internal" | "editor" | "ga4" | "gsc" | "cf")
              }
              className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-txt-secondary hover:text-txt-primary"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>
      )}

      {tab === "internal" && (
        <InternalTab
          key={`internal-${refreshKey}-${canSeeGeneral ? statScope : "me"}`}
          from={from}
          to={to}
          scope={canSeeGeneral ? statScope : "me"}
        />
      )}
      {isEditorTier && tab === "editor" && (
        <EditorTab key={`editor-${refreshKey}`} />
      )}
      {isSuperAdmin && tab === "ga4" && (
        <GA4Tab key={`ga4-${refreshKey}`} from={from} to={to} />
      )}
      {isSuperAdmin && tab === "gsc" && (
        <GSCTab key={`gsc-${refreshKey}`} from={from} to={to} />
      )}
      {isSuperAdmin && tab === "cf" && (
        <CloudflareTab key={`cf-${refreshKey}`} from={from} to={to} />
      )}
    </div>
  );
}
