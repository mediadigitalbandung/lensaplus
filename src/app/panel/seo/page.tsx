"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";
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
    articlesWithSorotan: number;
    sorotanCoverage: number;
    sorotanTotal: number;
    sorotanIndexed: number;
    categories: number;
    tags: number;
    topicCount: number;
    glossaryCount: number;
    sitemapPages: number;
    newsSitemapCount: number;
    indexedRatio: number;
    submittedRatio: number;
  };
  coverage: { seoTitle: number; image: number; excerpt: number; sorotan: number };
  indexing: {
    counts: { pending: number; submitted: number; indexed: number; failed: number; unknown: number };
    googleIndexingEnabled: boolean;
    indexNowEnabled: boolean;
    lastSubmitted: { slug: string; title: string; at: string | null; status: string | null } | null;
    sitemapLastPingedAt: string | null;
    googleQuota: { used: number; limit: number; remaining: number; percentUsed: number; date: string };
  };
  urls: {
    sitemap: string;
    newsSitemap: string;
    sitemapGlossary: string;
    sitemapSorotan: string;
    robots: string;
    searchConsole: string;
    publisherCenter: string;
  };
  articleAudit: {
    id: string;
    title: string;
    slug: string;
    url: string;
    seoTitle: string | null;
    seoDescription: string | null;
    hasImage: boolean;
    hasExcerpt: boolean;
    sorotanCount: number;
    indexStatus: string;
    lastIndexedAt: string | null;
    category: string;
    issues: string[];
    score: number;
    views: number;
    publishedAt: string | null;
  }[];
}

function ScoreCircle({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-700"
      : score >= 50
      ? "text-amber-700"
      : "text-red-700";
  const borderColor =
    score >= 80
      ? "border-emerald-600"
      : score >= 50
      ? "border-amber-500"
      : "border-red-600";
  return (
    <div
      className={`flex h-28 w-28 items-center justify-center rounded-full border-4 ${borderColor} bg-surface`}
    >
      <span className={`text-3xl font-bold ${color}`}>{score}</span>
    </div>
  );
}

function CoverageBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 80
      ? "bg-emerald-600"
      : value >= 50
      ? "bg-amber-500"
      : "bg-red-600";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-txt-secondary">{label}</span>
        <span className="font-bold text-txt-primary">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
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
  topErrors?: Array<{ message: string; count: number }>;
  lastSubmitted?: {
    id: string;
    slug: string;
    title: string;
    lastIndexedAt: string | null;
    indexStatus: string | null;
  } | null;
  priority?: {
    order: ["article", "sorotan"];
    dailyLimit: number;
    quotaUsed: number;
    quotaRemaining: number;
    articlePendingCount: number;
    sorotanPendingCount: number;
    articleAllocatedQuota: number;
    sorotanEligibleQuota: number;
    sorotanAllocatedQuota: number;
    canSubmitSorotan: boolean;
    deferReason: "QUOTA_EXHAUSTED" | "ARTICLES_PRIORITIZED" | null;
  };
}

