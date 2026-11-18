"use client";

/**
 * Sumber Berita Panel — open to EVERY writer role.
 *
 * Anyone (SUPER_ADMIN → CONTRIBUTOR) can browse sources, preview the
 * articles the scraper detects, and generate DRAFTs from them. Each
 * upstream URL is claimed globally before scraping (ScrapedUrl ledger),
 * so two writers can never turn the same article into two drafts — first
 * to grab it wins; everyone else sees it as "sudah diambil".
 *
 * Managing each source (edit / toggle / delete) is available to its
 * owner account and SUPER_ADMIN (`canManageSource`).
 *
 * Cron `/api/cron/scrape-sources` walks all active sources hourly
 * and obeys each source's `frequencyHours` (1–24).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Globe,
  Plus,
  Loader2,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Power,
  PowerOff,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  X,
  Sparkles,
  Lock,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface NewsSource {
  id: string;
  name: string;
  listingUrl: string;
  description: string | null;
  ownerId: string | null;
  owner: { id: string; name: string } | null;
  categoryId: string | null;
  category: Category | null;
  isActive: boolean;
  autoScrape: boolean;
  autoPublish: boolean;
  priority: number;
  frequencyHours: number;
  totalScraped: number;
  scrapedUrls: string[];
  defaultTags: string[];
  articleSelector: string | null;
  titleSelector: string | null;
  contentSelector: string | null;
  imageSelector: string | null;
  useHeadless: boolean;
  waitForSelector: string | null;
  crawlSubcategories: boolean;
  crawlMaxPages: number;
  paginationMaxPages: number;
  paginationPattern: string | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

type PreviewArticleStatus =
  | "NEW"
  | "CLAIMED"
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED"
  | "DELETED";

interface PreviewItem {
  url: string;
  title: string;
  originalTitle?: string;
  thumbnail?: string;
  snippet?: string;
  originalSnippet?: string;
  translated?: boolean;
  alreadyScraped: boolean;
  canGenerate?: boolean;
  wasDeleted?: boolean;
  articleStatus?: PreviewArticleStatus;
  /** Name of the writer who already claimed this URL (null = free). */
  claimedBy?: string | null;
  /** "CLAIMED" (in progress) | "DONE" (active article) | "DELETED" | null. */
  claimStatus?: string | null;
  /** Linked article ID when an active article exists. */
  articleId?: string | null;
  articleSlug?: string | null;
  publishedAt?: string | null;
}

interface PreviewResponse {
  selectorUsed: string;
  detectedLang?: string | null;
  detectedLangLabel?: string | null;
  isForeign?: boolean;
  translatedPreview?: boolean;
  total: number;
  newCount: number;
  totalNewCount?: number;
  items: PreviewItem[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getShortHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function parseApiJson(
  res: Response,
): Promise<{ success?: boolean; data?: unknown; error?: string } | null> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as { success?: boolean; data?: unknown; error?: string };
  } catch {
    if (res.status === 504 || res.status === 524) {
      return {
        success: false,
        error: `Request timeout (HTTP ${res.status}). Coba kurangi jumlah halaman atau scrape satu per satu dari Preview.`,
      };
    }
    return {
      success: false,
      error: `Respons server tidak valid (HTTP ${res.status}).`,
    };
  }
}

