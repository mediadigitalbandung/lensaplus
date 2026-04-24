"use client";

/**
 * Statistik Dashboard — EDITOR+
 * 4 tabs: Internal | Google Analytics | Google Search Console | Cloudflare
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
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

// --- Types ---
interface InternalStats {
  articles: {
    total: number;
    published: number;
    draft: number;
    inReview: number;
    rejected: number;
    archived: number;
  };
  users: { total: number; byRole: Record<string, number> };
  views: {
    total: number;
    top10: Array<{ slug: string; title: string; viewCount: number }>;
  };
  weeklyTrend: Array<{
    date: string;
    publishedCount: number;
    viewCount: number;
  }>;
  comments: { total: number; pending: number; approved: number };
  polls: { total: number; active: number; totalVotes: number };
  ai: {
    last30dTokens: number;
    last30dCalls: number;
    topFeatures: Array<{ feature: string; calls: number }>;
  };
  sorotan: {
    total: number;
    indexed: number;
    pending: number;
    failed: number;
  };
  social: { total: number; published: number; draft: number };
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
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className={`inline-flex rounded-xl p-2 ${color}`}>
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
    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
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
              <code className="font-mono bg-yellow-100 px-1 py-0.5 rounded">
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

// --- Internal Tab ---
function InternalTab({ from, to }: { from: string; to: string }) {
  const [data, setData] = useState<InternalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/stats/internal?from=${from}&to=${to}`,
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
  if (!data) {
    return (
      <p className="text-sm text-txt-muted py-8 text-center">
        Gagal memuat data.
      </p>
    );
  }

  const roleEntries = Object.entries(data.users.byRole).map(
    ([role, count]) => ({
      role: role.replace(/_/g, " "),
      count,
    }),
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Artikel"
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
          label="Total Views"
          value={formatNumber(data.views.total)}
          icon={Eye}
          color="text-primary bg-primary-light"
        />
        <StatCard
          label="Komentar"
          value={formatNumber(data.comments.total)}
          icon={Activity}
          color="text-yellow-500 bg-yellow-50"
        />
      </div>

      {/* Weekly trend */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="text-base font-bold text-txt-primary mb-4">
          Trend 7 Hari
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.weeklyTrend}>
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
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
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
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-base font-bold text-txt-primary mb-4">
            AI Usage (30 hari)
          </h3>
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-txt-secondary">Total Calls</span>
              <span className="font-bold">
                {formatNumber(data.ai.last30dCalls)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-txt-secondary">Total Tokens</span>
              <span className="font-bold">
                {formatNumber(data.ai.last30dTokens)}
              </span>
            </div>
          </div>
          <p className="text-xs font-semibold text-txt-secondary mb-2">
            Top Features
          </p>
          <div className="space-y-1.5">
            {data.ai.topFeatures.length === 0 ? (
              <p className="text-xs text-txt-muted">Belum ada aktivitas AI.</p>
            ) : (
              data.ai.topFeatures.map((f) => (
                <div
                  key={f.feature}
                  className="flex justify-between text-xs text-txt-secondary"
                >
                  <span className="font-mono">{f.feature}</span>
                  <span className="font-bold text-txt-primary">{f.calls}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top articles */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="border-b border-border bg-surface-secondary px-5 py-4">
          <h3 className="text-base font-bold text-txt-primary">
            Top 10 Artikel
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-secondary">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                  #
                </th>
                <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                  Judul
                </th>
                <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                  Views
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.views.top10.map((a, i) => (
                <tr key={a.slug} className="hover:bg-surface-secondary/50">
                  <td className="px-5 py-3 text-txt-muted">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-txt-primary max-w-[400px] truncate">
                    <Link
                      href={`/berita/${a.slug}`}
                      target="_blank"
                      className="hover:text-primary"
                    >
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right font-bold">
                    {formatNumber(a.viewCount)}
                  </td>
                </tr>
              ))}
              {data.views.top10.length === 0 && (
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

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
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

      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
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

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
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
        <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
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

        <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
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

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
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
  const [tab, setTab] = useState<"internal" | "ga4" | "gsc" | "cf">(
    "internal",
  );
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(ymd(thirtyDaysAgo));
  const [to, setTo] = useState(ymd(now));
  const [refreshKey, setRefreshKey] = useState(0);

  if (
    sessionStatus !== "loading" &&
    session &&
    !EDITOR_ROLES.includes(userRole)
  ) {
    redirect("/panel/dashboard");
  }

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
            Dashboard terpusat — Internal, GA4, GSC, dan Cloudflare.
          </p>
        </div>
      </div>

      {/* Date range */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
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

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {[
          { key: "internal", label: "Internal", icon: BarChart3 },
          { key: "ga4", label: "Google Analytics", icon: TrendingUp },
          { key: "gsc", label: "Search Console", icon: SearchIcon },
          { key: "cf", label: "Cloudflare", icon: Cloud },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() =>
                setTab(t.key as "internal" | "ga4" | "gsc" | "cf")
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

      {tab === "internal" && (
        <InternalTab key={`internal-${refreshKey}`} from={from} to={to} />
      )}
      {tab === "ga4" && (
        <GA4Tab key={`ga4-${refreshKey}`} from={from} to={to} />
      )}
      {tab === "gsc" && (
        <GSCTab key={`gsc-${refreshKey}`} from={from} to={to} />
      )}
      {tab === "cf" && (
        <CloudflareTab key={`cf-${refreshKey}`} from={from} to={to} />
      )}
    </div>
  );
}
