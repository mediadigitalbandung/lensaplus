"use client";

/**
 * Sorotan Panel — SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 *
 * Article-centric: browse Sorotan by their SOURCE article. Each article expands
 * to its angle-pages (Kronologi / Analisis / Dampak / …) — click an angle to
 * open its public Sorotan page. Generate Sorotan per article or in batch.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  Loader2,
  Zap,
  Bot,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Search as SearchIcon,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { EDITOR_ROLES } from "@/lib/roles";

interface SorotanItem {
  slug: string;
  angle: string;
  title: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  sorotan: SorotanItem[];
}

const ANGLE_LABEL: Record<string, string> = {
  KRONOLOGI: "Kronologi",
  ANALISIS: "Analisis",
  DAMPAK: "Dampak",
  LATAR_BELAKANG: "Latar Belakang",
  PROFIL: "Profil",
  REAKSI: "Reaksi",
  HUKUM: "Hukum",
  EKONOMI: "Ekonomi",
  PROYEKSI: "Proyeksi",
  FAQ: "FAQ",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SorotanPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = session?.user?.role || "";
  const { success: showSuccess, error: showError } = useToast();

  const [articles, setArticles] = useState<Article[]>([]);
  const [totalSorotan, setTotalSorotan] = useState(0);
  const [totalArticles, setTotalArticles] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [onlyWithSorotan, setOnlyWithSorotan] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [batchGenerating, setBatchGenerating] = useState(false);
  const [singleProcessing, setSingleProcessing] = useState<string | null>(null);

  // Auto-generation settings (sorotan_*) — admin only
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [intervalMin, setIntervalMin] = useState(60);
  const [batchSize, setBatchSize] = useState(5);
  const [savingToggle, setSavingToggle] = useState(false);
  const [savingInterval, setSavingInterval] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);
  const isAdmin = userRole === "SUPER_ADMIN" || userRole === "CHIEF_EDITOR";

  if (
    sessionStatus !== "loading" &&
    session &&
    !EDITOR_ROLES.includes(userRole)
  ) {
    redirect("/panel/dashboard");
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
        onlyWithSorotan: String(onlyWithSorotan),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/seo/sorotan-by-article?${params}`);
      if (res.ok) {
        const json = await res.json();
        setArticles(json.data?.articles || []);
        setTotalSorotan(json.data?.totalSorotan || 0);
        setTotalArticles(json.data?.pagination?.total || 0);
        setTotalPages(json.data?.pagination?.totalPages || 1);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [page, onlyWithSorotan, debouncedSearch]);

  const fetchAutoSettings = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data || {};
      setAutoEnabled(String(data.sorotan_auto_enabled ?? "false") === "true");
      const iv = Number(data.sorotan_interval_minutes ?? "60");
      setIntervalMin([5, 10, 15, 20, 30, 60].includes(iv) ? iv : 60);
      const bs = Math.floor(Number(data.sorotan_batch_size ?? "5"));
      setBatchSize(Number.isFinite(bs) ? Math.min(20, Math.max(0, bs)) : 5);
    } catch {
      /* */
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    fetchAutoSettings();
  }, [fetchAutoSettings]);

  // Debounce the search box → reset to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function saveSetting(key: string, value: string) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Gagal menyimpan");
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
    try {
      setBatchGenerating(true);
      const res = await fetch("/api/seo/generate-sorotan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 5 }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      showSuccess(
        `Diproses ${json.data?.targets ?? 0} artikel — ${json.data?.totalCreated ?? 0} sorotan dibuat, ${json.data?.totalErrors ?? 0} error.`,
      );
      fetchData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal batch generate");
    } finally {
      setBatchGenerating(false);
    }
  }

  async function handleSingle(articleId: string) {
    try {
      setSingleProcessing(articleId);
      const res = await fetch("/api/seo/generate-sorotan-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal");
      showSuccess(
        `${json.data?.created ?? 0} angle dibuat, ${json.data?.skipped ?? 0} di-skip, ${(json.data?.errors || []).length} error.`,
      );
      setExpandedId(articleId); // reveal the freshly created sorotan
      fetchData();
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal generate");
    } finally {
      setSingleProcessing(null);
    }
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
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Sorotan
            </h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-txt-secondary">
            Halaman SEO tambahan per artikel (Kronologi / Analisis / Dampak /
            dst.). Pilih artikel sumber, lalu klik salah satu sudut pandang untuk
            membuka halaman Sorotan-nya. Setiap halaman menutup dengan tombol
            &quot;Lanjut Baca Artikel Lengkap&quot; yang mengarahkan pembaca ke
            artikel utama.
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
            <ExternalLink size={14} /> Lihat Halaman Publik
          </a>
          <button
            onClick={fetchData}
            className="btn-ghost flex items-center gap-2 px-3 py-2.5 text-sm"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={handleBatchGenerate}
            disabled={batchGenerating}
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

      {/* Summary — total saja, tanpa status index */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <p className="text-xs text-txt-secondary">Total Halaman Sorotan</p>
          <p className="mt-1 text-2xl font-extrabold text-txt-primary">
            {totalSorotan.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <p className="text-xs text-txt-secondary">
            {onlyWithSorotan ? "Artikel ber-Sorotan" : "Artikel Dipublikasi"}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-primary">
            {totalArticles.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Auto-generation panel — admin only */}
      {isAdmin && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
                <Bot size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-txt-primary">
                  Auto Generate Sorotan
                </h2>
                <p className="text-xs text-txt-secondary">
                  {autoEnabled
                    ? batchSize === 0
                      ? `Aktif tapi batch = 0 (pause). Cron tetap dipanggil tiap ${intervalMin} menit.`
                      : `Cron akan generate ${batchSize} artikel setiap ${intervalMin} menit.`
                    : "Nonaktif — Sorotan hanya dibuat manual via tombol di atas."}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleAuto}
              disabled={savingToggle}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
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
                      Math.min(20, Math.max(0, Math.floor(Number(e.target.value) || 0))),
                    )
                  }
                  onBlur={(e) => handleSaveBatch(Math.floor(Number(e.target.value) || 0))}
                  disabled={savingBatch}
                  className="input w-24 px-3 py-2 text-sm disabled:opacity-50"
                />
                <span className="text-xs text-txt-secondary">artikel (0–20)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari artikel sumber..."
            className="input w-full pl-9"
            aria-label="Cari artikel"
          />
        </div>
        <div className="flex items-center gap-1 rounded-full bg-surface-tertiary p-1 text-xs font-medium">
          <button
            onClick={() => { setOnlyWithSorotan(true); setPage(1); }}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              onlyWithSorotan ? "bg-primary text-white" : "text-txt-secondary"
            }`}
          >
            Sudah ada Sorotan
          </button>
          <button
            onClick={() => { setOnlyWithSorotan(false); setPage(1); }}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              !onlyWithSorotan ? "bg-primary text-white" : "text-txt-secondary"
            }`}
          >
            Semua artikel
          </button>
        </div>
      </div>

      {/* Article list — article-centric, expandable to its sorotan pages */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 size={24} className="mx-auto animate-spin text-primary" />
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface py-16 text-center shadow-card">
          <p className="text-sm text-txt-secondary">
            {onlyWithSorotan
              ? "Belum ada artikel yang punya Sorotan. Klik “Generate Batch” atau pilih “Semua artikel” untuk membuat."
              : "Belum ada artikel dipublikasi."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {articles.map((a) => {
              const expanded = expandedId === a.id;
              return (
                <div
                  key={a.id}
                  className="overflow-hidden rounded-xl border border-border bg-surface shadow-card"
                >
                  <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
                    <button
                      onClick={() => setExpandedId(expanded ? null : a.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-expanded={expanded}
                    >
                      <span className="text-txt-muted shrink-0">
                        {expanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-txt-primary">
                          {a.title}
                        </span>
                        <span className="block truncate text-[11px] text-txt-muted">
                          /{a.slug} · {formatDate(a.publishedAt)} ·{" "}
                          <span
                            className={
                              a.sorotan.length
                                ? "font-semibold text-primary"
                                : "text-txt-muted"
                            }
                          >
                            {a.sorotan.length} sorotan
                          </span>
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => handleSingle(a.id)}
                      disabled={singleProcessing === a.id}
                      className="btn-secondary inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      title="Buat / lengkapi Sorotan untuk artikel ini"
                    >
                      {singleProcessing === a.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      Generate
                    </button>
                  </div>

                  {expanded && (
                    <div className="border-t border-border bg-surface-secondary/40 px-4 py-3">
                      {a.sorotan.length === 0 ? (
                        <p className="text-xs text-txt-muted">
                          Belum ada Sorotan untuk artikel ini. Klik{" "}
                          <strong>Generate</strong> untuk membuatnya.
                        </p>
                      ) : (
                        <>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-txt-secondary">
                            Pilih sudut pandang ({a.sorotan.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {a.sorotan.map((s) => (
                              <a
                                key={s.slug}
                                href={`/sorotan/${s.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={s.title}
                                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-light/50 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-light"
                              >
                                {ANGLE_LABEL[s.angle] ?? s.angle}
                                <ExternalLink size={11} className="opacity-70" />
                              </a>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination (server-side) */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost rounded px-3 py-1.5 disabled:opacity-30"
              >
                Prev
              </button>
              <span className="px-2 font-semibold text-txt-primary">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-ghost rounded px-3 py-1.5 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
