"use client";

/**
 * Sorotan Panel — SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 *
 * Article-centric table: shows every non-archived news article with a clear
 * Sorotan status indicator (Sudah / Sebagian / Belum) so editors immediately
 * see which articles already have Sorotan and which do not yet. Expand any row
 * to inspect all 9 active angles (and open public Sorotan pages), or generate
 * Sorotan per article, for selected articles, or in batch.
 */

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  RefreshCw,
  Loader2,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Search as SearchIcon,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { EDITOR_ROLES } from "@/lib/roles";
import {
  ACTIVE_SOROTAN_ANGLES,
  SOROTAN_ANGLE_COUNT,
  SOROTAN_ANGLE_LABEL,
} from "@/lib/seo/sorotan-constants";
import { parseApiJson } from "@/lib/http-json";

interface SorotanItem {
  slug: string;
  angle: string;
  title: string;
  indexStatus?: string | null;
  createdAt?: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  status?: string;
  createdAt?: string;
  publishedAt: string | null;
  category?: { name: string; slug: string } | null;
  author?: { id: string; name: string } | null;
  sorotan: SorotanItem[];
}

interface SummaryCounts {
  totalArticles: number;
  withSorotanCount: number;
  withoutSorotanCount: number;
  totalSorotan: number;
  targetAngles: number;
}

interface TabCounts {
  all: number;
  with: number;
  without: number;
}

interface ActiveSorotanJob {
  jobId: string;
  mode: "single" | "batch" | "bulk";
  targetArticleId?: string;
  status: "running" | "done";
  totalArticles: number;
  completedArticles: number;
  currentArticleId: string | null;
  totalCreated: number;
  totalSkipped: number;
  totalErrors: number;
  errors: string[];
}

type SorotanFilter = "all" | "with" | "without";

const ACTIVE_ANGLE_SET = new Set<string>(ACTIVE_SOROTAN_ANGLES);
const PAGE_SIZE = 20;
const MAX_BULK_SELECT = 10;
const POLL_INTERVAL_MS = 2000;

const ARTICLE_STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Terbit",
  IN_REVIEW: "Review",
  APPROVED: "Disetujui",
  DRAFT: "Draf",
  REJECTED: "Ditolak",
};

const ARTICLE_STATUS_CLASS: Record<string, string> = {
  PUBLISHED: "text-primary font-semibold",
  IN_REVIEW: "text-amber-700 font-semibold",
  APPROVED: "text-blue-700 font-semibold",
  DRAFT: "text-txt-secondary font-medium",
  REJECTED: "text-red-700 font-semibold",
};

const INDEX_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  indexed: { label: "Terindeks", cls: "text-emerald-700" },
  submitted: { label: "Diajukan", cls: "text-blue-700" },
  pending: { label: "Menunggu", cls: "text-txt-muted" },
  failed: { label: "Gagal", cls: "text-red-700" },
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getSorotanProgress(sorotan: SorotanItem[]) {
  const activeMap = new Map<string, SorotanItem>();
  const legacyItems: SorotanItem[] = [];

  for (const item of sorotan) {
    if (ACTIVE_ANGLE_SET.has(item.angle)) {
      activeMap.set(item.angle, item);
    } else {
      legacyItems.push(item);
    }
  }

  const activeCount = activeMap.size;
  const legacyCount = legacyItems.length;
  const hasAny = sorotan.length > 0;
  const isComplete = activeCount >= SOROTAN_ANGLE_COUNT;
  const pct = Math.min(100, Math.round((activeCount / SOROTAN_ANGLE_COUNT) * 100));

  return {
    activeMap,
    legacyItems,
    activeCount,
    legacyCount,
    hasAny,
    isComplete,
    pct,
  };
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-9 w-48 rounded-lg bg-surface-tertiary" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-tertiary" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-surface-tertiary" />
    </div>
  );
}