export default function SeoDashboardPage() {
  const [data, setData] = useState<SeoData | null>(null);
  const [indexStatus, setIndexStatus] = useState<IndexStatusData | null>(null);
  const [sorotanStatus, setSorotanStatus] = useState<IndexStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [indexingSorotan, setIndexingSorotan] = useState(false);
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
      title: "Re-index Prioritas (Artikel Utama → Sorotan)",
      message:
        "Seluruh Artikel Utama (PUBLISHED) akan diutamakan lebih dulu dalam kuota harian 200/hari Google Indexing API. Sorotan hanya akan dikirim apabila seluruh Artikel Utama telah selesai dan kuota harian masih tersisa. Lanjutkan?",
      variant: "warning",
    });
    if (!ok) return;
    try {
      setReindexing(true);
      const res = await fetch("/api/seo/bulk-reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "priority_all" }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      const d = json.data ?? {};
      showSuccess(
        d.note ||
          `${d.submittedNow ?? 0} dari ${d.marked ?? 0} artikel utama langsung dikirim untuk re-index.`,
      );
      fetchData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal bulk reindex");
    } finally {
      setReindexing(false);
    }
  }

  async function handleIndexRemainingSorotan() {
    try {
      setIndexingSorotan(true);
      const res = await fetch("/api/seo/batch-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fillRemainingWithSorotan: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      const d = json.data ?? {};
      showSuccess(
        d.note ||
          `Prioritas selesai: ${d.articles?.succeeded ?? 0} artikel utama, ${d.sorotan?.succeeded ?? 0} sorotan dikirim.`,
      );
      fetchData();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Gagal mengirim antrean prioritas",
      );
    } finally {
      setIndexingSorotan(false);
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
        message:
          result?.message ||
          result?.error ||
          (ok ? "Credentials valid." : "Credentials invalid."),
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
      showSuccess(
        json.data?.message || `${json.data?.processed} artikel berhasil di-update`,
      );
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
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded-lg bg-surface-tertiary" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-surface-tertiary" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-txt-muted">Gagal memuat data SEO.</p>;

  const { overview, coverage, urls, indexing, articleAudit } = data;

  const articlePendingCount =
    indexStatus?.priority?.articlePendingCount ??
    indexStatus?.counts.pending ??
    indexing.counts.pending ??
    0;
  const sorotanPendingCount =
    indexStatus?.priority?.sorotanPendingCount ??
    sorotanStatus?.counts.pending ??
    0;
  const quotaRemaining = indexing.googleQuota.remaining;
  const articleAllocatedQuota = Math.min(articlePendingCount, quotaRemaining);
  const sorotanEligibleQuota =
    articlePendingCount === 0
      ? quotaRemaining
      : Math.max(0, quotaRemaining - articlePendingCount);
  const canSubmitSorotanNow =
    articlePendingCount === 0 && quotaRemaining > 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
            SEO Dashboard
          </h1>
          <p className="text-base text-txt-secondary">
            Monitor kesehatan SEO dan antrean prioritas indexing Lensaplus
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Banner: Google Indexing API status (informational, NOT alarming) */}
      {!indexing.googleIndexingEnabled && (
        <div className="mb-6 rounded-xl border border-border border-l-4 border-l-primary bg-surface p-4 sm:p-5 text-sm">
          <div className="space-y-3">
            <div>
              <p className="font-bold text-txt-primary mb-1">
                Google Indexing API: <span className="font-mono">disabled</span>
              </p>
              <p className="text-txt-secondary leading-relaxed">
                Site Anda <strong>tetap ter-indexed normal Google</strong> via 3
                mekanisme lain yang aktif. Counter di bawah ini hanya melacak{" "}
                <strong>Indexing API submission</strong>, bukan status real
                indexing di Google Search.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
                <p className="font-semibold text-txt-primary">✓ sitemap-news.xml</p>
                <p className="text-txt-secondary">Google News, polling ~5 menit</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
                <p className="font-semibold text-txt-primary">✓ Sitemap + crawl</p>
                <p className="text-txt-secondary">Googlebot natural, daily</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
                <p className="font-semibold text-txt-primary">
                  {indexing.indexNowEnabled ? "✓" : "✗"} IndexNow
                </p>
                <p className="text-txt-secondary">Bing/Yandex, instant ping</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-txt-secondary">
                Cek status indexing real:
              </span>
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noopener"
                className="btn-primary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold"
              >
                <ExternalLink size={11} /> GSC URL Inspection
              </a>
              <a
                href="https://www.google.com/search?q=site%3Alensaplus.com"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-txt-primary hover:border-primary hover:text-primary"
              >
                site:lensaplus.com
              </a>
              <Link
                href="/panel/pengaturan"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-primary hover:border-primary"
              >
                Re-enable di Pengaturan →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Score + Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* SEO Score */}
        <div className="rounded-xl border border-border bg-surface p-6 shadow-card flex flex-col items-center justify-center">
          <ScoreCircle score={overview.seoScore} />
          <p className="mt-3 text-sm font-bold text-txt-primary">Skor SEO</p>
          <p className="text-xs text-txt-muted">dari 100</p>
        </div>

        {/* Stats */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-4">
          <h3 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
            Konten
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-txt-secondary">Artikel Dipublikasi</span>
              <span className="font-bold">{overview.publishedArticles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-txt-secondary">Total Artikel</span>
              <span className="font-bold">{overview.totalArticles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-txt-secondary">Kategori</span>
              <span className="font-bold">{overview.categories}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-txt-secondary">Tags</span>
              <span className="font-bold">{overview.tags}</span>
            </div>
          </div>
        </div>

        {/* Coverage */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-4">
          <h3 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
            Coverage
          </h3>
          <CoverageBar label="SEO Title" value={coverage.seoTitle} />
          <CoverageBar label="Gambar" value={coverage.image} />
          <CoverageBar label="Excerpt" value={coverage.excerpt} />
          <CoverageBar label="Sorotan" value={coverage.sorotan} />
        </div>

        {/* Sitemap & Links */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card space-y-4">
          <h3 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
            Sitemap & Tools
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-txt-secondary">Halaman sitemap.xml</span>
              <span className="font-bold">
                {overview.sitemapPages.toLocaleString("id-ID")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-txt-secondary">News sitemap (2 hari)</span>
              <span className="font-bold">{overview.newsSitemapCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-txt-secondary">Glossary</span>
              <span className="font-bold">{overview.glossaryCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-txt-secondary">Sorotan</span>
              <span className="font-bold">{overview.sorotanTotal}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-txt-secondary">Topik</span>
              <span className="font-bold">{overview.topicCount}</span>
            </div>
          </div>
          <div className="space-y-1.5 pt-1">
            <a
              href={urls.sitemap}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={10} /> sitemap.xml
            </a>
            <a
              href={urls.newsSitemap}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={10} /> sitemap-news.xml
            </a>
            <a
              href={urls.sitemapGlossary}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={10} /> sitemap-glossary.xml
            </a>
            <a
              href={urls.sitemapSorotan}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={10} /> sitemap-sorotan.xml
            </a>
            <a
              href={urls.robots}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={10} /> robots.txt
            </a>
            <a
              href={urls.searchConsole}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={10} /> Google Search Console
            </a>
            <a
              href={urls.publisherCenter}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={10} /> Google News Publisher
            </a>
          </div>
        </div>
      </div>

      {/* Indexing Health — Google API quota + priority allocation + last submission */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {indexing.googleIndexingEnabled ? (
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-sm font-bold text-txt-primary mb-3 border-l-[3px] border-primary pl-2.5">
              Google Indexing API — Kuota & Prioritas Harian
            </h3>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-extrabold text-txt-primary">
                {indexing.googleQuota.used}
              </span>
              <span className="text-sm text-txt-muted">
                / {indexing.googleQuota.limit} per hari
              </span>
              <span className="ml-auto text-xs font-mono text-txt-muted">
                {indexing.googleQuota.date}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  indexing.googleQuota.percentUsed >= 90
                    ? "bg-red-600"
                    : indexing.googleQuota.percentUsed >= 70
                    ? "bg-amber-500"
                    : "bg-emerald-600"
                }`}
                style={{
                  width: `${Math.min(100, indexing.googleQuota.percentUsed)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-txt-muted">
              Tersisa{" "}
              <strong className="text-txt-primary">{quotaRemaining}</strong> URL
              hari ini (batas {indexing.googleQuota.limit}/hari). Reset otomatis
              tengah malam UTC.
            </p>

            {/* Priority breakdown inside Quota Card */}
            <div className="mt-4 pt-3 border-t border-border space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-txt-primary">
                  1. Prioritas Utama — Artikel (`/berita/*`)
                </span>
                <span className="font-mono font-bold text-primary">
                  {articlePendingCount} antre · alokasi {articleAllocatedQuota} kuota
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-txt-secondary">
                  2. Prioritas Kedua — Sorotan (`/sorotan/*`)
                </span>
                <span className="font-mono text-txt-secondary">
                  {sorotanPendingCount} antre · sisa {sorotanEligibleQuota} kuota
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <h3 className="text-sm font-bold text-txt-primary mb-3 border-l-[3px] border-primary pl-2.5">
              Google Indexing API
            </h3>
            <div className="rounded-lg bg-surface-secondary p-4 text-center">
              <p className="text-2xl font-bold text-txt-muted mb-1">DISABLED</p>
              <p className="text-xs text-txt-muted">
                Site indexed via sitemap (lihat banner atas).
              </p>
              <Link
                href="/panel/pengaturan"
                className="mt-3 inline-block text-xs text-primary font-semibold hover:underline"
              >
                Re-enable di Pengaturan →
              </Link>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
          <h3 className="text-sm font-bold text-txt-primary mb-3 border-l-[3px] border-primary pl-2.5">
            Submission Terakhir
          </h3>
          {indexing.lastSubmitted ? (
            <>
              <a
                href={`${urls.sitemap.replace("/sitemap.xml", "")}/berita/${indexing.lastSubmitted.slug}`}
                target="_blank"
                rel="noopener"
                className="block text-sm font-semibold text-txt-primary hover:text-primary line-clamp-2 mb-2"
              >
                {indexing.lastSubmitted.title}
              </a>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`font-bold uppercase tracking-wide ${
                    indexing.lastSubmitted.status === "indexed"
                      ? "text-primary"
                      : indexing.lastSubmitted.status === "submitted"
                      ? "text-emerald-700"
                      : indexing.lastSubmitted.status === "failed"
                      ? "text-red-700"
                      : "text-amber-700"
                  }`}
                >
                  {indexing.lastSubmitted.status ?? "pending"}
                </span>
                <span className="text-txt-muted">
                  {indexing.lastSubmitted.at
                    ? new Date(indexing.lastSubmitted.at).toLocaleString(
                        "id-ID",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )
                    : "—"}
                </span>
              </div>
              <p className="mt-3 text-xs text-txt-muted">
                Sudah disubmit ke Google:{" "}
                <span className="font-bold text-txt-primary">
                  {overview.submittedRatio}%
                </span>{" "}
                dari {overview.publishedArticles} artikel utama terbit.
              </p>
            </>
          ) : (
            <p className="text-xs text-txt-muted">
              Belum ada submission ke Google Indexing API.
            </p>
          )}
          {indexing.sitemapLastPingedAt && (
            <p className="mt-3 pt-3 border-t border-border text-xs text-txt-muted">
              Sitemap ping terakhir:{" "}
              <span className="font-mono">
                {new Date(indexing.sitemapLastPingedAt).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* SEO Features */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card mb-6">
        <h3 className="text-sm font-bold text-txt-primary mb-4 border-l-[3px] border-primary pl-2.5">
          Fitur SEO Aktif
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { name: "JSON-LD NewsArticle" },
            { name: "OpenGraph Tags" },
            { name: "Twitter Cards" },
            { name: "Canonical URLs" },
            { name: "Google News Sitemap" },
            { name: "IndexNow Auto-Ping" },
            { name: "Prioritas Kuota Artikel → Sorotan" },
            { name: "Auto Meta Description" },
            { name: "Breadcrumb Schema" },
            { name: "Search Console Verified" },
            { name: "Publisher Center" },
            { name: "Cloudflare CDN" },
          ].map((f) => (
            <div
              key={f.name}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-xs"
            >
              <span className="text-txt-primary font-medium">{f.name}</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Aktif
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bulk Generate SEO */}
      {articleAudit.some((a) => a.issues.length > 0) && (
        <div className="rounded-xl border border-border bg-surface p-5 shadow-card mb-6">
          <h3 className="text-sm font-bold text-txt-primary mb-3 border-l-[3px] border-primary pl-2.5">
            Generate SEO Otomatis
          </h3>
          <p className="text-xs text-txt-secondary mb-4">
            Artikel yang belum memiliki SEO Title dan Meta Description bisa
            di-generate otomatis.
          </p>
          <button
            onClick={handleAIGenerate}
            disabled={generating}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {generating && <Loader2 size={14} className="animate-spin" />}
            {generating ? "AI Generating..." : "AI Generate SEO (DeepSeek)"}
          </button>
          <p className="mt-3 text-[10px] text-txt-muted">
            Generate SEO Title & Meta Description menggunakan AI DeepSeek — maks
            20 artikel per batch. Pastikan API Key sudah dikonfigurasi di
            Pengaturan.
          </p>
        </div>
      )}

      {/* Index Monitor */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
              Monitor Index & Antrean Prioritas (Batas 200/Hari)
            </h3>
            <p className="text-xs text-txt-secondary mt-1 pl-3">
              Prioritas #1: Artikel Utama (`/berita/*`) didahulukan penuh ·
              Prioritas #2: Sorotan (`/sorotan/*`) dikirim menggunakan sisa kuota
              harian
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleTestCredentials}
              disabled={testingCreds || !indexing.googleIndexingEnabled}
              className="btn-ghost flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !indexing.googleIndexingEnabled
                  ? "Google Indexing API disabled"
                  : undefined
              }
            >
              {testingCreds && <Loader2 size={12} className="animate-spin" />}
              Test Credentials
            </button>
            <button
              onClick={handleIndexRemainingSorotan}
              disabled={
                indexingSorotan ||
                reindexing ||
                !indexing.googleIndexingEnabled ||
                quotaRemaining <= 0
              }
              className="btn-ghost border border-border flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !indexing.googleIndexingEnabled
                  ? "Google Indexing API disabled"
                  : quotaRemaining <= 0
                  ? "Kuota harian 200/hari telah habis"
                  : "Kirim antrean Artikel Utama lebih dulu, lalu gunakan sisa kuota untuk Sorotan"
              }
            >
              {indexingSorotan && <Loader2 size={12} className="animate-spin" />}
              Kirim Antrean Prioritas ({quotaRemaining} Sisa Kuota)
            </button>
            <button
              onClick={handleBulkReindex}
              disabled={
                reindexing || indexingSorotan || !indexing.googleIndexingEnabled
              }
              className="btn-secondary flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !indexing.googleIndexingEnabled
                  ? "Google Indexing API disabled"
                  : undefined
              }
            >
              {reindexing && <Loader2 size={12} className="animate-spin" />}
              Re-index Semua (Prioritas Artikel)
            </button>
          </div>
        </div>

        {/* Priority Queue Status Callout */}
        <div
          className={`mb-4 rounded-lg border border-border border-l-4 ${
            canSubmitSorotanNow
              ? "border-l-emerald-600"
              : articlePendingCount > 0
              ? "border-l-primary"
              : "border-l-amber-500"
          } bg-surface px-4 py-3 text-xs`}
        >
          <p className="font-bold text-txt-primary mb-1">
            Status Prioritas Kuota Harian ({indexing.googleQuota.used}/
            {indexing.googleQuota.limit} terpakai):
          </p>
          {articlePendingCount > 0 ? (
            <p className="text-txt-secondary leading-relaxed">
              Masih ada{" "}
              <strong className="text-txt-primary">
                {articlePendingCount} Artikel Utama
              </strong>{" "}
              dalam antrean pending. Kuota harian diutamakan untuk menyelesaikan
              Artikel Utama terlebih dahulu.{" "}
              {sorotanEligibleQuota > 0
                ? `Setelah seluruh Artikel Utama terkirim, estimasi sisa ${sorotanEligibleQuota} kuota hari ini akan dialokasikan untuk Sorotan.`
                : "Sorotan akan menunggu hingga seluruh Artikel Utama selesai ter-submit."}
            </p>
          ) : quotaRemaining > 0 ? (
            <p className="text-txt-secondary leading-relaxed">
              Seluruh{" "}
              <strong className="text-emerald-700">
                Artikel Utama telah ter-submit (0 pending)
              </strong>
              . Tersisa{" "}
              <strong className="text-txt-primary">
                {quotaRemaining} kuota
              </strong>{" "}
              hari ini yang siap digunakan untuk meng-index{" "}
              <strong className="text-txt-primary">
                {sorotanPendingCount} Sorotan
              </strong>{" "}
              dalam antrean.
            </p>
          ) : (
            <p className="text-txt-secondary leading-relaxed">
              Kuota harian Google Indexing API (
              {indexing.googleQuota.limit} URL/hari) telah habis digunakan hari
              ini. Antrean berikutnya akan otomatis dilanjutkan saat kuota reset
              dengan tetap mengutamakan Artikel Utama terlebih dahulu.
            </p>
          )}
        </div>

        {!indexing.googleIndexingEnabled && (
          <div className="mb-4 rounded-lg border border-border border-l-4 border-l-primary bg-surface p-3 text-xs text-txt-secondary">
            <p className="leading-relaxed">
              <strong className="text-txt-primary">Catatan:</strong> Counter
              Pending/Submitted/Indexed/Failed di bawah hanya melacak{" "}
              <strong className="text-txt-primary">
                Google Indexing API submissions
              </strong>
              . Site sebenarnya ter-indexed Google via sitemap-news.xml +
              natural crawl (lihat banner atas). Cek status real di GSC URL
              Inspection.
            </p>
          </div>
        )}

        {credResult && (
          <div
            className={`mb-4 rounded-lg border border-border border-l-4 bg-surface p-3 text-xs ${
              credResult.ok
                ? "border-l-emerald-600 text-emerald-700"
                : "border-l-red-600 text-red-700"
            }`}
          >
            <span className="font-semibold">
              {credResult.ok ? "✓ " : "✗ "}
            </span>
            {credResult.message}
            {credResult.ok && (
              <span className="block mt-1 text-[11px] text-txt-secondary">
                Test ini hanya cek JWT auth — <strong>tidak</strong> cek apakah
                service account sudah jadi Owner di Google Search Console untuk
                domain ini.
              </span>
            )}
          </div>
        )}

        {/* Failure diagnostic banner — surfaces top error reason from Article.indexLastError */}
        {indexStatus &&
          indexStatus.counts.failed > 0 &&
          indexStatus.topErrors &&
          indexStatus.topErrors.length > 0 && (
            <div className="mb-4 rounded-lg border border-border border-l-4 border-l-amber-500 bg-surface p-3 text-xs">
              <p className="font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} /> Penyebab kegagalan submit (
                {indexStatus.counts.failed} artikel)
              </p>
              <ul className="space-y-1.5 mb-2">
                {indexStatus.topErrors.map((e, i) => (
                  <li key={i} className="text-txt-primary">
                    <span className="font-mono font-bold text-amber-800 mr-1.5">
                      {e.count}×
                    </span>
                    <span className="font-mono text-[11px]">{e.message}</span>
                  </li>
                ))}
              </ul>
              {indexStatus.topErrors.some((e) =>
                /Permission denied|verify the URL ownership|Forbidden|PERMISSION_DENIED/i.test(
                  e.message,
                ),
              ) && (
                <div className="mt-3 pt-3 border-t border-border text-txt-secondary">
                  <p className="font-bold text-txt-primary mb-1">
                    Service account belum jadi Owner di Google Search Console
                  </p>
                  <p className="leading-relaxed">
                    Buka{" "}
                    <a
                      href="https://search.google.com/search-console/users"
                      target="_blank"
                      rel="noopener"
                      className="underline font-semibold text-primary"
                    >
                      Search Console → Users and permissions
                    </a>{" "}
                    → Add user → masukkan email service account dari{" "}
                    <Link
                      href="/panel/pengaturan"
                      className="underline font-semibold text-primary"
                    >
                      Pengaturan
                    </Link>{" "}
                    (`google_credentials_json` → field `client_email`) →
                    permission <strong>Owner</strong>. Setelah itu klik{" "}
                    <strong>Re-index Semua (Prioritas Artikel)</strong> di atas.
                  </p>
                </div>
              )}
            </div>
          )}

        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Prioritas #1 — Artikel Utama (`/berita/*`)
          </p>
          <span className="text-[11px] text-txt-muted">
            Diutamakan pertama kali dari kuota 200/hari
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-lg bg-surface-secondary p-3">
            <p className="text-xs text-txt-muted mb-1">Total Artikel</p>
            <p className="text-xl font-extrabold text-txt-primary">
              {indexStatus?.total ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-border border-t-2 border-t-amber-500 bg-surface p-3">
            <p className="text-xs text-txt-muted mb-1">Pending</p>
            <p className="text-xl font-extrabold text-amber-700">
              {indexStatus?.counts.pending ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-border border-t-2 border-t-emerald-600 bg-surface p-3">
            <p className="text-xs text-txt-muted mb-1">Submitted</p>
            <p className="text-xl font-extrabold text-emerald-700">
              {indexStatus?.counts.submitted ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-border border-t-2 border-t-primary bg-surface p-3">
            <p className="text-xs text-txt-muted mb-1">Indexed</p>
            <p className="text-xl font-extrabold text-primary">
              {indexStatus?.counts.indexed ?? 0}
            </p>
          </div>
          <div className="rounded-lg border border-border border-t-2 border-t-red-600 bg-surface p-3">
            <p className="text-xs text-txt-muted mb-1">Failed</p>
            <p className="text-xl font-extrabold text-red-700">
              {indexStatus?.counts.failed ?? 0}
            </p>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-txt-muted leading-relaxed">
          <strong>Submitted</strong> = berhasil dikirim ke Google Indexing API
          (ini status sukses terminal). Kolom <strong>Indexed</strong> baru
          terisi jika status ter-index dikonfirmasi (GSC URL Inspection /
          manual) — submit ke API <em>bukan</em> jaminan sudah ter-index, jadi
          angka Indexed = 0 itu wajar.
        </p>

        {sorotanStatus && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-txt-secondary">
                Prioritas #2 — Sorotan (`/sorotan/*`)
              </p>
              <p className="text-[11px] text-txt-muted">
                Dikirim ke Google Indexing API hanya setelah seluruh Artikel
                Utama selesai ter-submit (0 pending) dan kuota harian 200/hari
                masih tersisa.
              </p>
            </div>
            {sorotanStatus.counts.failed > 0 &&
              sorotanStatus.topErrors &&
              sorotanStatus.topErrors.length > 0 && (
                <div className="mb-3 rounded-lg border border-border border-l-4 border-l-amber-500 bg-surface px-3 py-2 text-[11px]">
                  <p className="font-bold text-amber-800 mb-1 flex items-center gap-1">
                    <AlertTriangle size={10} /> Sorotan gagal:{" "}
                    {sorotanStatus.counts.failed}
                  </p>
                  {sorotanStatus.topErrors.slice(0, 2).map((e, i) => (
                    <p key={i} className="font-mono text-txt-primary truncate">
                      <span className="font-bold text-amber-800 mr-1.5">
                        {e.count}×
                      </span>
                      {e.message}
                    </p>
                  ))}
                </div>
              )}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-lg bg-surface-secondary p-3">
                <p className="text-xs text-txt-muted mb-1">Total Sorotan</p>
                <p className="text-lg font-extrabold text-txt-primary">
                  {sorotanStatus.total}
                </p>
              </div>
              <div className="rounded-lg border border-border border-t-2 border-t-amber-500 bg-surface p-3">
                <p className="text-xs text-txt-muted mb-1">Pending</p>
                <p className="text-lg font-extrabold text-amber-700">
                  {sorotanStatus.counts.pending}
                </p>
              </div>
              <div className="rounded-lg border border-border border-t-2 border-t-emerald-600 bg-surface p-3">
                <p className="text-xs text-txt-muted mb-1">Submitted</p>
                <p className="text-lg font-extrabold text-emerald-700">
                  {sorotanStatus.counts.submitted}
                </p>
              </div>
              <div className="rounded-lg border border-border border-t-2 border-t-primary bg-surface p-3">
                <p className="text-xs text-txt-muted mb-1">Indexed</p>
                <p className="text-lg font-extrabold text-primary">
                  {sorotanStatus.counts.indexed}
                </p>
              </div>
              <div className="rounded-lg border border-border border-t-2 border-t-red-600 bg-surface p-3">
                <p className="text-xs text-txt-muted mb-1">Failed</p>
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
        const perfectCount = articleAudit.filter(
          (a) => a.issues.length === 0,
        ).length;
        const issuesCount = articleAudit.filter(
          (a) => a.issues.length > 0,
        ).length;

        const filtered = articleAudit
          .filter((a) => {
            if (auditFilter === "perfect") return a.issues.length === 0;
            if (auditFilter === "issues") return a.issues.length > 0;
            return true;
          })
          .filter(
            (a) =>
              !auditSearch ||
              a.title.toLowerCase().includes(auditSearch.toLowerCase()) ||
              a.category.toLowerCase().includes(auditSearch.toLowerCase()),
          );

        const totalPages = Math.ceil(filtered.length / AUDIT_PER_PAGE);
        const paginated = filtered.slice(
          (auditPage - 1) * AUDIT_PER_PAGE,
          auditPage * AUDIT_PER_PAGE,
        );

        return (
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h3 className="text-sm font-bold text-txt-primary border-l-[3px] border-primary pl-2.5">
                  Audit SEO Artikel
                </h3>
                <span className="text-xs text-txt-muted">
                  {articleAudit.length} artikel total
                </span>
              </div>

              {/* Filter tabs */}
              <div className="flex flex-wrap items-center gap-4 border-b border-border pb-2 mb-3">
                <button
                  onClick={() => {
                    setAuditFilter("all");
                    setAuditPage(1);
                  }}
                  className={`border-b-2 pb-1 text-xs font-semibold transition-colors ${
                    auditFilter === "all"
                      ? "border-primary text-primary"
                      : "border-transparent text-txt-secondary hover:text-primary"
                  }`}
                >
                  Semua ({articleAudit.length})
                </button>
                <button
                  onClick={() => {
                    setAuditFilter("perfect");
                    setAuditPage(1);
                  }}
                  className={`border-b-2 pb-1 text-xs font-semibold transition-colors ${
                    auditFilter === "perfect"
                      ? "border-emerald-600 text-emerald-700"
                      : "border-transparent text-txt-secondary hover:text-emerald-700"
                  }`}
                >
                  Sempurna ({perfectCount})
                </button>
                <button
                  onClick={() => {
                    setAuditFilter("issues");
                    setAuditPage(1);
                  }}
                  className={`border-b-2 pb-1 text-xs font-semibold transition-colors ${
                    auditFilter === "issues"
                      ? "border-red-600 text-red-700"
                      : "border-transparent text-txt-secondary hover:text-red-700"
                  }`}
                >
                  Ada Masalah ({issuesCount})
                </button>
              </div>

              {/* Search */}
              <div className="relative max-w-xs">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted"
                />
                <input
                  type="text"
                  placeholder="Cari judul atau kategori..."
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value);
                    setAuditPage(1);
                  }}
                  className="input w-full pl-9 py-2 text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead className="bg-surface-secondary border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-txt-secondary">
                      Artikel
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-txt-secondary">
                      Skor
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-txt-secondary">
                      SEO Title
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-txt-secondary">
                      Meta Desc
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-txt-secondary">
                      Gambar
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-txt-secondary">
                      Excerpt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-txt-secondary">
                      Masalah
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((a) => (
                    <tr key={a.slug} className="hover:bg-surface-secondary">
                      <td className="px-4 py-3 max-w-[220px]">
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener"
                          className="text-sm font-medium text-txt-primary hover:text-primary truncate block"
                        >
                          {a.title}
                        </a>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-primary font-medium">
                            {a.category}
                          </span>
                          <span className="text-[10px] text-txt-muted">·</span>
                          <span className="text-[10px] text-txt-muted">
                            {a.views.toLocaleString("id-ID")} views
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-mono text-xs font-bold ${
                            a.score >= 80
                              ? "text-emerald-700"
                              : a.score >= 50
                              ? "text-amber-700"
                              : "text-red-700"
                          }`}
                        >
                          {a.score}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.seoTitle ? (
                          <CheckCircle
                            size={14}
                            className="mx-auto text-emerald-600"
                          />
                        ) : (
                          <XCircle size={14} className="mx-auto text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.seoDescription ? (
                          <CheckCircle
                            size={14}
                            className="mx-auto text-emerald-600"
                          />
                        ) : (
                          <XCircle size={14} className="mx-auto text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.hasImage ? (
                          <CheckCircle
                            size={14}
                            className="mx-auto text-emerald-600"
                          />
                        ) : (
                          <XCircle size={14} className="mx-auto text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {a.hasExcerpt ? (
                          <CheckCircle
                            size={14}
                            className="mx-auto text-emerald-600"
                          />
                        ) : (
                          <XCircle size={14} className="mx-auto text-red-500" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {a.issues.length === 0 ? (
                          <span className="text-xs text-emerald-700 font-semibold">
                            Sempurna
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            {a.issues.map((issue, i) => (
                              <span
                                key={i}
                                className="block text-xs text-amber-700"
                              >
                                • {issue}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-sm text-txt-muted"
                      >
                        Tidak ada artikel ditemukan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-txt-muted">
                  Halaman {auditPage} dari {totalPages} ({filtered.length}{" "}
                  artikel)
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={auditPage <= 1}
                    className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() =>
                      setAuditPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={auditPage >= totalPages}
                    className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