export default function SumberBeritaPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const myId = session?.user?.id ?? "";
  const isSuperAdmin = role === "SUPER_ADMIN";
  // Every account manages its OWN sources. A source can be edited/deleted by
  // its owner, or by any SUPER_ADMIN (who also SEES everyone's sources).
  const canAdd = !!session?.user;
  const canManageSource = (s: NewsSource) => isSuperAdmin || s.ownerId === myId;
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<NewsSource | null>(null);
  const [detailSourceId, setDetailSourceId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    sourceId: string;
    sourceName: string;
    data: PreviewResponse;
  } | null>(null);
  const detailSource = detailSourceId
    ? sources.find((s) => s.id === detailSourceId) ?? null
    : null;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<
    "preview" | "scrape" | "toggle" | "toggle_auto_scrape" | "toggle_auto_publish" | "bulk_toggle" | "delete" | "ai_meta" | null
  >(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "error" | "success";
    sourceName: string;
    message: string;
  } | null>(null);
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const [sRes, cRes] = await Promise.all([
        fetch("/api/news-sources"),
        fetch("/api/categories"),
      ]);
      if (sRes.ok) {
        const json = await sRes.json();
        setSources(json.data?.sources || []);
      } else {
        const json = await sRes.json().catch(() => null);
        showError(json?.error || "Gagal memuat daftar sumber berita");
      }
      if (cRes.ok) {
        const json = await cRes.json();
        setCategories(json.data || []);
      }
    } catch {
      showError("Gagal menghubungi server saat memuat sumber berita");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  async function handlePreview(s: NewsSource) {
    setBusyId(s.id);
    setBusyAction("preview");
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/news-sources/${s.id}/preview`, { method: "POST" });
      const json = await parseApiJson(res);
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Preview gagal (HTTP ${res.status})`;
        showError(msg);
        setActionFeedback({ type: "error", sourceName: s.name, message: msg });
        fetchSources();
        return;
      }
      const previewData = json.data as PreviewResponse;
      setPreview({
        sourceId: s.id,
        sourceName: s.name,
        data: previewData,
      });
      setSources((prev) =>
        prev.map((item) =>
          item.id === s.id
            ? {
                ...item,
                lastError:
                  previewData.total > 0
                    ? null
                    : "0 artikel terdeteksi saat preview. Coba aktifkan Render JS (headless) atau isi CSS Selector manual.",
              }
            : item,
        ),
      );
    } catch {
      const msg = "Gagal menghubungi server saat preview";
      showError(msg);
      setActionFeedback({ type: "error", sourceName: s.name, message: msg });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleScrape(s: NewsSource, limit = 3) {
    const modeLabel = s.autoPublish
      ? "langsung diterbitkan (Auto-Publish ON)"
      : "menjadi draft";
    const ok = await confirm({
      title: "Jalankan scrape?",
      message: `Akan mengambil maksimal ${limit} artikel baru dari ${s.name}, diterjemahkan langsung ke Bahasa Indonesia bila berbahasa asing, lalu diparafrase konsepnya via AI ${modeLabel}. Lanjut?`,
      variant: "default",
    });
    if (!ok) return;
    setBusyId(s.id);
    setBusyAction("scrape");
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/news-sources/${s.id}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const json = await parseApiJson(res);
      if (!res.ok || !json?.success) {
        const msg = json?.error || `Scrape gagal (HTTP ${res.status})`;
        showError(msg);
        setActionFeedback({ type: "error", sourceName: s.name, message: msg });
        fetchSources();
        return;
      }
      const d = json.data as {
        skipped?: string | number;
        ok?: number;
        failed?: number;
        error?: string;
        results?: Array<{ ok?: boolean; skipped?: boolean; error?: string }>;
      };
      if (d.skipped === "no-articles-detected") {
        const msg =
          d.error ||
          "0 artikel terdeteksi di halaman sumber. Aktifkan Render JS (headless) atau isi CSS Selector manual.";
        showError(msg);
        setActionFeedback({ type: "error", sourceName: s.name, message: msg });
      } else if (d.skipped === "no-new-articles") {
        const msg = "Tidak ada artikel baru — semua artikel yang terdeteksi sudah pernah di-scrape.";
        success(msg);
        setActionFeedback({ type: "success", sourceName: s.name, message: msg });
      } else if ((d.ok ?? 0) === 0 && (d.failed ?? 0) > 0) {
        const firstErr =
          d.results?.find((r) => !r.ok && !r.skipped && r.error)?.error ||
          "Scrape gagal untuk semua artikel";
        const msg = `Gagal membuat draft: ${firstErr}`;
        showError(msg);
        setActionFeedback({ type: "error", sourceName: s.name, message: msg });
      } else {
        const skippedNote =
          typeof d.skipped === "number" && d.skipped > 0
            ? `, ${d.skipped} dilewati (sudah diambil penulis lain)`
            : "";
        const failedNote =
          typeof d.failed === "number" && d.failed > 0
            ? `, ${d.failed} gagal`
            : "";
        const noun = s.autoPublish ? "artikel baru diterbitkan" : "draft baru dibuat";
        const msg = `Selesai: ${d.ok ?? 0} ${noun}${skippedNote}${failedNote}.`;
        success(msg);
        setActionFeedback({ type: "success", sourceName: s.name, message: msg });
      }
      fetchSources();
    } catch {
      const msg = "Gagal menghubungi server saat scrape";
      showError(msg);
      setActionFeedback({ type: "error", sourceName: s.name, message: msg });
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleQuickAiMeta(s: NewsSource) {
    const missingTags = !s.defaultTags || s.defaultTags.length === 0;
    const missingDesc = !s.description || !s.description.trim();
    if (!missingTags && !missingDesc) {
      const ok = await confirm({
        title: "Generate ulang via AI?",
        message: `Sumber "${s.name}" sudah memiliki default tags dan deskripsi. Timpa keduanya dengan hasil AI baru?`,
        variant: "default",
      });
      if (!ok) return;
    }

    setBusyId(s.id);
    setBusyAction("ai_meta");
    try {
      const mode =
        missingTags && !missingDesc
          ? "tags"
          : !missingTags && missingDesc
            ? "description"
            : "both";
      const res = await fetch("/api/news-sources/generate-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: s.id,
          mode,
          save: true,
          onlyFillMissing: missingTags || missingDesc,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        showError(json?.error || "Gagal generate metadata AI");
        return;
      }
      success("Default tags & deskripsi berhasil diperbarui AI");
      fetchSources();
    } catch {
      showError("Gagal menghubungi AI service");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleToggle(s: NewsSource) {
    setBusyId(s.id);
    setBusyAction("toggle");
    try {
      const res = await fetch(`/api/news-sources/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showError(json?.error || "Gagal update");
        return;
      }
      success(s.isActive ? "Sumber dinonaktifkan" : "Sumber diaktifkan");
      fetchSources();
    } catch {
      showError("Gagal menghubungi server");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleToggleOption(
    s: NewsSource,
    field: "autoScrape" | "autoPublish",
  ) {
    const currentVal =
      field === "autoScrape" ? (s.autoScrape ?? true) : (s.autoPublish ?? false);
    const nextVal = !currentVal;
    setBusyId(s.id);
    setBusyAction(
      field === "autoScrape" ? "toggle_auto_scrape" : "toggle_auto_publish",
    );
    try {
      const res = await fetch(`/api/news-sources/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: nextVal }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showError(json?.error || "Gagal memperbarui opsi");
        return;
      }
      const label = field === "autoScrape" ? "Auto-Scrape" : "Auto-Publish";
      success(
        `${label} ${nextVal ? "diaktifkan (ON)" : "dinonaktifkan (OFF)"} untuk ${s.name}`,
      );
      setSources((prev) =>
        prev.map((item) =>
          item.id === s.id ? { ...item, [field]: nextVal } : item,
        ),
      );
    } catch {
      showError("Gagal menghubungi server");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleBulkToggleOption(
    field: "autoScrape" | "autoPublish",
    nextVal: boolean,
  ) {
    const manageable = sources.filter(canManageSource);
    if (manageable.length === 0) return;
    setBusyId("__bulk__");
    setBusyAction("bulk_toggle");
    try {
      const responses = await Promise.all(
        manageable.map((s) =>
          fetch(`/api/news-sources/${s.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: nextVal }),
          }),
        ),
      );
      const failedCount = responses.filter((r) => !r.ok).length;
      if (failedCount > 0) {
        showError(`${failedCount} sumber gagal diperbarui`);
      } else {
        const label = field === "autoScrape" ? "Auto-Scrape" : "Auto-Publish";
        success(
          `${label} ${nextVal ? "diaktifkan (ON)" : "dinonaktifkan (OFF)"} untuk semua sumber`,
        );
      }
      fetchSources();
    } catch {
      showError("Gagal menghubungi server");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleDelete(s: NewsSource) {
    const ok = await confirm({
      title: "Hapus sumber?",
      message: `Hapus "${s.name}" secara permanen? Riwayat URL yang sudah di-scrape juga hilang — kalau di-tambah ulang, semua artikel akan dianggap baru.`,
      variant: "danger",
    });
    if (!ok) return;
    setBusyId(s.id);
    setBusyAction("delete");
    try {
      const res = await fetch(`/api/news-sources/${s.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        showError(json?.error || "Gagal hapus");
        return;
      }
      success("Sumber dihapus");
      if (detailSourceId === s.id) {
        setDetailSourceId(null);
      }
      fetchSources();
    } catch {
      showError("Gagal menghubungi server");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-txt-primary sm:text-3xl">
            Sumber Berita
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-txt-secondary">
            Pilih sumber, <strong>Preview</strong>, lalu <strong>Generate</strong> — Lensaplus mengambil judul, isi, dan
            gambar, melakukan <strong>parafrase berbasis konsep</strong> (dan otomatis <strong>menerjemahkan ke Bahasa Indonesia</strong> jika sumber berbahasa asing) menjadi draft baru atas nama Anda. Setiap artikel <strong>dikunci begitu diambil</strong> agar tidak diambil ganda.
            <> Daftar sumber ini <strong>milik akun Anda sendiri</strong> — tambah situs yang ingin Anda scrape.</>
            {isSuperAdmin && (
              <> Sebagai Super Admin, Anda melihat sumber dari <strong>semua akun</strong> (ada keterangan pemiliknya).</>
            )}
          </p>
        </div>
        {canAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={16} /> Tambah Sumber
          </button>
        )}
      </div>

      {/* Legal banner */}
      <div className="mb-6 rounded-lg border border-border border-l-4 border-l-amber-500 bg-surface p-4 text-sm text-txt-primary">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div className="space-y-1">
            <p className="font-semibold">Catatan etis & legal</p>
            <ul className="list-disc pl-5 space-y-1 text-txt-secondary">
              <li>Pakai HANYA situs yang merilis berita untuk publik (situs resmi BUMN, Pemda, klub olahraga, dll). Hindari situs media komersial yang konten-nya berhak cipta penuh.</li>
              <li>Setiap draft otomatis dapat footer atribusi link ke sumber asli.</li>
              <li>Sebelum publish, editor wajib review draft — paraphrase AI harus diverifikasi tetap sesuai fakta sumber.</li>
              <li>robots.txt situs sumber dihormati. URL yang diblok robots akan ditolak saat tambah sumber.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Master / Bulk ON-OFF controls for Auto-Scrape & Auto-Publish */}
      {!loading && sources.filter(canManageSource).length > 0 && (() => {
        const manageable = sources.filter(canManageSource);
        const autoScrapeCount = manageable.filter((s) => s.autoScrape ?? true).length;
        const autoPublishCount = manageable.filter((s) => s.autoPublish ?? false).length;
        const allAutoScrapeOn = autoScrapeCount === manageable.length;
        const allAutoPublishOn = autoPublishCount === manageable.length;
        const isBulkBusy = busyId === "__bulk__" && busyAction === "bulk_toggle";

        return (
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-txt-primary">
                    Auto-Scrape Terjadwal
                  </p>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      autoScrapeCount > 0 ? "text-emerald-700" : "text-txt-muted"
                    }`}
                  >
                    {autoScrapeCount}/{manageable.length} ON
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-txt-secondary">
                  Cron otomatis mengambil artikel baru sesuai frekuensi jam tiap sumber.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={allAutoScrapeOn}
                disabled={isBulkBusy}
                onClick={() => handleBulkToggleOption("autoScrape", !allAutoScrapeOn)}
                className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-txt-primary hover:border-primary transition-colors disabled:opacity-50"
                title={
                  allAutoScrapeOn
                    ? "Matikan Auto-Scrape untuk semua sumber"
                    : "Aktifkan Auto-Scrape untuk semua sumber"
                }
              >
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    allAutoScrapeOn ? "bg-emerald-600" : "bg-stone-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      allAutoScrapeOn ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </span>
                <span>{allAutoScrapeOn ? "Semua ON" : "Semua OFF"}</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-txt-primary">
                    Auto-Publish Artikel
                  </p>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      autoPublishCount > 0 ? "text-primary" : "text-txt-muted"
                    }`}
                  >
                    {autoPublishCount}/{manageable.length} ON
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-txt-secondary">
                  Artikel hasil scrape langsung diterbitkan (PUBLISHED) tanpa masuk draf.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={allAutoPublishOn}
                disabled={isBulkBusy}
                onClick={() => handleBulkToggleOption("autoPublish", !allAutoPublishOn)}
                className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-txt-primary hover:border-primary transition-colors disabled:opacity-50"
                title={
                  allAutoPublishOn
                    ? "Matikan Auto-Publish untuk semua sumber"
                    : "Aktifkan Auto-Publish untuk semua sumber"
                }
              >
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    allAutoPublishOn ? "bg-primary" : "bg-stone-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      allAutoPublishOn ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </span>
                <span>{allAutoPublishOn ? "Semua ON" : "Semua OFF"}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {actionFeedback && (
        <div
          className={`mb-5 flex items-start justify-between gap-3 rounded-lg border border-border border-l-4 bg-surface px-4 py-3 text-sm ${
            actionFeedback.type === "error"
              ? "border-l-red-600 text-red-700"
              : "border-l-emerald-600 text-emerald-700"
          }`}
        >
          <p className="min-w-0 flex-1">
            <strong className="font-semibold">{actionFeedback.sourceName}:</strong>{" "}
            {actionFeedback.message}
          </p>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            aria-label="Tutup pesan"
            className="text-txt-muted hover:text-txt-primary"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border bg-surface p-12 text-center">
          <Globe size={48} className="mx-auto text-txt-muted/40" />
          <p className="mt-4 text-base font-medium text-txt-primary">Belum ada sumber berita</p>
          <p className="mt-1 text-sm text-txt-secondary">
            {canAdd
              ? "Tambah link halaman daftar berita untuk mulai auto-paraphrase"
              : "Belum ada sumber yang disiapkan."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-1 lg:gap-4">
          {sources.map((s) => {
            const isManageable = canManageSource(s);
            return (
              <div
                key={s.id}
                className="rounded-lg border border-border bg-surface shadow-card transition-colors hover:border-primary/40 lg:hover:border-border"
              >
                {/* Compact card for narrow screens (< lg): 2 per row, click to open full details popup */}
                <button
                  type="button"
                  onClick={() => setDetailSourceId(s.id)}
                  className="flex h-full w-full flex-col justify-between p-3 text-left sm:p-3.5 lg:hidden"
                >
                  <div className="w-full min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider truncate">
                      <span className={s.isActive ? "text-emerald-700" : "text-txt-muted"}>
                        {s.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                      {s.category && (
                        <>
                          <span className="text-txt-muted">·</span>
                          <span className="truncate text-primary">{s.category.name}</span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 line-clamp-2 text-xs font-bold leading-snug text-txt-primary sm:text-sm">
                      {s.name}
                    </h3>
                    <p className="mt-1 truncate text-[11px] text-txt-muted">
                      {getShortHost(s.listingUrl)}
                    </p>
                  </div>

                  <div className="mt-2.5 w-full border-t border-border pt-2">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-txt-secondary sm:text-[11px]">
                      <span>
                        <strong className="text-txt-primary">{s.totalScraped}</strong> artikel
                      </span>
                      <span>·</span>
                      <span>{s.frequencyHours}j</span>
                      {s.lastError && (
                        <span className="font-semibold text-red-600">· Error</span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] font-semibold">
                      <span className={(s.autoScrape ?? true) ? "text-emerald-700" : "text-txt-muted"}>
                        Auto: {(s.autoScrape ?? true) ? "ON" : "OFF"}
                      </span>
                      <span className="text-primary">Detail →</span>
                    </div>
                  </div>
                </button>

                {/* Full detailed card for wide/desktop screens (lg+) */}
                <div className="hidden p-5 lg:block">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailSourceId(s.id)}
                          className="text-left text-base font-bold text-txt-primary hover:text-primary transition-colors"
                          title="Lihat detail lengkap sumber berita"
                        >
                          {s.name}
                        </button>
                        <SourceMetaLine source={s} isSuperAdmin={isSuperAdmin} />
                      </div>
                      <a
                        href={s.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 break-all text-xs text-txt-secondary hover:text-primary"
                      >
                        {s.listingUrl} <ExternalLink size={11} />
                      </a>
                      {s.description && (
                        <p className="mt-2 text-sm text-txt-secondary">{s.description}</p>
                      )}
                      {s.defaultTags && s.defaultTags.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {s.defaultTags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded border border-border bg-transparent px-2 py-0.5 text-[11px] text-on-surface-variant"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-txt-muted">
                        <span>
                          <strong className="text-txt-primary">{s.totalScraped}</strong> artikel di-scrape
                        </span>
                        <span>
                          Frekuensi tiap <strong className="text-txt-primary">{s.frequencyHours}j</strong>
                        </span>
                        <span>Last check: {fmtDate(s.lastCheckedAt)}</span>
                        {s.lastSuccessAt && (
                          <span>Last success: {fmtDate(s.lastSuccessAt)}</span>
                        )}
                      </div>
                      {isManageable && (
                        <SourceOptionSwitches
                          source={s}
                          disabled={busyId === s.id}
                          onToggle={(field) => handleToggleOption(s, field)}
                        />
                      )}
                      {s.lastError && (
                        <div className="mt-2 rounded-md border border-border border-l-4 border-l-red-600 bg-surface px-3 py-2 text-xs text-red-700">
                          <span className="font-semibold">Error terakhir:</span> {s.lastError}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <SourceActionButtons
                      source={s}
                      canManage={isManageable}
                      busy={busyId === s.id}
                      busyAction={busyId === s.id ? busyAction : null}
                      onPreview={() => handlePreview(s)}
                      onScrape={() => handleScrape(s, 3)}
                      onAiMeta={() => handleQuickAiMeta(s)}
                      onEdit={() => setEditing(s)}
                      onToggle={() => handleToggle(s)}
                      onDelete={() => handleDelete(s)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cron trigger info — SUPER_ADMIN only (server crontab config) */}
      {isSuperAdmin && (
      <div className="mt-8 rounded-lg bg-surface-container-low p-5 text-sm text-txt-secondary">
        <div className="flex items-start gap-2">
          <RefreshCw size={16} className="mt-0.5 text-primary flex-shrink-0" />
          <div>
            <p className="font-semibold text-txt-primary">Cron otomatis</p>
            <p className="mt-1">
              Endpoint <code className="rounded-lg bg-surface-tertiary px-1.5 py-0.5 text-xs font-mono">POST /api/cron/scrape-sources</code> sudah dilindungi <code className="text-xs font-mono">CRON_SECRET</code>.
              Setting di crontab VPS (tiap 30 menit):
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-primary px-3 py-2 text-[11px] text-white">{`*/30 * * * * curl -sS -X POST https://lensaplus.com/api/cron/scrape-sources -H "Authorization: Bearer $CRON_SECRET" >> /var/log/lensaplus-cron.log 2>&1`}</pre>
            <p className="mt-2 text-xs">
              Tiap 30 menit cron memeriksa semua sumber aktif dengan <em>Auto-Scrape ON</em> yang sudah melewati jendela <em>frequencyHours</em>-nya, mengambil maks 2 artikel baru per sumber (dan otomatis mempublikasikan jika <em>Auto-Publish ON</em>), serta berhenti setelah total 6 artikel per siklus.
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Source detail popup modal */}
      {detailSource && (
        <SourceDetailModal
          source={detailSource}
          isSuperAdmin={isSuperAdmin}
          canManage={canManageSource(detailSource)}
          busy={busyId === detailSource.id}
          busyAction={busyId === detailSource.id ? busyAction : null}
          onClose={() => setDetailSourceId(null)}
          onPreview={() => {
            const target = detailSource;
            setDetailSourceId(null);
            void handlePreview(target);
          }}
          onScrape={() => void handleScrape(detailSource, 3)}
          onAiMeta={() => void handleQuickAiMeta(detailSource)}
          onEdit={() => {
            setDetailSourceId(null);
            setEditing(detailSource);
          }}
          onToggleActive={() => void handleToggle(detailSource)}
          onToggleOption={(field) => void handleToggleOption(detailSource, field)}
          onDelete={() => void handleDelete(detailSource)}
        />
      )}

      {/* Add / Edit modal */}
      {canAdd && (showAdd || editing) && (
        <SourceFormModal
          key={editing?.id ?? "new"}
          source={editing}
          categories={categories}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditing(null);
            fetchSources();
          }}
        />
      )}

      {/* Preview modal */}
      {preview && (
        <PreviewModal
          sourceId={preview.sourceId}
          sourceName={preview.sourceName}
          initialAutoPublish={
            sources.find((s) => s.id === preview.sourceId)?.autoPublish ?? false
          }
          data={preview.data}
          refreshing={busyId === preview.sourceId && busyAction === "preview"}
          onRefresh={() => {
            const src = sources.find((s) => s.id === preview.sourceId);
            if (src) void handlePreview(src);
          }}
          onClose={() => setPreview(null)}
          onScraped={fetchSources}
        />
      )}
    </div>
  );
}

/* ─────────────────────────  Shared Source Helpers & Detail Modal  ───────────────────────── */

function SourceMetaLine({
  source: s,
  isSuperAdmin,
}: {
  source: NewsSource;
  isSuperAdmin: boolean;
}) {
  return (
    <>
      {s.isActive ? (
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          Aktif
        </span>
      ) : (
        <span className="text-[10px] font-bold uppercase tracking-wider text-txt-muted">
          Nonaktif
        </span>
      )}
      {s.category && (
        <>
          <span className="text-txt-muted">·</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            {s.category.name}
          </span>
        </>
      )}
      {isSuperAdmin && (
        <>
          <span className="text-txt-muted">·</span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider text-txt-secondary"
            title="Akun yang menambahkan / men-scrape sumber ini"
          >
            {s.owner?.name ?? "Bersama (lama)"}
          </span>
        </>
      )}
      {s.useHeadless && (
        <>
          <span className="text-txt-muted">·</span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-amber-700"
            title="Render JavaScript via headless Chromium (lambat, untuk SPA)"
          >
            JS Render
          </span>
        </>
      )}
      {s.crawlSubcategories && (
        <>
          <span className="text-txt-muted">·</span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-violet-700"
            title={`Deep crawl ke max ${s.crawlMaxPages} halaman sub-kategori`}
          >
            Deep Crawl
          </span>
        </>
      )}
      {s.paginationMaxPages > 1 && (
        <>
          <span className="text-txt-muted">·</span>
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-primary"
            title={`Ikuti hingga ${s.paginationMaxPages} halaman pagination`}
          >
            {s.paginationMaxPages} Hal
          </span>
        </>
      )}
      <span className="text-txt-muted">·</span>
      <span
        className={`text-[10px] font-bold uppercase tracking-wider ${
          (s.autoScrape ?? true) ? "text-emerald-700" : "text-txt-muted"
        }`}
      >
        Auto-Scrape: {(s.autoScrape ?? true) ? "ON" : "OFF"}
      </span>
      <span className="text-txt-muted">·</span>
      <span
        className={`text-[10px] font-bold uppercase tracking-wider ${
          s.autoPublish ? "text-primary" : "text-txt-muted"
        }`}
      >
        Auto-Publish: {s.autoPublish ? "ON" : "OFF"}
      </span>
    </>
  );
}

function SourceOptionSwitches({
  source: s,
  disabled,
  onToggle,
}: {
  source: NewsSource;
  disabled: boolean;
  onToggle: (field: "autoScrape" | "autoPublish") => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-2">
      <button
        type="button"
        role="switch"
        aria-checked={s.autoScrape ?? true}
        disabled={disabled}
        onClick={() => onToggle("autoScrape")}
        className="inline-flex items-center gap-2 text-xs font-medium text-txt-primary hover:text-primary disabled:opacity-50"
        title="Aktifkan/nonaktifkan pengambilan otomatis terjadwal (cron) untuk sumber ini"
      >
        <span
          className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
            (s.autoScrape ?? true) ? "bg-emerald-600" : "bg-stone-300"
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              (s.autoScrape ?? true) ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
        <span>
          Auto-Scrape:{" "}
          <strong className={(s.autoScrape ?? true) ? "text-emerald-700" : "text-txt-muted"}>
            {(s.autoScrape ?? true) ? "ON" : "OFF"}
          </strong>
        </span>
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={s.autoPublish ?? false}
        disabled={disabled}
        onClick={() => onToggle("autoPublish")}
        className="inline-flex items-center gap-2 text-xs font-medium text-txt-primary hover:text-primary disabled:opacity-50"
        title="Aktifkan/nonaktifkan publikasi otomatis (PUBLISHED) saat artikel sumber ini di-scrape"
      >
        <span
          className={`relative inline-flex h-4 w-8 shrink-0 items-center rounded-full transition-colors ${
            s.autoPublish ? "bg-primary" : "bg-stone-300"
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
              s.autoPublish ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </span>
        <span>
          Auto-Publish:{" "}
          <strong className={s.autoPublish ? "text-primary" : "text-txt-muted"}>
            {s.autoPublish ? "ON" : "OFF"}
          </strong>
        </span>
      </button>
    </div>
  );
}

function SourceActionButtons({
  source: s,
  canManage,
  busy,
  busyAction,
  onPreview,
  onScrape,
  onAiMeta,
  onEdit,
  onToggle,
  onDelete,
}: {
  source: NewsSource;
  canManage: boolean;
  busy: boolean;
  busyAction: string | null;
  onPreview: () => void;
  onScrape: () => void;
  onAiMeta: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={onPreview}
        disabled={busy}
        className="btn-secondary text-xs disabled:opacity-50"
        title="Lihat artikel terdeteksi tanpa save"
      >
        {busy && busyAction === "preview" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Eye size={14} />
        )}
        Preview
      </button>
      <button
        type="button"
        onClick={onScrape}
        disabled={busy || !s.isActive}
        className="btn-primary text-xs disabled:opacity-50"
        title="Ambil 3 artikel baru sekarang"
      >
        {busy && busyAction === "scrape" ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <RefreshCw size={14} />
        )}
        Scrape Now
      </button>
      {canManage && (
        <>
          <button
            type="button"
            onClick={onAiMeta}
            disabled={busy}
            className="btn-ghost text-xs text-primary disabled:opacity-50"
            title={
              !s.description?.trim() || !s.defaultTags?.length
                ? "Lengkapi Default Tags & Deskripsi dengan AI"
                : "Generate ulang Default Tags & Deskripsi dengan AI"
            }
          >
            {busy && busyAction === "ai_meta" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="btn-ghost text-xs"
            title="Edit"
          >
            <Edit size={14} />
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className="btn-ghost text-xs disabled:opacity-50"
            title={s.isActive ? "Nonaktifkan" : "Aktifkan"}
          >
            {s.isActive ? <PowerOff size={14} /> : <Power size={14} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="btn-ghost text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            title="Hapus"
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  );
}

function SourceDetailModal({
  source: s,
  isSuperAdmin,
  canManage,
  busy,
  busyAction,
  onClose,
  onPreview,
  onScrape,
  onAiMeta,
  onEdit,
  onToggleActive,
  onToggleOption,
  onDelete,
}: {
  source: NewsSource;
  isSuperAdmin: boolean;
  canManage: boolean;
  busy: boolean;
  busyAction: string | null;
  onClose: () => void;
  onPreview: () => void;
  onScrape: () => void;
  onAiMeta: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onToggleOption: (field: "autoScrape" | "autoPublish") => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const hasSelectors = Boolean(
    s.articleSelector ||
      s.titleSelector ||
      s.contentSelector ||
      s.imageSelector ||
      s.waitForSelector ||
      s.paginationPattern,
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-detail-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 id="source-detail-title" className="text-base font-bold text-txt-primary sm:text-lg">
              {s.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <SourceMetaLine source={s} isSuperAdmin={isSuperAdmin} />
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup detail" className="btn-ghost shrink-0 p-2">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-txt-muted">
              URL Sumber
            </p>
            <a
              href={s.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 break-all text-xs text-primary hover:underline sm:text-sm"
            >
              {s.listingUrl} <ExternalLink size={12} className="shrink-0" />
            </a>
          </div>

          {s.description && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-txt-muted">
                Deskripsi
              </p>
              <p className="mt-1 text-sm leading-relaxed text-txt-secondary">{s.description}</p>
            </div>
          )}

          {s.defaultTags && s.defaultTags.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-txt-muted">
                Default Tags
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {s.defaultTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded border border-border bg-transparent px-2 py-0.5 text-[11px] text-on-surface-variant"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface-container-low p-3 text-xs">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">
                Total Di-scrape
              </p>
              <p className="mt-0.5 font-bold text-txt-primary">{s.totalScraped} artikel</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">
                Frekuensi Cron
              </p>
              <p className="mt-0.5 font-bold text-txt-primary">Tiap {s.frequencyHours} jam</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">
                Last Check
              </p>
              <p className="mt-0.5 font-medium text-txt-primary">{fmtDate(s.lastCheckedAt)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-txt-muted">
                Last Success
              </p>
              <p className="mt-0.5 font-medium text-txt-primary">{fmtDate(s.lastSuccessAt)}</p>
            </div>
          </div>

          {(s.useHeadless || s.crawlSubcategories || s.paginationMaxPages > 1 || hasSelectors) && (
            <div className="space-y-1.5 rounded-md border border-border bg-surface p-3 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-txt-muted">
                Konfigurasi Teknis Scraper
              </p>
              <div className="grid grid-cols-1 gap-1 text-txt-secondary sm:grid-cols-2">
                <p>Mode Render: <strong className="text-txt-primary">{s.useHeadless ? "Headless JS" : "HTML Statis"}</strong></p>
                <p>Deep Crawl: <strong className="text-txt-primary">{s.crawlSubcategories ? `Ya (maks ${s.crawlMaxPages} hal)` : "Tidak"}</strong></p>
                <p>Pagination: <strong className="text-txt-primary">{s.paginationMaxPages} halaman</strong></p>
                {s.paginationPattern && (
                  <p>Pola Page: <code className="font-mono text-txt-primary">{s.paginationPattern}</code></p>
                )}
                {s.waitForSelector && (
                  <p className="sm:col-span-2">Wait Selector: <code className="font-mono text-txt-primary">{s.waitForSelector}</code></p>
                )}
                {s.articleSelector && (
                  <p className="sm:col-span-2">Article Selector: <code className="font-mono text-txt-primary">{s.articleSelector}</code></p>
                )}
                {s.titleSelector && (
                  <p>Title Selector: <code className="font-mono text-txt-primary">{s.titleSelector}</code></p>
                )}
                {s.contentSelector && (
                  <p>Content Selector: <code className="font-mono text-txt-primary">{s.contentSelector}</code></p>
                )}
                {s.imageSelector && (
                  <p>Image Selector: <code className="font-mono text-txt-primary">{s.imageSelector}</code></p>
                )}
              </div>
            </div>
          )}

          {canManage && (
            <SourceOptionSwitches
              source={s}
              disabled={busy}
              onToggle={onToggleOption}
            />
          )}

          {s.lastError && (
            <div className="rounded-md border border-border border-l-4 border-l-red-600 bg-surface px-3 py-2 text-xs text-red-700">
              <span className="font-semibold">Error terakhir:</span> {s.lastError}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-container-low px-4 py-3 sm:px-5">
          <SourceActionButtons
            source={s}
            canManage={canManage}
            busy={busy}
            busyAction={busyAction}
            onPreview={onPreview}
            onScrape={onScrape}
            onAiMeta={onAiMeta}
            onEdit={onEdit}
            onToggle={onToggleActive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  SourceFormModal  ───────────────────────── */

function SourceFormModal({
  source,
  categories,
  onClose,
  onSaved,
}: {
  source: NewsSource | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!source;
  const [name, setName] = useState(source?.name || "");
  const [listingUrl, setListingUrl] = useState(source?.listingUrl || "");
  const [description, setDescription] = useState(source?.description || "");
  const [categoryId, setCategoryId] = useState(source?.categoryId || source?.category?.id || "");
  const [frequencyHoursInput, setFrequencyHoursInput] = useState(
    String(source?.frequencyHours ?? 4),
  );
  const [autoScrape, setAutoScrape] = useState(source?.autoScrape ?? true);
  const [autoPublish, setAutoPublish] = useState(source?.autoPublish ?? false);
  const [priority] = useState(source?.priority ?? 0);
  const [defaultTagsRaw, setDefaultTagsRaw] = useState(
    (source?.defaultTags ?? []).join(", "),
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [articleSelector, setArticleSelector] = useState(source?.articleSelector || "");
  const [titleSelector, setTitleSelector] = useState(source?.titleSelector || "");
  const [contentSelector, setContentSelector] = useState(source?.contentSelector || "");
  const [imageSelector, setImageSelector] = useState(source?.imageSelector || "");
  const [useHeadless, setUseHeadless] = useState(source?.useHeadless ?? false);
  const [waitForSelector, setWaitForSelector] = useState(source?.waitForSelector || "");
  const [crawlSubcategories, setCrawlSubcategories] = useState(source?.crawlSubcategories ?? false);
  const [crawlMaxPagesInput, setCrawlMaxPagesInput] = useState(
    String(source?.crawlMaxPages ?? 8),
  );
  const [paginationMaxPagesInput, setPaginationMaxPagesInput] = useState(
    String(source?.paginationMaxPages ?? 1),
  );
  const [paginationPattern, setPaginationPattern] = useState(
    source?.paginationPattern || "",
  );
  const [aiLoading, setAiLoading] = useState<"both" | "tags" | "description" | null>(null);
  const [saving, setSaving] = useState(false);
  const { success, error: showError } = useToast();

  async function handleGenerateMeta(mode: "both" | "tags" | "description") {
    if (name.trim().length < 2 && !listingUrl.trim()) {
      showError("Isi Nama Sumber atau URL Halaman Berita terlebih dahulu");
      return;
    }
    setAiLoading(mode);
    try {
      const res = await fetch("/api/news-sources/generate-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: source?.id,
          name: name.trim(),
          listingUrl: listingUrl.trim(),
          categoryId: categoryId || null,
          mode,
          save: false,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        showError(json?.error || "Gagal generate metadata AI");
        return;
      }
      const d = json.data as {
        defaultTags?: string[];
        description?: string;
      };
      if (d.defaultTags && d.defaultTags.length > 0) {
        setDefaultTagsRaw(d.defaultTags.join(", "));
      }
      if (d.description) {
        setDescription(d.description);
      }
      if (mode === "both") {
        success("Default tags & deskripsi berhasil di-generate AI");
      } else if (mode === "tags") {
        success("Default tags berhasil di-generate AI");
      } else {
        success("Deskripsi berhasil di-generate AI");
      }
    } catch {
      showError("Gagal menghubungi AI service");
    } finally {
      setAiLoading(null);
    }
  }

  async function handleSave() {
    if (!name.trim() || !listingUrl.trim()) {
      showError("Nama dan URL wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const parsedFreq = Number.parseInt(frequencyHoursInput, 10);
      const parsedCrawlMax = Number.parseInt(crawlMaxPagesInput, 10);
      const parsedPaginationMax = Number.parseInt(paginationMaxPagesInput, 10);

      const body = {
        name: name.trim(),
        listingUrl: listingUrl.trim(),
        description: description.trim() || null,
        categoryId: categoryId || null,
        autoScrape,
        autoPublish,
        frequencyHours: Math.max(1, Math.min(24, Number.isFinite(parsedFreq) ? parsedFreq : 4)),
        priority: Number(priority) || 0,
        defaultTags: defaultTagsRaw
          .split(",")
          .map((t) => t.trim().replace(/^#+/, "").trim())
          .filter(Boolean)
          .slice(0, 10),
        articleSelector: articleSelector.trim() || null,
        titleSelector: titleSelector.trim() || null,
        contentSelector: contentSelector.trim() || null,
        imageSelector: imageSelector.trim() || null,
        useHeadless,
        waitForSelector: waitForSelector.trim() || null,
        crawlSubcategories,
        crawlMaxPages: Math.max(1, Math.min(50, Number.isFinite(parsedCrawlMax) ? parsedCrawlMax : 8)),
        paginationMaxPages: Math.max(1, Math.min(30, Number.isFinite(parsedPaginationMax) ? parsedPaginationMax : 1)),
        paginationPattern: paginationPattern.trim() || null,
      };
      const res = await fetch(
        isEdit ? `/api/news-sources/${source!.id}` : "/api/news-sources",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        showError(json?.error || "Gagal simpan");
        return;
      }
      success(isEdit ? "Sumber diperbarui" : "Sumber ditambahkan");
      onSaved();
    } catch {
      showError("Gagal menghubungi server saat menyimpan sumber");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-bold text-txt-primary">
            {isEdit ? "Edit Sumber Berita" : "Tambah Sumber Berita"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="btn-ghost p-2">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-txt-primary">
              Nama Sumber <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Bank BJB, Persib Bandung, Pemkot Bandung"
              className="input"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-txt-primary">
              URL Halaman Daftar Berita <span className="text-red-600">*</span>
            </label>
            <input
              type="url"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              placeholder="https://www.bankbjb.co.id/page/berita"
              className="input font-mono text-xs"
            />
            <p className="mt-1 text-[11px] text-txt-muted">
              Halaman yang LIST artikel (bukan satu artikel). robots.txt situs akan dicek otomatis.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-txt-primary">
                Kategori
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input"
              >
                <option value="">— pilih —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-txt-primary">
                Frekuensi (jam, 1–24)
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={frequencyHoursInput}
                onChange={(e) => setFrequencyHoursInput(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Auto-Scrape & Auto-Publish ON/OFF toggles */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-surface-container-low p-3">
              <label className="flex items-start justify-between gap-2 cursor-pointer">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-txt-primary">
                    Auto-Scrape Terjadwal
                  </p>
                  <p className="mt-0.5 text-[11px] text-txt-muted">
                    Cron otomatis mengambil artikel baru sesuai frekuensi jam di atas.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoScrape}
                  onClick={() => setAutoScrape((prev) => !prev)}
                  className="inline-flex shrink-0 items-center gap-1.5"
                >
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      autoScrape ? "bg-emerald-600" : "bg-stone-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        autoScrape ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-txt-primary">
                    {autoScrape ? "ON" : "OFF"}
                  </span>
                </button>
              </label>
            </div>

            <div className="rounded-md border border-border bg-surface-container-low p-3">
              <label className="flex items-start justify-between gap-2 cursor-pointer">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-txt-primary">
                    Auto-Publish Artikel
                  </p>
                  <p className="mt-0.5 text-[11px] text-txt-muted">
                    Artikel hasil scrape langsung diterbitkan (PUBLISHED) tanpa masuk draf.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoPublish}
                  onClick={() => setAutoPublish((prev) => !prev)}
                  className="inline-flex shrink-0 items-center gap-1.5"
                >
                  <span
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      autoPublish ? "bg-primary" : "bg-stone-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        autoPublish ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-txt-primary">
                    {autoPublish ? "ON" : "OFF"}
                  </span>
                </button>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-container-low px-3 py-2">
            <p className="text-[11px] text-txt-secondary">
              Otomatis isi <strong>Default Tags</strong> &amp; <strong>Deskripsi</strong> berdasarkan nama, URL, dan kategori sumber.
            </p>
            <button
              type="button"
              onClick={() => handleGenerateMeta("both")}
              disabled={aiLoading !== null || (name.trim().length < 2 && !listingUrl.trim())}
              className="btn-secondary shrink-0 text-xs disabled:opacity-50"
            >
              {aiLoading === "both" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              Generate Keduanya
            </button>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-txt-primary">
                Default Tags (opsional, pisah koma)
              </label>
              <button
                type="button"
                onClick={() => handleGenerateMeta("tags")}
                disabled={aiLoading !== null || (name.trim().length < 2 && !listingUrl.trim())}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {aiLoading === "tags" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                Generate AI
              </button>
            </div>
            <input
              type="text"
              value={defaultTagsRaw}
              onChange={(e) => setDefaultTagsRaw(e.target.value)}
              placeholder="bank bjb, perbankan, jawa barat"
              className="input"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-txt-primary">
                Deskripsi (opsional)
              </label>
              <button
                type="button"
                onClick={() => handleGenerateMeta("description")}
                disabled={aiLoading !== null || (name.trim().length < 2 && !listingUrl.trim())}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {aiLoading === "description" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                Generate AI
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Catatan internal — tidak ditampilkan publik"
              className="input"
            />
          </div>

          {/* Headless toggle — for SPA / JS-rendered sites */}
          <div className="rounded-md border border-border bg-surface-container-low p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useHeadless}
                onChange={(e) => setUseHeadless(e.target.checked)}
                className="mt-0.5 rounded-lg"
              />
              <div className="flex-1">
                <p className="text-xs font-semibold text-txt-primary">
                  Render JavaScript (headless Chromium)
                </p>
                <p className="mt-0.5 text-[11px] text-txt-muted">
                  Aktifkan untuk situs SPA — yaitu kalau Preview return 0 artikel padahal halaman ada beritanya saat dibuka di browser. Contoh: <code className="font-mono">bankbjb.co.id</code>, <code className="font-mono">persib.co.id</code>. Trade-off: 5–15× lebih lambat dan pakai ~500 MB RAM saat render.
                </p>
              </div>
            </label>
            {useHeadless && (
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
                  Wait For Selector (opsional)
                </label>
                <input
                  type="text"
                  value={waitForSelector}
                  onChange={(e) => setWaitForSelector(e.target.value)}
                  placeholder=".news-grid .item, article"
                  className="input font-mono text-xs"
                />
                <p className="mt-1 text-[10px] text-txt-muted">
                  Sistem menunggu selector ini muncul setelah JS load. Biarkan kosong untuk auto-detect.
                </p>
              </div>
            )}
          </div>

          {/* Deep crawl — follow sub-category links */}
          <div className="rounded-md border border-border bg-surface-container-low p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={crawlSubcategories}
                onChange={(e) => setCrawlSubcategories(e.target.checked)}
                className="mt-0.5 rounded-lg"
              />
              <div className="flex-1">
                <p className="text-xs font-semibold text-txt-primary">
                  Crawl sub-kategori (deep scan)
                </p>
                <p className="mt-0.5 text-[11px] text-txt-muted">
                  Selain root listing, scraper juga akan ikuti link sub-kategori 1 level (mis. <code className="font-mono">/news/infrastruktur</code>, <code className="font-mono">/news/olahraga</code>) dan kumpulkan artikel dari sana juga. Hasil di-dedup by URL.
                </p>
              </div>
            </label>
            {crawlSubcategories && (
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
                  Max halaman di-crawl (1–50)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={crawlMaxPagesInput}
                  onChange={(e) => setCrawlMaxPagesInput(e.target.value)}
                  className="input w-24"
                />
                <p className="mt-1 text-[10px] text-txt-muted">
                  Cap total halaman dikunjungi (root + sub-kategori). Default 8 — cukup untuk 8 kategori berita.
                </p>
              </div>
            )}
          </div>

          {/* Pagination settings */}
          <div className="rounded-md border border-border bg-surface-container-low p-3">
            <p className="text-xs font-semibold text-txt-primary">
              Pagination halaman arsip (opsional)
            </p>
            <p className="mt-0.5 text-[11px] text-txt-muted">
              Set ke &gt; 1 jika daftar berita dipecah per halaman (mis. <code className="font-mono">?page=1</code>, <code className="font-mono">/page/2</code>). Nilai 1 = hanya halaman root.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
                  Jumlah Halaman (1–30)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={paginationMaxPagesInput}
                  onChange={(e) => setPaginationMaxPagesInput(e.target.value)}
                  className="input w-28"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
                  Pola Pagination (opsional)
                </label>
                <input
                  type="text"
                  value={paginationPattern}
                  onChange={(e) => setPaginationPattern(e.target.value)}
                  maxLength={60}
                  placeholder="?page={n} atau /page/{n}"
                  className="input font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {showAdvanced ? "Tutup" : "▸ Tampilkan"} CSS Selector lanjutan
            </button>
            <p className="text-[11px] text-txt-muted">
              Hanya isi kalau auto-detect gagal pada Preview.
            </p>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-3 rounded-md bg-surface-container-low p-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
                  Article Card Selector
                </label>
                <input
                  type="text"
                  value={articleSelector}
                  onChange={(e) => setArticleSelector(e.target.value)}
                  placeholder=".news-list .item"
                  className="input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
                  Title Selector (di dalam card)
                </label>
                <input
                  type="text"
                  value={titleSelector}
                  onChange={(e) => setTitleSelector(e.target.value)}
                  placeholder="h3 a"
                  className="input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
                  Content Selector (di detail page)
                </label>
                <input
                  type="text"
                  value={contentSelector}
                  onChange={(e) => setContentSelector(e.target.value)}
                  placeholder=".article-body"
                  className="input font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
                  Image Selector (hero image)
                </label>
                <input
                  type="text"
                  value={imageSelector}
                  onChange={(e) => setImageSelector(e.target.value)}
                  placeholder=".hero img"
                  className="input font-mono text-xs"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-surface-container-low px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-ghost text-sm disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {isEdit ? "Simpan" : "Tambah"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────  PreviewModal  ───────────────────────── */

function PreviewModal({
  sourceId,
  sourceName,
  initialAutoPublish = false,
  data,
  refreshing,
  onRefresh,
  onClose,
  onScraped,
}: {
  sourceId: string;
  sourceName: string;
  initialAutoPublish?: boolean;
  data: PreviewResponse;
  refreshing?: boolean;
  onRefresh: () => void;
  onClose: () => void;
  onScraped: () => void;
}) {
  const { success, error: showError } = useToast();
  interface ItemState {
    status: "idle" | "running" | "done" | "error";
    message?: string;
    articleId?: string;
    articleSlug?: string | null;
    articleStatus?: PreviewArticleStatus;
  }
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  const [filterTab, setFilterTab] = useState<
    "ALL" | "NEW" | "DELETED" | "IN_PROGRESS" | "PUBLISHED"
  >("ALL");
  const [showOriginalText, setShowOriginalText] = useState(false);
  const [autoPublishNow, setAutoPublishNow] = useState(initialAutoPublish);
  // Bulk-generate progress state.
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const bulkAbortRef = useRef(false);

  // Reset local overrides whenever a fresh preview payload arrives (e.g. Refresh).
  useEffect(() => {
    setItemState({});
  }, [data]);

  useEffect(() => {
    return () => {
      bulkAbortRef.current = true;
    };
  }, []);

  function getEffectiveStatus(item: PreviewItem): PreviewArticleStatus {
    const state = itemState[item.url];
    if (state?.status === "done") {
      return state.articleStatus ?? "DRAFT";
    }
    if (item.articleStatus) return item.articleStatus;
    if (item.claimStatus === "CLAIMED") return "CLAIMED";
    if (item.alreadyScraped) return "DRAFT";
    return "NEW";
  }

  function canGenerateItem(item: PreviewItem): boolean {
    const effective = getEffectiveStatus(item);
    return effective === "NEW" || effective === "DELETED";
  }

  async function handleGenerate(
    url: string,
    opts?: { suppressRefresh?: boolean; thumbnail?: string; isRegenerate?: boolean },
  ): Promise<"ok" | "skipped" | "error"> {
    setItemState((s) => ({ ...s, [url]: { status: "running" } }));
    try {
      const res = await fetch(`/api/news-sources/${sourceId}/scrape-one`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          autoPublish: autoPublishNow,
          ...(opts?.thumbnail ? { thumbnail: opts.thumbnail } : {}),
        }),
      });
      const json = await parseApiJson(res);
      if (!res.ok || !json?.success) {
        const errMsg = json?.error || `HTTP ${res.status}`;
        setItemState((s) => ({
          ...s,
          [url]: { status: "error", message: errMsg },
        }));
        showError(`Gagal generate: ${errMsg}`);
        return "error";
      }
      const d = json.data as {
        skipped?: string;
        articleId?: string;
        slug?: string;
        title?: string;
        articleStatus?: PreviewArticleStatus;
      };
      if (d.skipped) {
        const fallbackStatus: PreviewArticleStatus =
          d.skipped === "in-progress" ? "CLAIMED" : "DRAFT";
        setItemState((s) => ({
          ...s,
          [url]: { status: "done", articleStatus: fallbackStatus },
        }));
        if (d.skipped === "in-progress") {
          showError("Artikel ini sedang diambil penulis lain.");
        }
        return "skipped";
      }
      setItemState((s) => ({
        ...s,
        [url]: {
          status: "done",
          articleId: d.articleId,
          articleSlug: d.slug ?? null,
          articleStatus: d.articleStatus ?? "DRAFT",
        },
      }));
      const publishedNow = d.articleStatus === "PUBLISHED";
      success(
        publishedNow
          ? `Artikel diterbitkan: "${d.title}"`
          : opts?.isRegenerate
            ? `Draft dibuat ulang: "${d.title}"`
            : `Draft dibuat: "${d.title}"`,
      );
      if (!opts?.suppressRefresh) {
        onScraped();
      }
      return "ok";
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Network error";
      setItemState((s) => ({
        ...s,
        [url]: { status: "error", message: errMsg },
      }));
      showError(`Gagal generate: ${errMsg}`);
      return "error";
    }
  }

  /** Sequentially generate every remaining "BARU" item left in the preview. */
  async function handleGenerateAll() {
    const targets = data.items.filter(
      (item) =>
        getEffectiveStatus(item) === "NEW" &&
        itemState[item.url]?.status !== "running",
    );
    if (targets.length === 0) {
      showError("Tidak ada artikel baru untuk di-generate.");
      return;
    }
    bulkAbortRef.current = false;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length, failed: 0 });
    let done = 0;
    let okCount = 0;
    let skippedCount = 0;
    let failed = 0;
    for (const item of targets) {
      if (bulkAbortRef.current) break;
      const outcome = await handleGenerate(item.url, {
        suppressRefresh: true,
        thumbnail: item.thumbnail,
      });
      if (outcome === "ok") okCount++;
      else if (outcome === "skipped") skippedCount++;
      else failed++;
      done++;
      setBulkProgress({ done, total: targets.length, failed });
      if (!bulkAbortRef.current && done < targets.length) {
        await new Promise((r) => setTimeout(r, 350));
      }
    }
    setBulkRunning(false);
    const aborted = bulkAbortRef.current;
    bulkAbortRef.current = false;
    if (okCount > 0) {
      onScraped();
    }
    if (aborted) {
      showError(`Dihentikan setelah ${done}/${targets.length} artikel (${okCount} sukses).`);
    } else if (okCount === 0 && failed > 0) {
      showError(`Semua ${failed} artikel gagal di-generate.`);
    } else {
      const notes: string[] = [];
      if (skippedCount > 0) notes.push(`${skippedCount} dilewati`);
      if (failed > 0) notes.push(`${failed} gagal`);
      success(`Selesai: ${okCount} sukses${notes.length ? `, ${notes.join(", ")}` : ""}.`);
    }
  }

  const hasTranslatedItems = data.items.some((item) => Boolean(item.translated));
  const effectiveStatuses = data.items.map((item) => ({
    item,
    effective: getEffectiveStatus(item),
  }));
  const countNew = effectiveStatuses.filter((x) => x.effective === "NEW").length;
  const countDeleted = effectiveStatuses.filter((x) => x.effective === "DELETED").length;
  const countPublished = effectiveStatuses.filter((x) => x.effective === "PUBLISHED").length;
  const countInProgress = effectiveStatuses.filter((x) =>
    ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED", "ARCHIVED", "CLAIMED"].includes(x.effective),
  ).length;
  const remainingNew = effectiveStatuses.filter(
    (x) => x.effective === "NEW" && itemState[x.item.url]?.status !== "running",
  ).length;

  const filteredItems = effectiveStatuses.filter(({ effective }) => {
    if (filterTab === "ALL") return true;
    if (filterTab === "NEW") return effective === "NEW";
    if (filterTab === "DELETED") return effective === "DELETED";
    if (filterTab === "PUBLISHED") return effective === "PUBLISHED";
    if (filterTab === "IN_PROGRESS") {
      return ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED", "ARCHIVED", "CLAIMED"].includes(
        effective,
      );
    }
    return true;
  });

  function renderStatusLabel(item: PreviewItem, effective: PreviewArticleStatus) {
    const prevBy = item.claimedBy;
    switch (effective) {
      case "NEW":
        return (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            ◉ Baru
          </span>
        );
      case "DELETED":
        return (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700"
            title={
              prevBy
                ? `Pernah diambil oleh ${prevBy}, lalu artikelnya dihapus`
                : "Pernah digenerate sebelumnya, lalu artikelnya dihapus"
            }
          >
            <RefreshCw size={10} /> Dihapus{prevBy ? ` · ex ${prevBy}` : ""}
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            <CheckCircle size={10} /> Sudah jadi draf{prevBy ? ` · ${prevBy}` : ""}
          </span>
        );
      case "IN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            <CheckCircle size={10} /> Menunggu review{prevBy ? ` · ${prevBy}` : ""}
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
            <CheckCircle size={10} /> Disetujui / Terjadwal
          </span>
        );
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <CheckCircle size={10} /> Sudah dipublikasi
            {item.publishedAt ? ` · ${fmtDate(item.publishedAt)}` : ""}
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700">
            Ditolak redaksi{prevBy ? ` · ${prevBy}` : ""}
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-txt-muted">
            Diarsipkan
          </span>
        );
      case "CLAIMED":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <Lock size={10} /> Sedang diambil {prevBy || "penulis lain"}
          </span>
        );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-2.5 border-b border-border px-5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-txt-primary">
                Preview — {sourceName}
              </h2>
              <p className="text-xs text-txt-secondary">
                Menampilkan {data.items.length} dari {data.total} artikel terdeteksi ·{" "}
                {countNew} baru · {countDeleted} dihapus · {countInProgress} draf/proses ·{" "}
                {countPublished} terbit · selector:{" "}
                <code className="font-mono">{data.selectorUsed}</code>
              </p>
              <p className="mt-0.5 text-[11px] text-txt-muted">
                Klik <strong>Generate</strong> untuk artikel baru, atau{" "}
                <strong>Generate Lagi</strong> untuk artikel yang drafnya sudah dihapus.
                {data.isForeign && data.detectedLangLabel && (
                  <>
                    {" "}· Bahasa sumber: <strong>{data.detectedLangLabel}</strong>{" "}
                    {data.translatedPreview
                      ? "(daftar judul & draf otomatis diterjemahkan + diparafrase konsep ke Bahasa Indonesia)"
                      : "(draf artikel otomatis diterjemahkan & diparafrase konsep ke Bahasa Indonesia saat Generate)"}
                  </>
                )}
              </p>
              {bulkProgress && (
                <p className="mt-1 text-[11px] font-semibold text-primary">
                  Progress: {bulkProgress.done}/{bulkProgress.total}
                  {bulkProgress.failed ? ` · ${bulkProgress.failed} gagal` : ""}
                  {bulkRunning ? " · sedang berjalan…" : " · selesai"}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing || bulkRunning}
                className="btn-ghost p-2 text-xs disabled:opacity-50"
                title="Muat ulang status artikel terbaru"
                aria-label="Muat ulang preview"
              >
                <RefreshCw
                  size={15}
                  className={refreshing ? "animate-spin" : ""}
                  aria-hidden="true"
                />
              </button>
              {bulkRunning ? (
                <button
                  onClick={() => {
                    bulkAbortRef.current = true;
                  }}
                  className="flex items-center gap-1 rounded-md border border-red-600 bg-surface px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-surface-secondary"
                  title="Stop setelah artikel yang sedang berjalan selesai"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleGenerateAll}
                  disabled={remainingNew === 0}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
                  title={
                    remainingNew === 0
                      ? "Tidak ada artikel baru tersisa"
                      : `Generate ${remainingNew} artikel baru sekaligus`
                  }
                >
                  Generate Semua ({remainingNew})
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Tutup" className="btn-ghost p-2">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Filter status */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { key: "ALL", label: `Semua (${data.items.length})` },
                  { key: "NEW", label: `Baru (${countNew})` },
                  { key: "DELETED", label: `Dihapus (${countDeleted})` },
                  { key: "IN_PROGRESS", label: `Draf / Review (${countInProgress})` },
                  { key: "PUBLISHED", label: `Dipublikasi (${countPublished})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    filterTab === tab.key
                      ? "border-primary text-primary bg-surface"
                      : "border-border text-txt-secondary hover:border-primary/50 hover:text-txt-primary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-checked={autoPublishNow}
                onClick={() => setAutoPublishNow((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-txt-secondary hover:text-txt-primary"
                title="Jika ON, artikel hasil Generate langsung diterbitkan (PUBLISHED)"
              >
                <span
                  className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                    autoPublishNow ? "bg-primary" : "bg-stone-300"
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      autoPublishNow ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </span>
                <span>
                  Auto-Publish:{" "}
                  <strong className={autoPublishNow ? "text-primary" : "text-txt-muted"}>
                    {autoPublishNow ? "ON" : "OFF"}
                  </strong>
                </span>
              </button>
              {hasTranslatedItems && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-txt-secondary">
                  <input
                    type="checkbox"
                    checked={showOriginalText}
                    onChange={(e) => setShowOriginalText(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  Tampilkan judul asli
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-txt-muted">
              {data.items.length === 0
                ? "Tidak ada artikel terdeteksi. Coba isi CSS selector manual."
                : "Tidak ada artikel pada filter status ini."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredItems.map(({ item, effective }) => {
                const state = itemState[item.url];
                const isRunning = state?.status === "running";
                const resolvedArticleId =
                  state?.status === "done"
                    ? state.articleId || null
                    : effective !== "DELETED" && effective !== "NEW"
                      ? item.articleId || null
                      : null;
                const resolvedSlug =
                  state?.status === "done"
                    ? state.articleSlug ?? null
                    : item.articleSlug ?? null;
                const isRegeneratable = canGenerateItem(item);

                const borderClass =
                  effective === "PUBLISHED"
                    ? "border-primary/40 bg-surface"
                    : effective === "DELETED"
                      ? "border-amber-600/40 bg-surface"
                      : effective === "REJECTED"
                        ? "border-red-500/40 bg-surface"
                        : effective !== "NEW" && effective !== "CLAIMED"
                          ? "border-emerald-600/40 bg-surface"
                          : "border-border bg-surface";

                return (
                  <div
                    key={item.url}
                    className={`group flex flex-col gap-2 rounded-md border p-3 transition-colors ${borderClass}`}
                  >
                    <div className="flex gap-3">
                      {item.thumbnail && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                          onError={(e) =>
                            ((e.target as HTMLImageElement).style.display = "none")
                          }
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-txt-primary">
                          {item.title}
                        </p>
                        {showOriginalText && item.originalTitle && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] italic text-txt-muted">
                            Asli ({data.detectedLangLabel || "Asing"}): {item.originalTitle}
                          </p>
                        )}
                        {item.snippet && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-txt-muted">
                            {item.snippet}
                          </p>
                        )}
                        {showOriginalText && item.originalSnippet && (
                          <p className="mt-0.5 line-clamp-2 text-[10px] italic text-txt-muted">
                            {item.originalSnippet}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-1.5">
                          {renderStatusLabel(item, effective)}
                        </div>
                      </div>
                    </div>

                    {/* Per-card actions */}
                    <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-txt-secondary hover:text-primary"
                      >
                        Lihat sumber <ExternalLink size={10} />
                      </a>
                      {effective === "CLAIMED" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-txt-muted">
                          <Lock size={11} /> Sedang diproses
                        </span>
                      ) : isRunning || isRegeneratable ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleGenerate(item.url, {
                              thumbnail: item.thumbnail,
                              isRegenerate: effective === "DELETED",
                            })
                          }
                          disabled={isRunning || bulkRunning}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                            isRunning
                              ? "border border-primary bg-surface text-primary"
                              : effective === "DELETED"
                                ? "border border-amber-700 bg-surface text-amber-800 hover:bg-surface-secondary"
                                : "bg-primary text-white hover:bg-primary-dark"
                          }`}
                          title={
                            isRunning
                              ? "Sedang generate..."
                              : effective === "DELETED"
                                ? "Artikel sebelumnya sudah dihapus — klik untuk generate ulang menjadi draft baru"
                                : "Generate paraphrase jadi draft"
                          }
                        >
                          {isRunning ? (
                            <>
                              <Loader2 size={11} className="animate-spin" />
                              Generate...
                            </>
                          ) : effective === "DELETED" ? (
                            <>
                              <RefreshCw size={11} /> Generate Lagi
                            </>
                          ) : (
                            <>
                              <Sparkles size={11} /> Generate
                            </>
                          )}
                        </button>
                      ) : effective === "PUBLISHED" ? (
                        <div className="flex items-center gap-1.5">
                          {resolvedSlug && (
                            <Link
                              href={`/berita/${resolvedSlug}`}
                              target="_blank"
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-primary-dark"
                              title="Buka artikel yang sudah terbit"
                            >
                              Lihat Berita
                              <ExternalLink size={10} className="opacity-80" />
                            </Link>
                          )}
                          {resolvedArticleId && (
                            <Link
                              href={`/panel/artikel/${resolvedArticleId}/edit`}
                              target="_blank"
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-txt-primary hover:border-primary hover:text-primary"
                              title="Edit artikel di panel"
                            >
                              Edit
                            </Link>
                          )}
                        </div>
                      ) : resolvedArticleId ? (
                        <Link
                          href={`/panel/artikel/${resolvedArticleId}/edit`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700"
                          title="Buka artikel di editor (tab baru)"
                        >
                          <CheckCircle size={11} />{" "}
                          {effective === "DRAFT"
                            ? "Buka Draf"
                            : effective === "REJECTED"
                              ? "Edit Draf"
                              : effective === "ARCHIVED"
                                ? "Lihat Arsip"
                                : "Buka Artikel"}
                          <ExternalLink size={10} className="opacity-70" />
                        </Link>
                      ) : (
                        <Link
                          href="/panel/artikel?origin=scraper"
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-600/40 bg-surface px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-surface-secondary"
                          title="Buka daftar artikel hasil scraper"
                        >
                          <CheckCircle size={11} /> Lihat di list
                        </Link>
                      )}
                    </div>
                    {state?.status === "error" && state.message && (
                      <p className="text-[10px] text-red-600">{state.message}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
