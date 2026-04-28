"use client";

/**
 * Sorotan Panel — EDITOR+
 * Manage Sorotan SEO pages generated per article (3 angles: KRONOLOGI, ANALISIS, DAMPAK)
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Zap,
  Bot,
  ExternalLink,
  Eye,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { EDITOR_ROLES } from "@/lib/roles";

interface Article {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  _sorotanCount?: number;
}

interface SorotanStatus {
  total: number;
  counts: {
    pending: number;
    submitted: number;
    indexed: number;
    failed: number;
    unknown: number;
  };
}

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
  const [sorotanStatus, setSorotanStatus] = useState<SorotanStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [singleProcessing, setSingleProcessing] = useState<string | null>(null);

  // Article list pagination (client-side over the fetched batch)
  const [page, setPage] = useState<number>(1);
  const ARTICLES_PER_PAGE = 15;

  // Auto-generation settings (sorotan_*)
  const [autoEnabled, setAutoEnabled] = useState<boolean>(false);
  const [intervalMin, setIntervalMin] = useState<number>(60);
  const [batchSize, setBatchSize] = useState<number>(5);
  const [savingToggle, setSavingToggle] = useState<boolean>(false);
  const [savingInterval, setSavingInterval] = useState<boolean>(false);
  const [savingBatch, setSavingBatch] = useState<boolean>(false);
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
      const [artRes, statusRes] = await Promise.all([
        fetch("/api/articles?status=PUBLISHED&limit=500&sort=oldest"),
        fetch("/api/seo/sorotan-status"),
      ]);

      if (artRes.ok) {
        const json = await artRes.json();
        setArticles(json.data?.articles || []);
      }
      if (statusRes.ok) {
        const json = await statusRes.json();
        setSorotanStatus(json.data);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

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
    fetchAutoSettings();
  }, [fetchData, fetchAutoSettings]);

  // Clamp the current page when the article list shrinks (e.g. after a
  // generate run flips an article out of the "needs sorotan" filter).
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(articles.length / ARTICLES_PER_PAGE));
    if (page > totalPages) setPage(totalPages);
  }, [articles.length, page]);

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb size={24} className="text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold text-txt-primary">
              Sorotan
            </h1>
          </div>
          <p className="mt-1 text-sm text-txt-secondary">
            Halaman SEO tambahan — 10 sudut pandang per artikel (Kronologi /
            Analisis / Dampak / Latar Belakang / Profil / Reaksi / Hukum /
            Ekonomi / Proyeksi / FAQ). Setiap sorotan menutup dengan tombol
            &quot;Lanjut Baca Artikel Lengkap&quot; yang funnel pembaca ke
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

      {/* Status cards */}
      {sorotanStatus && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <p className="text-xs text-txt-secondary">Total Sorotan</p>
            <p className="mt-1 text-2xl font-extrabold text-txt-primary">
              {sorotanStatus.total}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-1.5 text-xs text-txt-secondary">
              <Clock size={12} className="text-yellow-500" /> Pending
            </div>
            <p className="mt-1 text-2xl font-extrabold text-yellow-600">
              {sorotanStatus.counts.pending}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-1.5 text-xs text-txt-secondary">
              <AlertCircle size={12} className="text-blue-500" /> Submitted
            </div>
            <p className="mt-1 text-2xl font-extrabold text-blue-600">
              {sorotanStatus.counts.submitted}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-1.5 text-xs text-txt-secondary">
              <CheckCircle size={12} className="text-primary" /> Indexed
            </div>
            <p className="mt-1 text-2xl font-extrabold text-primary">
              {sorotanStatus.counts.indexed}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-1.5 text-xs text-txt-secondary">
              <XCircle size={12} className="text-red-500" /> Failed
            </div>
            <p className="mt-1 text-2xl font-extrabold text-red-600">
              {sorotanStatus.counts.failed}
            </p>
          </div>
        </div>
      )}

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
              <p className="mt-1 text-xs text-txt-muted">
                Cron VPS dipanggil tiap 5 menit; throttle endpoint memastikan
                generate hanya jalan sesuai pilihan ini.
              </p>
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
              <p className="mt-1 text-xs text-txt-muted">
                Tiap artikel butuh ~3 panggilan AI. 0 = pause tanpa nonaktifkan
                toggle.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Sparkles size={16} className="mt-0.5 text-blue-600 shrink-0" />
          <div className="text-xs text-blue-700 space-y-1">
            <p>
              Sorotan dibuat otomatis via AI (3 angle: KRONOLOGI, ANALISIS,
              DAMPAK). Setiap artikel idealnya punya 3 sorotan.
            </p>
            <p>
              <span className="font-semibold">Halaman publik</span>:{" "}
              <a
                href="/sorotan"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-900"
              >
                /sorotan
              </a>{" "}
              (index) — pola URL per sorotan:{" "}
              <code className="font-mono bg-blue-100 px-1 rounded">
                /sorotan/&lt;slug-artikel&gt;-&lt;angle&gt;
              </code>
              , mis.{" "}
              <code className="font-mono bg-blue-100 px-1 rounded">
                /sorotan/regulasi-ai-di-indonesia-kronologi
              </code>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Article list */}
      <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
        <div className="border-b border-border bg-surface-secondary px-5 py-4">
          <h2 className="text-base font-bold text-txt-primary">
            Artikel Dipublikasi
          </h2>
        </div>
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 size={24} className="mx-auto animate-spin text-primary" />
          </div>
        ) : articles.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-txt-secondary">
              Belum ada artikel dipublikasi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-secondary">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-txt-secondary">
                    Artikel
                  </th>
                  <th className="hidden sm:table-cell px-5 py-3 text-left font-medium text-txt-secondary">
                    Dipublikasi
                  </th>
                  <th className="px-5 py-3 text-right font-medium text-txt-secondary">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {articles
                  .slice(
                    (page - 1) * ARTICLES_PER_PAGE,
                    page * ARTICLES_PER_PAGE,
                  )
                  .map((a) => (
                  <tr key={a.id} className="hover:bg-surface-secondary/50">
                    <td className="max-w-[360px] px-5 py-3">
                      <p className="truncate font-medium text-txt-primary">
                        {a.title}
                      </p>
                      <p className="text-[11px] text-txt-muted truncate">
                        /{a.slug}
                      </p>
                    </td>
                    <td className="hidden sm:table-cell px-5 py-3 text-xs text-txt-secondary">
                      {formatDate(a.publishedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <a
                          href={`/sorotan/${a.slug}-kronologi`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium hover:text-primary"
                          title="Lihat halaman Sorotan untuk artikel ini (angle Kronologi)"
                        >
                          <Eye size={12} />
                          Lihat
                        </a>
                        <button
                          onClick={() => handleSingle(a.id)}
                          disabled={singleProcessing === a.id}
                          className="btn-secondary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        >
                          {singleProcessing === a.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Sparkles size={12} />
                          )}
                          Generate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {articles.length > ARTICLES_PER_PAGE && (
              <div className="flex items-center justify-between border-t border-border bg-surface-secondary/40 px-5 py-3 text-xs">
                <span className="text-txt-secondary">
                  Menampilkan{" "}
                  <span className="font-semibold text-txt-primary">
                    {(page - 1) * ARTICLES_PER_PAGE + 1}
                  </span>
                  –
                  <span className="font-semibold text-txt-primary">
                    {Math.min(page * ARTICLES_PER_PAGE, articles.length)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-txt-primary">
                    {articles.length}
                  </span>{" "}
                  artikel
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-ghost flex items-center gap-1 rounded px-2 py-1 disabled:opacity-30"
                    aria-label="Halaman sebelumnya"
                  >
                    Prev
                  </button>
                  <span className="px-2 font-semibold text-txt-primary">
                    {page} / {Math.ceil(articles.length / ARTICLES_PER_PAGE)}
                  </span>
                  <button
                    onClick={() =>
                      setPage((p) =>
                        Math.min(
                          Math.ceil(articles.length / ARTICLES_PER_PAGE),
                          p + 1,
                        ),
                      )
                    }
                    disabled={
                      page >= Math.ceil(articles.length / ARTICLES_PER_PAGE)
                    }
                    className="btn-ghost flex items-center gap-1 rounded px-2 py-1 disabled:opacity-30"
                    aria-label="Halaman berikutnya"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
