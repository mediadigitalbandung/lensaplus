"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, CheckCircle, AlertTriangle, XCircle, ExternalLink, Globe, FileText, Image, Type, Tag, RefreshCw, TrendingUp, Sparkles, Loader2, Wand2, Zap, Activity, KeyRound } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface SeoData {
  overview: {
    seoScore: number;
    totalArticles: number;
    publishedArticles: number;
    articlesWithSeo: number;
    articlesWithImage: number;
    articlesWithExcerpt: number;
    categories: number;
    tags: number;
    sitemapPages: number;
  };
  coverage: { seoTitle: number; image: number; excerpt: number };
  urls: { sitemap: string; newsSitemap: string; robots: string; searchConsole: string; publisherCenter: string };
  articleAudit: {
    id: string; title: string; slug: string; url: string; seoTitle: string | null; seoDescription: string | null;
    hasImage: boolean; hasExcerpt: boolean; category: string; issues: string[]; score: number; views: number; publishedAt: string;
  }[];
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const bgColor = score >= 80 ? "bg-green-50" : score >= 50 ? "bg-yellow-50" : "bg-red-50";
  const ringColor = score >= 80 ? "ring-green-100" : score >= 50 ? "ring-yellow-100" : "ring-red-100";
  return (
    <div className={`flex h-28 w-28 items-center justify-center rounded-full ${bgColor} ring-4 ${ringColor}`}>
      <span className={`text-3xl font-bold ${color}`}>{score}</span>
    </div>
  );
}