function SorotanPageContent() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success: showSuccess, error: showError } = useToast();

  const initialFilterParam = (searchParams.get("filter") || "").toLowerCase();
  const initialFilter: SorotanFilter =
    initialFilterParam === "with" || initialFilterParam === "without"
      ? initialFilterParam
      : "all";
  const indexStatusParam = (searchParams.get("indexStatus") || "").toLowerCase();
  const activeIndexStatus = ["failed", "pending", "submitted", "indexed"].includes(
    indexStatusParam,
  )
    ? indexStatusParam
    : "";

  const [articles, setArticles] = useState<Article[]>([]);
  const [summary, setSummary] = useState<SummaryCounts>({
    totalArticles: 0,
    withSorotanCount: 0,
    withoutSorotanCount: 0,
    totalSorotan: 0,
    targetAngles: SOROTAN_ANGLE_COUNT,
  });
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    all: 0,
    with: 0,
    without: 0,
  });
  const [paginationTotal, setPaginationTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sorotanFilter, setSorotanFilter] = useState<SorotanFilter>(initialFilter);
  const [articleStatus, setArticleStatus] = useState("ALL");
  const [scope, setScope] = useState<"all" | "me">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [batchGenerating, setBatchGenerating] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [singleProcessing, setSingleProcessing] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveSorotanJob | null>(null);
  const [inFlightIds, setInFlightIds] = useState<Set<string>>(new Set());

  // Auto-generation settings (sorotan_*) — SUPER_ADMIN only
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [intervalMin, setIntervalMin] = useState(60);
  const [batchSize, setBatchSize] = useState(5);
  const [savingToggle, setSavingToggle] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const isAdmin = userRole === "SUPER_ADMIN";
  const isAnyGenerating =
    batchGenerating ||
    bulkGenerating ||
    singleProcessing !== null ||
    activeJob?.status === "running";

  const isAuthorized = EDITOR_ROLES.includes(userRole);

  useEffect(() => {
    if (sessionStatus !== "loading" && session && !isAuthorized) {
      router.replace("/panel/dashboard");
    }
  }, [sessionStatus, session, isAuthorized, router]);

  const fetchData = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent);
      try {
        if (!silent) {
          setLoading(true);
          setFetchError(null);
        }
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          scope,
          filter: sorotanFilter,
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (articleStatus !== "ALL") params.set("articleStatus", articleStatus);
        if (activeIndexStatus) params.set("indexStatus", activeIndexStatus);

        const res = await fetch(`/api/seo/sorotan-by-article?${params}`);
        const json = await parseApiJson<{
          articles?: Article[];
          summary?: SummaryCounts;
          tabCounts?: TabCounts;
          inFlightArticleIds?: string[];
          pagination?: { total?: number; totalPages?: number };
        }>(res);
        if (!res.ok || !json?.success) {
          throw new Error(
            json?.error || `Gagal memuat data Sorotan (HTTP ${res.status})`,
          );
        }

        const data = json.data || {};
        setArticles(data.articles || []);
        if (data.summary) {
          setSummary(data.summary);
        }
        if (data.tabCounts) {
          setTabCounts(data.tabCounts);
        }
        if (Array.isArray(data.inFlightArticleIds)) {
          setInFlightIds(new Set(data.inFlightArticleIds));
        }
        setPaginationTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
        if (!silent) {
          setSelectedIds(new Set());
        }
      } catch (err) {
        if (!silent) {
          setFetchError(
            err instanceof Error ? err.message : "Gagal memuat data Sorotan.",
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [
      page,
      scope,
      sorotanFilter,
      debouncedSearch,
      articleStatus,
      activeIndexStatus,
    ],
  );

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  const sorotanFilterRef = useRef(sorotanFilter);
  sorotanFilterRef.current = sorotanFilter;

  const fetchAutoSettings = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const json = await parseApiJson<Record<string, unknown>>(res);
      const data = json?.data || {};
      setAutoEnabled(String(data.sorotan_auto_enabled ?? "false") === "true");
      const iv = Number(data.sorotan_interval_minutes ?? "60");
      setIntervalMin([5, 10, 15, 20, 30, 60].includes(iv) ? iv : 60);
      const bs = Math.floor(Number(data.sorotan_batch_size ?? "5"));
      setBatchSize(Number.isFinite(bs) ? Math.min(20, Math.max(0, bs)) : 5);
    } catch {
      /* non-critical */
    }
  }, [isAdmin]);

  useEffect(() => {
    if (sessionStatus !== "loading" && isAuthorized) {
      fetchData();
    }
  }, [sessionStatus, isAuthorized, fetchData]);

  useEffect(() => {
    if (sessionStatus !== "loading" && isAuthorized) {
      fetchAutoSettings();
    }
  }, [sessionStatus, isAuthorized, fetchAutoSettings]);

  // Poll background Sorotan generation job until completion.
  useEffect(() => {
    if (!activeJob || activeJob.status !== "running") return;

    let cancelled = false;
    let consecutiveFailures = 0;
    let lastCompleted = activeJob.completedArticles;
    let tickCount = 0;

    const timer = setInterval(async () => {
      if (cancelled) return;
      tickCount += 1;

      try {
        const res = await fetch(
          `/api/seo/sorotan-job?jobId=${encodeURIComponent(activeJob.jobId)}`,
        );
        const json = await parseApiJson<{
          found?: boolean;
          inFlightArticleIds?: string[];
          job?: {
            jobId: string;
            status: "running" | "done";
            totalArticles: number;
            completedArticles: number;
            currentArticleId: string | null;
            totalCreated: number;
            totalSkipped: number;
            totalErrors: number;
            errors: string[];
          } | null;
        }>(res);

        if (cancelled) return;

        if (!res.ok || !json?.success) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= 4) {
            setActiveJob(null);
            setBatchGenerating(false);
            setBulkGenerating(false);
            setSingleProcessing(null);
            showError(
              json?.error ||
                `Gagal memantau proses Sorotan (HTTP ${res.status}). Silakan klik Refresh.`,
            );
            void fetchDataRef.current({ silent: true });
          }
          return;
        }

        consecutiveFailures = 0;
        const payload = json.data;

        if (Array.isArray(payload?.inFlightArticleIds)) {
          setInFlightIds(new Set(payload.inFlightArticleIds));
        }

        if (!payload?.found || !payload.job) {
          setActiveJob(null);
          setBatchGenerating(false);
          setBulkGenerating(false);
          setSingleProcessing(null);
          showError(
            "Proses di latar belakang terputus atau server restart. Daftar diperbarui dari database.",
          );
          void fetchDataRef.current({ silent: true });
          return;
        }

        const j = payload.job;

        if (j.status === "running") {
          setActiveJob((prev) =>
            prev && prev.jobId === j.jobId
              ? {
                  ...prev,
                  status: "running",
                  totalArticles: j.totalArticles,
                  completedArticles: j.completedArticles,
                  currentArticleId: j.currentArticleId,
                  totalCreated: j.totalCreated,
                  totalSkipped: j.totalSkipped,
                  totalErrors: j.totalErrors,
                  errors: j.errors || [],
                }
              : prev,
          );
          if (j.completedArticles > lastCompleted || tickCount % 3 === 0) {
            lastCompleted = j.completedArticles;
            void fetchDataRef.current({ silent: true });
          }
          return;
        }

        // Job completed
        setActiveJob(null);
        setBatchGenerating(false);
        setBulkGenerating(false);
        setSingleProcessing(null);
        setSelectedIds(new Set());

        const currentFilter = sorotanFilterRef.current;
        if (
          activeJob.mode === "single" &&
          activeJob.targetArticleId &&
          currentFilter !== "without" &&
          (j.totalCreated > 0 || j.totalSkipped > 0)
        ) {
          setExpandedId(activeJob.targetArticleId);
        }

        if (j.totalCreated === 0 && j.totalErrors > 0) {
          showError(
            `Gagal membuat Sorotan: ${j.errors[0] || "Periksa konfigurasi AI di Pengaturan."}`,
          );
        } else if (j.totalErrors > 0) {
          showError(
            `Selesai dengan catatan: ${j.totalCreated} sudut dibuat, ${j.totalErrors} gagal (${j.errors[0] || "error"}).`,
          );
        } else if (j.totalCreated === 0 && j.totalSkipped > 0) {
          showSuccess("Semua sudut pandang Sorotan sudah lengkap sebelumnya.");
        } else if (activeJob.mode === "single") {
          const movedNote =
            currentFilter === "without"
              ? " Berita dipindahkan ke tab Sudah Ada Sorotan."
              : "";
          showSuccess(
            `${j.totalCreated} sudut pandang Sorotan berhasil dibuat.${movedNote}`,
          );
        } else {
          showSuccess(
            `Selesai memproses ${j.totalArticles} berita — ${j.totalCreated} sudut Sorotan dibuat.`,
          );
        }

        void fetchDataRef.current({ silent: true });
      } catch {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 4 && !cancelled) {
          setActiveJob(null);
          setBatchGenerating(false);
          setBulkGenerating(false);
          setSingleProcessing(null);
          showError(
            "Koneksi terputus saat memantau pembuatan Sorotan. Klik Refresh untuk melihat hasil.",
          );
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeJob, showError, showSuccess]);

  // Debounce search input -> reset to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
      setExpandedId(null);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function saveSetting(key: string, value: string) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const json = await parseApiJson(res);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || `Gagal menyimpan (HTTP ${res.status})`);
    }
  }

  async function handleToggleAuto() {
    try {
      setSavingToggle(true);
      const newValue = !autoEnabled;
      await saveSetting("sorotan_auto_enabled", newValue ? "true" : "false");
      setAutoEnabled(newValue);
      showSuccess(
        newValue
          ? "Auto-generate Sorotan aktif. Cron akan jalan sesuai interval."
          : "Auto-generate dinonaktifkan.",
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSavingToggle(false);
    }
  }

  async function handleSaveInterval(value: number) {
    try {
      setSavingInterval(true);
      await saveSetting("sorotan_interval_minutes", String(value));
      setIntervalMin(value);
      showSuccess(`Interval Sorotan di-set ke ${value} menit.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSavingInterval(false);
    }
  }

  async function handleSaveBatch(value: number) {
    const clamped = Math.min(20, Math.max(0, Math.floor(value)));
    try {
      setSavingBatch(true);
      await saveSetting("sorotan_batch_size", String(clamped));
      setBatchSize(clamped);
      showSuccess(
        clamped === 0
          ? "Batch di-set 0 — generation pause."
          : `Batch Sorotan di-set ${clamped} artikel/run.`,
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSavingBatch(false);
    }
  }

  async function handleBatchGenerate() {
    let startedAsync = false;
    try {
      setBatchGenerating(true);
      const res = await fetch("/api/seo/generate-sorotan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });
      const json = await parseApiJson<{
        async?: boolean;
        jobId?: string;
        targets?: number;
        articleIds?: string[];
        totalCreated?: number;
        totalErrors?: number;
      }>(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `Gagal batch generate (HTTP ${res.status})`);
      }

      if (json.data?.async && json.data.jobId) {
        startedAsync = true;
        const ids = json.data.articleIds ?? [];
        setInFlightIds((prev) => new Set([...prev, ...ids]));
        setActiveJob({
          jobId: json.data.jobId,
          mode: "batch",
          status: "running",
          totalArticles: json.data.targets ?? ids.length,
          completedArticles: 0,
          currentArticleId: ids[0] ?? null,
          totalCreated: 0,
          totalSkipped: 0,
          totalErrors: 0,
          errors: [],
        });
        return;
      }

      if ((json.data?.targets ?? 0) === 0) {
        showSuccess("Semua artikel sudah memiliki Sorotan lengkap.");
      } else {
        showSuccess(
          `Diproses ${json.data?.targets ?? 0} artikel — ${json.data?.totalCreated ?? 0} sorotan dibuat, ${json.data?.totalErrors ?? 0} error.`,
        );
      }
      void fetchData({ silent: true });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal batch generate");
    } finally {
      if (!startedAsync) {
        setBatchGenerating(false);
      }
    }
  }

  async function handleBulkSelectedGenerate() {
    if (selectedIds.size === 0) return;
    let startedAsync = false;
    try {
      setBulkGenerating(true);
      const articleIds = Array.from(selectedIds).slice(0, MAX_BULK_SELECT);
      const res = await fetch("/api/seo/generate-sorotan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds }),
      });
      const json = await parseApiJson<{
        async?: boolean;
        jobId?: string;
        targets?: number;
        articleIds?: string[];
        totalCreated?: number;
        totalErrors?: number;
      }>(res);
      if (!res.ok || !json?.success) {
        throw new Error(
          json?.error || `Gagal generate artikel terpilih (HTTP ${res.status})`,
        );
      }

      if (json.data?.async && json.data.jobId) {
        startedAsync = true;
        const ids = json.data.articleIds ?? articleIds;
        setInFlightIds((prev) => new Set([...prev, ...ids]));
        setActiveJob({
          jobId: json.data.jobId,
          mode: "bulk",
          status: "running",
          totalArticles: json.data.targets ?? ids.length,
          completedArticles: 0,
          currentArticleId: ids[0] ?? null,
          totalCreated: 0,
          totalSkipped: 0,
          totalErrors: 0,
          errors: [],
        });
        return;
      }

      showSuccess(
        `Diproses ${json.data?.targets ?? articleIds.length} artikel terpilih — ${json.data?.totalCreated ?? 0} sorotan dibuat, ${json.data?.totalErrors ?? 0} error.`,
      );
      setSelectedIds(new Set());
      void fetchData({ silent: true });
    } catch (err) {
      showError(
        err instanceof Error
          ? err.message
          : "Gagal generate artikel terpilih",
      );
    } finally {
      if (!startedAsync) {
        setBulkGenerating(false);
      }
    }
  }

  async function handleSingle(articleId: string) {
    let startedAsync = false;
    try {
      setSingleProcessing(articleId);
      const res = await fetch("/api/seo/generate-sorotan-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      const json = await parseApiJson<{
        async?: boolean;
        jobId?: string;
        articleIds?: string[];
        created?: number;
        skipped?: number;
        errors?: string[];
      }>(res);
      if (!res.ok || !json?.success) {
        throw new Error(
          json?.error || `Gagal memulai generate (HTTP ${res.status})`,
        );
      }

      if (json.data?.async && json.data.jobId) {
        startedAsync = true;
        const ids = json.data.articleIds ?? [articleId];
        setInFlightIds((prev) => new Set([...prev, ...ids]));
        setActiveJob({
          jobId: json.data.jobId,
          mode: "single",
          targetArticleId: articleId,
          status: "running",
          totalArticles: ids.length,
          completedArticles: 0,
          currentArticleId: articleId,
          totalCreated: 0,
          totalSkipped: 0,
          totalErrors: 0,
          errors: [],
        });
        return;
      }

      showSuccess(
        `${json.data?.created ?? 0} angle dibuat, ${json.data?.skipped ?? 0} di-skip, ${(json.data?.errors || []).length} error.`,
      );
      setExpandedId(articleId);
      void fetchData({ silent: true });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal generate");
    } finally {
      if (!startedAsync) {
        setSingleProcessing(null);
      }
    }
  }

  const incompletePageIds = articles
    .filter((a) => !getSorotanProgress(a.sorotan).isComplete)
    .map((a) => a.id);

  const allIncompleteSelected =
    incompletePageIds.length > 0 &&
    incompletePageIds
      .slice(0, MAX_BULK_SELECT)
      .every((id) => selectedIds.has(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_BULK_SELECT) {
          showError(`Maksimal ${MAX_BULK_SELECT} berita dipilih per proses.`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllIncomplete() {
    if (allIncompleteSelected) {
      setSelectedIds(new Set());
      return;
    }
    const capped = incompletePageIds.slice(0, MAX_BULK_SELECT);
    if (incompletePageIds.length > MAX_BULK_SELECT) {
      showSuccess(
        `Dipilih ${MAX_BULK_SELECT} berita pertama yang belum lengkap (batas per proses).`,
      );
    }
    setSelectedIds(new Set(capped));
  }

  if (sessionStatus === "loading") {
    return <PageSkeleton />;
  }

  const coveragePct =
    summary.totalArticles > 0
      ? Math.round((summary.withSorotanCount / summary.totalArticles) * 100)
      : 0;

  const startRow = paginationTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(paginationTotal, page * PAGE_SIZE);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl sm:text-3xl font-bold text-txt-primary border-l-4 border-primary pl-3">
            Sorotan
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-txt-secondary">
            Pantau status pembuatan halaman Sorotan SEO ({SOROTAN_ANGLE_COUNT}{" "}
            sudut pandang per artikel). Lihat mana berita yang sudah dibuatkan
            Sorotan dan mana yang belum, lalu buat langsung dari tabel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/sorotan"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm"
            title="Buka halaman publik Sorotan di tab baru"
          >
            <ExternalLink size={14} /> Halaman Publik
          </a>
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
            Refresh
          </button>
          <button
            type="button"
            onClick={handleBatchGenerate}
            disabled={isAnyGenerating}
            className="btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {batchGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            Generate Batch (5)
          </button>
        </div>
      </div>

      {/* Scope Tabs: Semua Artikel vs Artikel Saya */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {(
          [
            { key: "all", label: "Semua Artikel" },
            { key: "me", label: "Artikel Saya" },
          ] as const
        ).map((t) => (
          <button
            type="button"
            key={t.key}
            onClick={() => {
              setScope(t.key);
              setPage(1);
              setExpandedId(null);
              setSelectedIds(new Set());
            }}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              scope === t.key
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-txt-secondary hover:text-txt-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Summary KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-border border-t-2 border-t-primary bg-surface p-4 shadow-card">
          <p className="text-xs font-medium text-txt-secondary">Total Berita</p>
          <p className="mt-1.5 text-2xl font-extrabold text-txt-primary tabular-nums">
            {summary.totalArticles.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-txt-muted">
            Artikel aktif (non-arsip)
          </p>
        </div>

        <div className="rounded-xl border border-border border-t-2 border-t-emerald-600 bg-surface p-4 shadow-card">
          <p className="text-xs font-medium text-txt-secondary">
            Sudah Ada Sorotan
          </p>
          <p className="mt-1.5 text-2xl font-extrabold text-emerald-700 tabular-nums">
            {summary.withSorotanCount.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-txt-muted tabular-nums">
            {coveragePct}% cakupan berita
          </p>
        </div>

        <div className="rounded-xl border border-border border-t-2 border-t-red-600 bg-surface p-4 shadow-card">
          <p className="text-xs font-medium text-txt-secondary">
            Belum Ada Sorotan
          </p>
          <p className="mt-1.5 text-2xl font-extrabold text-red-700 tabular-nums">
            {summary.withoutSorotanCount.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-txt-muted">
            {summary.withoutSorotanCount === 0
              ? "Semua berita sudah ter-cover"
              : "Siap dibuatkan Sorotan"}
          </p>
        </div>

        <div className="rounded-xl border border-border border-t-2 border-t-stone-400 bg-surface p-4 shadow-card">
          <p className="text-xs font-medium text-txt-secondary">
            Total Halaman Sorotan
          </p>
          <p className="mt-1.5 text-2xl font-extrabold text-primary tabular-nums">
            {summary.totalSorotan.toLocaleString("id-ID")}
          </p>
          <p className="mt-0.5 text-[11px] text-txt-muted">
            Target {SOROTAN_ANGLE_COUNT} sudut / berita
          </p>
        </div>
      </div>

      {/* Auto-generation panel — SUPER_ADMIN only */}
      {isAdmin && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div className="border-l-4 border-primary pl-3">
              <h2 className="text-base font-bold text-txt-primary">
                Auto Generate Sorotan
              </h2>
              <p className="text-xs text-txt-secondary">
                {autoEnabled
                  ? batchSize === 0
                    ? `Aktif tapi batch = 0 (pause). Cron tetap dipanggil tiap ${intervalMin} menit.`
                    : `Cron akan generate ${batchSize} artikel setiap ${intervalMin} menit.`
                  : "Nonaktif — Sorotan hanya dibuat manual atau saat publikasi."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleAuto}
              disabled={savingToggle}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                autoEnabled ? "bg-primary" : "bg-surface-tertiary"
              }`}
              aria-label="Toggle auto-sorotan"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  autoEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-txt-secondary">
                Interval Generate
              </label>
              <select
                value={intervalMin}
                onChange={(e) => handleSaveInterval(Number(e.target.value))}
                disabled={savingInterval}
                className="input w-full px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value={5}>Setiap 5 menit</option>
                <option value={10}>Setiap 10 menit</option>
                <option value={15}>Setiap 15 menit</option>
                <option value={20}>Setiap 20 menit</option>
                <option value={30}>Setiap 30 menit</option>
                <option value={60}>Setiap 1 jam</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-txt-secondary">
                Jumlah Artikel per Run
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={20}
                  step={1}
                  value={batchSize}
                  onChange={(e) =>
                    setBatchSize(
                      Math.min(
                        20,
                        Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      ),
                    )
                  }
                  onBlur={(e) =>
                    handleSaveBatch(Math.floor(Number(e.target.value) || 0))
                  }
                  disabled={savingBatch}
                  className="input w-24 px-3 py-2 text-sm disabled:opacity-50"
                />
                <span className="text-xs text-txt-secondary">
                  artikel (0–20)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optional indexStatus query filter banner (e.g., from dashboard widget) */}
      {activeIndexStatus && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border border-l-4 border-l-amber-500 bg-surface px-4 py-3 text-sm">
          <p className="text-txt-primary">
            Filter aktif: menampilkan berita yang memiliki Sorotan berstatus
            index{" "}
            <strong className="uppercase">{activeIndexStatus}</strong>.
          </p>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              router.replace("/panel/sorotan");
            }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Tampilkan Semua
          </button>
        </div>
      )}

      {/* Background generation live progress banner */}
      {activeJob?.status === "running" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border border-l-4 border-l-primary bg-surface px-4 py-3 text-sm shadow-card">
          <div className="flex items-center gap-2.5 text-txt-primary">
            <Loader2 size={15} className="animate-spin text-primary shrink-0" />
            <span>
              Sedang membuat Sorotan di latar belakang —{" "}
              <strong className="tabular-nums">
                {activeJob.completedArticles}/{activeJob.totalArticles}
              </strong>{" "}
              berita diproses ·{" "}
              <strong className="tabular-nums text-emerald-700">
                {activeJob.totalCreated}
              </strong>{" "}
              sudut dibuat
              {activeJob.totalErrors > 0 && (
                <span className="ml-1 font-semibold text-red-700">
                  · {activeJob.totalErrors} error
                </span>
              )}
            </span>
          </div>
          <span className="text-xs text-txt-muted">
            Proses berjalan otomatis di server, halaman tidak perlu ditahan terbuka.
          </span>
        </div>
      )}

      {/* Error banner */}
      {fetchError && (
        <div className="mb-4 rounded-xl border border-border border-l-4 border-l-red-600 bg-surface p-4 text-sm text-red-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>{fetchError}</p>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {/* Filter tabs + search bar */}
        <div className="space-y-3 border-b border-border px-4 py-4 sm:px-5">
          {/* Status Sorotan Filter Tabs */}
          <div className="flex flex-wrap items-center gap-5 border-b border-border">
            {(
              [
                {
                  key: "all",
                  label: "Semua Berita",
                  count: tabCounts.all,
                  activeCls: "border-primary text-primary",
                },
                {
                  key: "with",
                  label: "Sudah Ada Sorotan",
                  count: tabCounts.with,
                  activeCls: "border-emerald-600 text-emerald-700",
                },
                {
                  key: "without",
                  label: "Belum Ada Sorotan",
                  count: tabCounts.without,
                  activeCls: "border-red-600 text-red-700",
                },
              ] as const
            ).map((tab) => {
              const active = sorotanFilter === tab.key;
              return (
                <button
                  type="button"
                  key={tab.key}
                  onClick={() => {
                    setSorotanFilter(tab.key);
                    setPage(1);
                    setExpandedId(null);
                  }}
                  className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 text-xs sm:text-sm font-semibold transition-colors ${
                    active
                      ? tab.activeCls
                      : "border-transparent text-txt-secondary hover:text-txt-primary"
                  }`}
                >
                  {tab.label}{" "}
                  <span className="ml-1 font-normal tabular-nums opacity-80">
                    ({tab.count.toLocaleString("id-ID")})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Article Status Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <SearchIcon
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari judul atau slug berita..."
                  className="input w-full py-2 pl-9 pr-8 text-sm"
                  aria-label="Cari artikel"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary"
                    aria-label="Hapus pencarian"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                value={articleStatus}
                onChange={(e) => {
                  setArticleStatus(e.target.value);
                  setPage(1);
                  setExpandedId(null);
                }}
                className="input w-auto py-2 text-sm"
                aria-label="Filter status berita"
              >
                <option value="ALL">Semua Status Berita</option>
                <option value="PUBLISHED">Terbit</option>
                <option value="IN_REVIEW">Review</option>
                <option value="APPROVED">Disetujui</option>
                <option value="DRAFT">Draf</option>
                <option value="REJECTED">Ditolak</option>
              </select>
            </div>

            <p className="text-xs text-txt-muted tabular-nums">
              {paginationTotal > 0
                ? `Menampilkan ${startRow}–${endRow} dari ${paginationTotal.toLocaleString("id-ID")} berita`
                : "0 berita"}
            </p>
          </div>

          {/* Bulk action bar when rows are selected */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-txt-primary">
                <span className="font-bold text-primary">
                  {selectedIds.size}
                </span>{" "}
                berita dipilih (maks. {MAX_BULK_SELECT} per proses)
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkGenerating}
                  className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBulkSelectedGenerate}
                  disabled={isAnyGenerating}
                  className="btn-primary inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {bulkGenerating ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  Generate Terpilih ({selectedIds.size})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
            <p className="mt-2 text-xs text-txt-muted">
              Memuat daftar berita dan status Sorotan...
            </p>
          </div>
        ) : articles.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-txt-primary">
              {sorotanFilter === "without"
                ? "Tidak ada berita yang belum memiliki Sorotan."
                : sorotanFilter === "with"
                  ? "Belum ada berita yang memiliki Sorotan."
                  : "Tidak ada berita ditemukan."}
            </p>
            <p className="mt-1 text-xs text-txt-muted">
              {debouncedSearch || articleStatus !== "ALL" || activeIndexStatus
                ? "Coba ubah kata kunci pencarian atau reset filter."
                : sorotanFilter === "with"
                  ? "Pilih tab “Belum Ada Sorotan” atau klik “Generate Batch” untuk membuat."
                  : "Semua berita sudah terdata."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="w-10 px-3 py-3 text-center">
                    {incompletePageIds.length > 0 ? (
                      <input
                        type="checkbox"
                        checked={allIncompleteSelected}
                        onChange={toggleSelectAllIncomplete}
                        className="h-4 w-4 rounded border-border text-primary accent-primary"
                        aria-label="Pilih semua berita yang belum lengkap Sorotan-nya di halaman ini"
                        title="Pilih berita yang belum lengkap di halaman ini"
                      />
                    ) : (
                      <span className="sr-only">Pilih</span>
                    )}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-txt-secondary">
                    Berita
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-txt-secondary">
                    Kategori
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-txt-secondary">
                    Status Berita
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-txt-secondary">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-txt-secondary">
                    Status Sorotan
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-txt-secondary">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {articles.map((a) => {
                  const expanded = expandedId === a.id;
                  const progress = getSorotanProgress(a.sorotan);
                  const isSelected = selectedIds.has(a.id);
                  const isRowProcessing =
                    singleProcessing === a.id ||
                    activeJob?.currentArticleId === a.id ||
                    inFlightIds.has(a.id);

                  return (
                    <FragmentRow
                      key={a.id}
                      article={a}
                      expanded={expanded}
                      isSelected={isSelected}
                      progress={progress}
                      isSingleProcessing={isRowProcessing}
                      isAnyGenerating={isAnyGenerating}
                      onToggleExpand={() =>
                        setExpandedId(expanded ? null : a.id)
                      }
                      onToggleSelect={() => toggleSelect(a.id)}
                      onGenerate={() => handleSingle(a.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
            <p className="text-xs text-txt-muted tabular-nums">
              Halaman {page} dari {totalPages} (
              {paginationTotal.toLocaleString("id-ID")} berita)
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  setExpandedId(null);
                }}
                disabled={page === 1}
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs disabled:opacity-30"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  setPage((p) => Math.min(totalPages, p + 1));
                  setExpandedId(null);
                }}
                disabled={page >= totalPages}
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FragmentRow({
  article: a,
  expanded,
  isSelected,
  progress,
  isSingleProcessing,
  isAnyGenerating,
  onToggleExpand,
  onToggleSelect,
  onGenerate,
}: {
  article: Article;
  expanded: boolean;
  isSelected: boolean;
  progress: ReturnType<typeof getSorotanProgress>;
  isSingleProcessing: boolean;
  isAnyGenerating: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onGenerate: () => void;
}) {
  const missingCount = Math.max(0, SOROTAN_ANGLE_COUNT - progress.activeCount);

  return (
    <>
      <tr
        className={`transition-colors hover:bg-surface-secondary/70 ${
          isSelected ? "bg-primary-50/60" : ""
        }`}
      >
        {/* Checkbox */}
        <td className="w-10 px-3 py-3.5 text-center align-top">
          {!progress.isComplete ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              disabled={isAnyGenerating}
              className="mt-1 h-4 w-4 rounded border-border text-primary accent-primary disabled:opacity-50"
              aria-label={`Pilih berita ${a.title}`}
            />
          ) : (
            <span
              className="mt-1 inline-block text-xs font-bold text-emerald-700"
              title="Semua 9 sudut pandang Sorotan sudah dibuat"
              aria-label="Lengkap"
            >
              ✓
            </span>
          )}
        </td>

        {/* Judul Berita + meta */}
        <td className="max-w-[360px] px-4 py-3.5 align-top">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={onToggleExpand}
              className="mt-0.5 shrink-0 text-txt-muted hover:text-primary"
              aria-expanded={expanded}
              aria-label={`Lihat rincian sudut pandang Sorotan untuk ${a.title}`}
            >
              {expanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={onToggleExpand}
                className="line-clamp-2 text-left font-medium leading-snug text-txt-primary hover:text-primary"
              >
                {a.title}
              </button>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-txt-muted">
                <span className="truncate max-w-[200px]">/{a.slug}</span>
                {a.author?.name && (
                  <>
                    <span>·</span>
                    <span>{a.author.name}</span>
                  </>
                )}
                <span>·</span>
                <Link
                  href={`/panel/artikel/${a.id}/edit`}
                  className="font-medium text-primary hover:underline"
                >
                  Edit
                </Link>
                {a.status === "PUBLISHED" && (
                  <>
                    <span>·</span>
                    <a
                      href={`/berita/${a.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 font-medium text-txt-secondary hover:text-primary"
                    >
                      Berita <ExternalLink size={10} />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Kategori */}
        <td className="whitespace-nowrap px-4 py-3.5 align-top text-xs text-txt-secondary">
          {a.category?.name || "—"}
        </td>

        {/* Status Berita */}
        <td className="whitespace-nowrap px-4 py-3.5 align-top text-xs">
          <span
            className={
              (a.status && ARTICLE_STATUS_CLASS[a.status]) ||
              "text-txt-secondary"
            }
          >
            {(a.status && ARTICLE_STATUS_LABEL[a.status]) || a.status || "—"}
          </span>
        </td>

        {/* Tanggal */}
        <td className="whitespace-nowrap px-4 py-3.5 align-top text-xs text-txt-secondary tabular-nums">
          {formatDate(a.publishedAt || a.createdAt || null)}
        </td>

        {/* Status Sorotan */}
        <td className="whitespace-nowrap px-4 py-3.5 align-top">
          {!progress.hasAny ? (
            <div>
              <div className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                  Belum Dibuat
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-surface-tertiary" />
              <p className="mt-1 text-[11px] text-txt-muted tabular-nums">
                0 / {SOROTAN_ANGLE_COUNT} sudut pandang
              </p>
            </div>
          ) : progress.isComplete ? (
            <div>
              <div className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Sudah Dibuat
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-surface-tertiary">
                <div className="h-full w-full rounded-full bg-emerald-600" />
              </div>
              <p className="mt-1 text-[11px] text-txt-muted tabular-nums">
                {progress.activeCount} / {SOROTAN_ANGLE_COUNT} sudut
                {progress.legacyCount > 0 ? ` (+${progress.legacyCount} FAQ)` : ""}
              </p>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Sebagian
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-surface-tertiary">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-txt-muted tabular-nums">
                {progress.activeCount} / {SOROTAN_ANGLE_COUNT} sudut
                {progress.legacyCount > 0 ? ` (+${progress.legacyCount} FAQ)` : ""}
              </p>
            </div>
          )}
        </td>

        {/* Aksi */}
        <td className="whitespace-nowrap px-4 py-3.5 text-right align-top">
          <div className="inline-flex items-center justify-end gap-1.5">
            {!progress.isComplete && (
              <button
                type="button"
                onClick={onGenerate}
                disabled={isAnyGenerating || isSingleProcessing}
                className="btn-secondary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                title={
                  progress.hasAny
                    ? `Generate ${missingCount} sudut pandang yang belum ada`
                    : "Buat 9 sudut pandang Sorotan untuk berita ini"
                }
              >
                {isSingleProcessing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {isSingleProcessing
                  ? "Memproses..."
                  : progress.hasAny
                    ? "Lengkapi"
                    : "Buat Sorotan"}
              </button>
            )}
            {progress.hasAny && (
              <button
                type="button"
                onClick={onToggleExpand}
                className="btn-ghost rounded-md px-2.5 py-1.5 text-xs font-semibold"
              >
                {expanded ? "Tutup" : `Lihat (${a.sorotan.length})`}
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Angle Breakdown Row */}
      {expanded && (
        <tr className="bg-surface-container-low/60">
          <td colSpan={7} className="border-t border-border px-5 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-txt-secondary">
                Rincian Sudut Pandang ({progress.activeCount}/
                {SOROTAN_ANGLE_COUNT}
                {progress.legacyCount > 0
                  ? ` + ${progress.legacyCount} FAQ`
                  : ""}
                )
              </p>
              {!progress.isComplete && (
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={isAnyGenerating || isSingleProcessing}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {isSingleProcessing ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  {isSingleProcessing
                    ? "Sedang memproses..."
                    : progress.hasAny
                      ? `Generate ${missingCount} sudut yang belum ada`
                      : `Buat semua ${SOROTAN_ANGLE_COUNT} sudut pandang`}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {ACTIVE_SOROTAN_ANGLES.map((angle) => {
                const item = progress.activeMap.get(angle);
                const label = SOROTAN_ANGLE_LABEL[angle] ?? angle;
                if (item) {
                  const idxMeta = item.indexStatus
                    ? INDEX_STATUS_LABEL[item.indexStatus.toLowerCase()]
                    : null;
                  return (
                    <a
                      key={angle}
                      href={`/sorotan/${item.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${item.title}${idxMeta ? ` (${idxMeta.label})` : ""}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-surface px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary"
                    >
                      <span>{label}</span>
                      {idxMeta && item.indexStatus === "failed" && (
                        <span className="text-[10px] font-bold uppercase text-red-700">
                          · Gagal
                        </span>
                      )}
                      <ExternalLink size={11} className="opacity-70" />
                    </a>
                  );
                }
                return (
                  <span
                    key={angle}
                    className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-txt-muted"
                    title={`Sudut ${label} belum dibuat`}
                  >
                    {label} · Belum
                  </span>
                );
              })}

              {progress.legacyItems.map((item) => (
                <a
                  key={item.slug}
                  href={`/sorotan/${item.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.title}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-txt-secondary transition-colors hover:border-primary hover:text-primary"
                >
                  <span>{SOROTAN_ANGLE_LABEL[item.angle] ?? item.angle}</span>
                  <ExternalLink size={11} className="opacity-70" />
                </a>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SorotanPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SorotanPageContent />
    </Suspense>
  );
}