function CoverageBar({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  const color = value >= 80 ? "bg-green-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 text-txt-secondary"><Icon size={14} /> {label}</span>
        <span className="font-bold text-txt-primary">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

interface IndexStatusData {
  total: number;
  counts: {
    pending: number;
    submitted: number;
    indexed: number;
    failed: number;
    unknown: number;
  };
}

export default function SeoDashboardPage() {
  const [data, setData] = useState<SeoData | null>(null);
  const [indexStatus, setIndexStatus] = useState<IndexStatusData | null>(null);
  const [sorotanStatus, setSorotanStatus] = useState<IndexStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [testingCreds, setTestingCreds] = useState(false);
  const [credResult, setCredResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [auditFilter, setAuditFilter] = useState<"all" | "perfect" | "issues">("all");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PER_PAGE = 15;
  const { success: showSuccess, error: showError } = useToast();
  const { confirm } = useConfirm();

  async function handleBulkReindex() {
    const ok = await confirm({
      title: "Re-index Semua",
      message: "Semua artikel PUBLISHED akan ditandai 'pending' dan disubmit ulang oleh cron. Lanjutkan?",
      variant: "warning",
    });
    if (!ok) return;
    try {
      setReindexing(true);
      const res = await fetch("/api/seo/bulk-reindex", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      showSuccess(`${json.data?.marked ?? 0} artikel ditandai untuk re-index.`);
      fetchData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal bulk reindex");
    } finally {
      setReindexing(false);
    }
  }

  async function handleTestCredentials() {
    try {
      setTestingCreds(true);
      setCredResult(null);
      const res = await fetch("/api/seo/test-credentials", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      const result = json.data;
      const ok = Boolean(result?.ok || result?.success || result?.valid);
      setCredResult({
        ok,
        message: result?.message || (ok ? "Credentials valid." : "Credentials invalid."),
      });
    } catch (err) {
      setCredResult({
        ok: false,
        message: err instanceof Error ? err.message : "Gagal test",
      });
    } finally {
      setTestingCreds(false);
    }
  }

  async function handleAIGenerate() {
    try {
      setGenerating(true);
      const res = await fetch("/api/ai/bulk-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal generate");
      showSuccess(json.data?.message || `${json.data?.processed} artikel berhasil di-update`);
      fetchData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal generate SEO");
    } finally {
      setGenerating(false);
    }
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [panelRes, idxRes, sorRes] = await Promise.all([
        fetch("/api/panel/seo").catch(() => null),
        fetch("/api/seo/status").catch(() => null),
        fetch("/api/seo/sorotan-status").catch(() => null),
      ]);
      if (panelRes?.ok) {
        const json = await panelRes.json();
        setData(json.data);
      }
      if (idxRes?.ok) {
        const json = await idxRes.json();
        setIndexStatus(json.data);
      }
      if (sorRes?.ok) {
        const json = await sorRes.json();
        setSorotanStatus(json.data);
      }
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-surface-tertiary" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-xl bg-surface-tertiary" />)}
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-txt-muted">Gagal memuat data SEO.</p>;

  const { overview, coverage, urls, articleAudit } = data;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">SEO Dashboard</h1>
          <p className="text-base text-txt-secondary">Monitor kesehatan SEO website Kartawarta</p>
        </div>
        <button onClick={fetchData} className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Score + Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* SEO Score */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-card flex flex-col items-center justify-center">
          <ScoreCircle score={overview.seoScore} />
          <p className="mt-3 text-sm font-bold text-txt-primary">Skor SEO</p>
          <p className="text-xs text-txt-muted">dari 100</p>
        </div>

        {/* Stats */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
          <h3 className="text-sm font-bold text-txt-primary flex items-center gap-1.5"><FileText size={14} className="text-primary" /> Konten</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-txt-secondary">Artikel Dipublikasi</span><span className="font-bold">{overview.publishedArticles}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Total Artikel</span><span className="font-bold">{overview.totalArticles}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Kategori</span><span className="font-bold">{overview.categories}</span></div>
            <div className="flex justify-between"><span className="text-txt-secondary">Tags</span><span className="font-bold">{overview.tags}</span></div>
          </div>
        </div>

        {/* Coverage */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
          <h3 className="text-sm font-bold text-txt-primary flex items-center gap-1.5"><CheckCircle size={14} className="text-green-500" /> Coverage</h3>
          <CoverageBar label="SEO Title" value={coverage.seoTitle} icon={Type} />
          <CoverageBar label="Gambar" value={coverage.image} icon={Image} />
          <CoverageBar label="Excerpt" value={coverage.excerpt} icon={FileText} />
        </div>

        {/* Sitemap & Links */}
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card space-y-4">
          <h3 className="text-sm font-bold text-txt-primary flex items-center gap-1.5"><Globe size={14} className="text-primary" /> Sitemap & Tools</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-txt-secondary">Halaman di Sitemap</span>
              <span className="font-bold">{overview.sitemapPages}</span>
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            <a href={urls.sitemap} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline"><ExternalLink size={10} /> sitemap.xml</a>
            <a href={urls.newsSitemap} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline"><ExternalLink size={10} /> news-sitemap.xml</a>
            <a href={urls.robots} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline"><ExternalLink size={10} /> robots.txt</a>
            <a href={urls.searchConsole} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline"><ExternalLink size={10} /> Google Search Console</a>
            <a href={urls.publisherCenter} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-xs text-primary hover:underline"><ExternalLink size={10} /> Google News Publisher</a>
          </div>
        </div>
      </div>

      {/* SEO Features */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card mb-6">
        <h3 className="text-sm font-bold text-txt-primary mb-4 flex items-center gap-1.5"><TrendingUp size={14} className="text-primary" /> Fitur SEO Aktif</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { name: "JSON-LD NewsArticle", ok: true },
            { name: "OpenGraph Tags", ok: true },
            { name: "Twitter Cards", ok: true },
            { name: "Canonical URLs", ok: true },
            { name: "Google News Sitemap", ok: true },
            { name: "IndexNow Auto-Ping", ok: true },
            { name: "Auto SEO Title", ok: true },
            { name: "Auto Meta Description", ok: true },
            { name: "Breadcrumb Schema", ok: true },
            { name: "Search Console Verified", ok: true },
            { name: "Publisher Center", ok: true },
            { name: "Cloudflare CDN", ok: true },
          ].map((f) => (
            <div key={f.name} className="flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2.5 text-xs">
              <CheckCircle size={12} className="text-green-500 shrink-0" />
              <span className="text-txt-primary font-medium">{f.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Generate SEO */}
      {articleAudit.some(a => a.issues.length > 0) && (
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-card mb-6">
          <h3 className="text-sm font-bold text-txt-primary mb-3 flex items-center gap-1.5">
            <Wand2 size={14} className="text-primary" /> Generate SEO Otomatis
          </h3>
          <p className="text-xs text-txt-secondary mb-4">
            Artikel yang belum memiliki SEO Title dan Meta Description bisa di-generate otomatis.
          </p>
          <button
            onClick={handleAIGenerate}
            disabled={generating}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? "AI Generating..." : "AI Generate SEO (DeepSeek)"}
          </button>
          <p className="mt-3 text-[10px] text-txt-muted">
            Generate SEO Title & Meta Description menggunakan AI DeepSeek — maks 20 artikel per batch. Pastikan API Key sudah dikonfigurasi di Pengaturan.
          </p>
        </div>
      )}

      {/* Index Monitor */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-txt-primary flex items-center gap-1.5">
            <Activity size={14} className="text-primary" /> Monitor Index (Google + IndexNow)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleTestCredentials}
              disabled={testingCreds}
              className="btn-ghost flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {testingCreds ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
              Test Credentials
            </button>
            <button
              onClick={handleBulkReindex}
              disabled={reindexing}
              className="btn-secondary flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {reindexing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Re-index Semua
            </button>
          </div>
        </div>

        {credResult && (
          <div
            className={`mb-4 rounded-lg border p-3 text-xs ${
              credResult.ok
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <span className="font-semibold">
              {credResult.ok ? "✓ " : "✗ "}
            </span>
            {credResult.message}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl bg-surface-secondary p-3">
            <p className="text-xs text-txt-muted mb-1">Total</p>
            <p className="text-xl font-extrabold text-txt-primary">
              {indexStatus?.total ?? 0}
            </p>
          </div>
          <div className="rounded-xl bg-yellow-50 p-3">
            <p className="text-xs text-yellow-700 mb-1">Pending</p>
            <p className="text-xl font-extrabold text-yellow-700">
              {indexStatus?.counts.pending ?? 0}
            </p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs text-blue-700 mb-1">Submitted</p>
            <p className="text-xl font-extrabold text-blue-700">
              {indexStatus?.counts.submitted ?? 0}
            </p>
          </div>
          <div className="rounded-xl bg-primary-light p-3">
            <p className="text-xs text-primary mb-1">Indexed</p>
            <p className="text-xl font-extrabold text-primary">
              {indexStatus?.counts.indexed ?? 0}
            </p>
          </div>
          <div className="rounded-xl bg-red-50 p-3">
            <p className="text-xs text-red-700 mb-1">Failed</p>
            <p className="text-xl font-extrabold text-red-700">
              {indexStatus?.counts.failed ?? 0}
            </p>
          </div>
        </div>

        {sorotanStatus && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-txt-secondary mb-2">Sorotan index</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-xl bg-surface-secondary p-3">
                <p className="text-xs text-txt-muted mb-1">Total</p>
                <p className="text-lg font-extrabold text-txt-primary">
                  {sorotanStatus.total}
                </p>
              </div>
              <div className="rounded-xl bg-yellow-50 p-3">
                <p className="text-xs text-yellow-700 mb-1">Pending</p>
                <p className="text-lg font-extrabold text-yellow-700">
                  {sorotanStatus.counts.pending}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-xs text-blue-700 mb-1">Submitted</p>
                <p className="text-lg font-extrabold text-blue-700">
                  {sorotanStatus.counts.submitted}
                </p>
              </div>
              <div className="rounded-xl bg-primary-light p-3">
                <p className="text-xs text-primary mb-1">Indexed</p>
                <p className="text-lg font-extrabold text-primary">
                  {sorotanStatus.counts.indexed}
                </p>
              </div>
              <div className="rounded-xl bg-red-50 p-3">
                <p className="text-xs text-red-700 mb-1">Failed</p>
                <p className="text-lg font-extrabold text-red-700">
                  {sorotanStatus.counts.failed}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Article SEO Audit */}
      {(() => {
        const perfectCount = articleAudit.filter(a => a.issues.length === 0).length;
        const issuesCount = articleAudit.filter(a => a.issues.length > 0).length;

        const filtered = articleAudit
          .filter(a => {
            if (auditFilter === "perfect") return a.issues.length === 0;
            if (auditFilter === "issues") return a.issues.length > 0;
            return true;
          })
          .filter(a => !auditSearch || a.title.toLowerCase().includes(auditSearch.toLowerCase()) || a.category.toLowerCase().includes(auditSearch.toLowerCase()));

        const totalPages = Math.ceil(filtered.length / AUDIT_PER_PAGE);
        const paginated = filtered.slice((auditPage - 1) * AUDIT_PER_PAGE, auditPage * AUDIT_PER_PAGE);

        return (
          <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-bold text-txt-primary flex items-center gap-1.5"><Search size={14} className="text-primary" /> Audit SEO Artikel</h3>
                <span className="text-xs text-txt-muted">{articleAudit.length} artikel total</span>
              </div>

              {/* Filter tabs */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button onClick={() => { setAuditFilter("all"); setAuditPage(1); }} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${auditFilter === "all" ? "bg-primary text-white" : "bg-surface-secondary text-txt-secondary hover:bg-surface-tertiary"}`}>
                  Semua ({articleAudit.length})
                </button>
                <button onClick={() => { setAuditFilter("perfect"); setAuditPage(1); }} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${auditFilter === "perfect" ? "bg-green-500 text-white" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
                  <span className="inline-flex items-center gap-1"><CheckCircle size={10} /> Sempurna ({perfectCount})</span>
                </button>
                <button onClick={() => { setAuditFilter("issues"); setAuditPage(1); }} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${auditFilter === "issues" ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                  <span className="inline-flex items-center gap-1"><AlertTriangle size={10} /> Ada Masalah ({issuesCount})</span>
                </button>
              </div>

              {/* Search */}
              <div className="relative max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
                <input
                  type="text"
                  placeholder="Cari judul atau kategori..."
                  value={auditSearch}
                  onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
                  className="input w-full pl-9 py-2 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-secondary border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-txt-secondary">Artikel</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-txt-secondary">Skor</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-medium text-txt-secondary">SEO Title</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-center text-xs font-medium text-txt-secondary">Meta Desc</th>
                    <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-medium text-txt-secondary">Gambar</th>
                    <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-medium text-txt-secondary">Excerpt</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-txt-secondary">Masalah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((a) => (
                    <tr key={a.slug} className="hover:bg-surface-secondary">
                      <td className="px-4 py-3 max-w-[220px]">
                        <a href={a.url} target="_blank" rel="noopener" className="text-sm font-medium text-txt-primary hover:text-primary truncate block">{a.title}</a>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-primary font-medium">{a.category}</span>
                          <span className="text-[10px] text-txt-muted">·</span>
                          <span className="text-[10px] text-txt-muted">{a.views.toLocaleString("id-ID")} views</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold ${
                          a.score >= 80 ? "bg-green-50 text-green-600" : a.score >= 50 ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"
                        }`}>{a.score}</span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-center">
                        {a.seoTitle ? <CheckCircle size={14} className="mx-auto text-green-500" /> : <XCircle size={14} className="mx-auto text-red-400" />}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-center">
                        {a.seoDescription ? <CheckCircle size={14} className="mx-auto text-green-500" /> : <XCircle size={14} className="mx-auto text-red-400" />}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-center">
                        {a.hasImage ? <CheckCircle size={14} className="mx-auto text-green-500" /> : <XCircle size={14} className="mx-auto text-red-400" />}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-center">
                        {a.hasExcerpt ? <CheckCircle size={14} className="mx-auto text-green-500" /> : <XCircle size={14} className="mx-auto text-red-400" />}
                      </td>
                      <td className="px-4 py-3">
                        {a.issues.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-500 font-medium"><CheckCircle size={10} /> Sempurna</span>
                        ) : (
                          <div className="space-y-0.5">
                            {a.issues.map((issue, i) => (
                              <span key={i} className="flex items-center gap-1 text-xs text-yellow-600">
                                <AlertTriangle size={10} className="shrink-0" /> {issue}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-txt-muted">Tidak ada artikel ditemukan</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-txt-muted">Halaman {auditPage} dari {totalPages} ({filtered.length} artikel)</p>
                <div className="flex gap-1.5">
                  <button onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={auditPage <= 1} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">← Prev</button>
                  <button onClick={() => setAuditPage(p => Math.min(totalPages, p + 1))} disabled={auditPage >= totalPages} className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40">Next →</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
