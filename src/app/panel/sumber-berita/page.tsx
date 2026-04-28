"use client";

/**
 * Sumber Berita Panel — SUPER_ADMIN / CHIEF_EDITOR only
 *
 * Manage the NewsSource list: add a listing URL of an upstream press
 * site (e.g. https://www.bankbjb.co.id/page/berita), preview the
 * articles the scraper detects, and trigger manual scrape runs that
 * paraphrase 1–3 new items per click and drop them as DRAFTs.
 *
 * Cron `/api/cron/scrape-sources` walks all active sources hourly
 * and obeys each source's `frequencyHours` (1–24).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
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
  categoryId: string | null;
  category: Category | null;
  isActive: boolean;
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
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

interface PreviewItem {
  url: string;
  title: string;
  thumbnail?: string;
  snippet?: string;
  alreadyScraped: boolean;
}

interface PreviewResponse {
  selectorUsed: string;
  total: number;
  newCount: number;
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

export default function SumberBeritaPage() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<NewsSource | null>(null);
  const [preview, setPreview] = useState<{
    sourceId: string;
    sourceName: string;
    data: PreviewResponse;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"preview" | "scrape" | "toggle" | "delete" | null>(null);
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
      }
      if (cRes.ok) {
        const json = await cRes.json();
        setCategories(json.data || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  async function handlePreview(s: NewsSource) {
    setBusyId(s.id);
    setBusyAction("preview");
    try {
      const res = await fetch(`/api/news-sources/${s.id}/preview`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showError(json.error || "Preview gagal");
        return;
      }
      setPreview({ sourceId: s.id, sourceName: s.name, data: json.data });
    } catch {
      showError("Gagal preview");
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function handleScrape(s: NewsSource, limit = 3) {
    const ok = await confirm({
      title: "Jalankan scrape?",
      message: `Akan mengambil maksimal ${limit} artikel baru dari ${s.name}, paraphrase via AI, lalu simpan sebagai draft. Lanjut?`,
      variant: "default",
    });
    if (!ok) return;
    setBusyId(s.id);
    setBusyAction("scrape");
    try {
      const res = await fetch(`/api/news-sources/${s.id}/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showError(json.error || "Scrape gagal");
        return;
      }
      const d = json.data;
      if (d.skipped === "no-new-articles") {
        success("Tidak ada artikel baru — semua sudah pernah di-scrape");
      } else {
        success(`Selesai: ${d.ok} draft baru dibuat dari ${d.attempted} percobaan`);
      }
      fetchSources();
    } catch {
      showError("Gagal scrape");
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
      if (!res.ok) {
        const json = await res.json();
        showError(json.error || "Gagal update");
        return;
      }
      success(s.isActive ? "Sumber dinonaktifkan" : "Sumber diaktifkan");
      fetchSources();
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
        const json = await res.json();
        showError(json.error || "Gagal hapus");
        return;
      }
      success("Sumber dihapus");
      fetchSources();
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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-txt-primary sm:text-3xl">
            <Globe size={26} />
            Sumber Berita
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-txt-secondary">
            Tambahkan link halaman daftar berita resmi (mis. <code className="text-xs font-mono">https://www.bankbjb.co.id/page/berita</code>).
            Kartawarta akan otomatis ambil judul, isi, dan gambar, lalu paraphrase via AI menjadi draft baru.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus size={16} /> Tambah Sumber
        </button>
      </div>

      {/* Legal banner */}
      <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">Catatan etis & legal</p>
            <ul className="list-disc pl-5 space-y-1 text-yellow-800">
              <li>Pakai HANYA situs yang merilis berita untuk publik (situs resmi BUMN, Pemda, klub olahraga, dll). Hindari situs media komersial yang konten-nya berhak cipta penuh.</li>
              <li>Setiap draft otomatis dapat footer atribusi link ke sumber asli.</li>
              <li>Sebelum publish, editor wajib review draft — paraphrase AI harus diverifikasi tetap sesuai fakta sumber.</li>
              <li>robots.txt situs sumber dihormati. URL yang diblok robots akan ditolak saat tambah sumber.</li>
            </ul>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border bg-surface p-12 text-center">
          <Globe size={48} className="mx-auto text-txt-muted/40" />
          <p className="mt-4 text-base font-medium text-txt-primary">Belum ada sumber berita</p>
          <p className="mt-1 text-sm text-txt-secondary">
            Tambah link halaman daftar berita untuk mulai auto-paraphrase
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sources.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-surface p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-txt-primary">
                      {s.name}
                    </h3>
                    {s.isActive ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Aktif
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                        Nonaktif
                      </span>
                    )}
                    {s.category && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {s.category.name}
                      </span>
                    )}
                    {s.useHeadless && (
                      <span
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800"
                        title="Render JavaScript via headless Chromium (lambat, untuk SPA)"
                      >
                        JS Render
                      </span>
                    )}
                    {s.crawlSubcategories && (
                      <span
                        className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-800"
                        title={`Deep crawl ke max ${s.crawlMaxPages} halaman sub-kategori`}
                      >
                        Deep Crawl
                      </span>
                    )}
                  </div>
                  <a
                    href={s.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-txt-secondary hover:text-primary break-all"
                  >
                    {s.listingUrl} <ExternalLink size={11} />
                  </a>
                  {s.description && (
                    <p className="mt-2 text-sm text-txt-secondary">{s.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-txt-muted">
                    <span><strong className="text-txt-primary">{s.totalScraped}</strong> draft dibuat</span>
                    <span>Frekuensi tiap <strong className="text-txt-primary">{s.frequencyHours}j</strong></span>
                    <span>Last check: {fmtDate(s.lastCheckedAt)}</span>
                    {s.lastSuccessAt && (
                      <span>Last success: {fmtDate(s.lastSuccessAt)}</span>
                    )}
                  </div>
                  {s.lastError && (
                    <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span className="font-semibold">Error terakhir:</span> {s.lastError}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => handlePreview(s)}
                    disabled={busyId === s.id}
                    className="btn-secondary text-xs disabled:opacity-50"
                    title="Lihat artikel terdeteksi tanpa save"
                  >
                    {busyId === s.id && busyAction === "preview" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Eye size={14} />
                    )}
                    Preview
                  </button>
                  <button
                    onClick={() => handleScrape(s, 3)}
                    disabled={busyId === s.id || !s.isActive}
                    className="btn-primary text-xs disabled:opacity-50"
                    title="Ambil 3 artikel baru sekarang"
                  >
                    {busyId === s.id && busyAction === "scrape" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    Scrape Now
                  </button>
                  <button
                    onClick={() => setEditing(s)}
                    className="btn-ghost text-xs"
                    title="Edit"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => handleToggle(s)}
                    disabled={busyId === s.id}
                    className="btn-ghost text-xs disabled:opacity-50"
                    title={s.isActive ? "Nonaktifkan" : "Aktifkan"}
                  >
                    {s.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(s)}
                    disabled={busyId === s.id}
                    className="btn-ghost text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="Hapus"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cron trigger info */}
      <div className="mt-8 rounded-xl bg-surface-container-low p-5 text-sm text-txt-secondary">
        <div className="flex items-start gap-2">
          <RefreshCw size={16} className="mt-0.5 text-primary flex-shrink-0" />
          <div>
            <p className="font-semibold text-txt-primary">Cron otomatis</p>
            <p className="mt-1">
              Endpoint <code className="rounded bg-surface-tertiary px-1.5 py-0.5 text-xs font-mono">POST /api/cron/scrape-sources</code> sudah dilindungi <code className="text-xs font-mono">CRON_SECRET</code>.
              Setting di crontab VPS (per jam):
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-primary px-3 py-2 text-[11px] text-white">{`0 * * * * curl -s -X POST https://kartawarta.com/api/cron/scrape-sources -H "Authorization: Bearer $CRON_SECRET" >> /var/log/karta-scrape.log 2>&1`}</pre>
            <p className="mt-2 text-xs">
              Tiap jam cron akan walk semua sumber aktif yang sudah lewat <em>frequencyHours</em>-nya, ambil maks 2 artikel baru per sumber, dan stop setelah total 6 draft.
            </p>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {(showAdd || editing) && (
        <SourceFormModal
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
          data={preview.data}
          onClose={() => setPreview(null)}
          onScraped={fetchSources}
        />
      )}
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
  const [frequencyHours, setFrequencyHours] = useState(source?.frequencyHours ?? 4);
  const [priority, setPriority] = useState(source?.priority ?? 0);
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
  const [crawlMaxPages, setCrawlMaxPages] = useState(source?.crawlMaxPages ?? 8);
  const [saving, setSaving] = useState(false);
  const { success, error: showError } = useToast();

  async function handleSave() {
    if (!name.trim() || !listingUrl.trim()) {
      showError("Nama dan URL wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        listingUrl: listingUrl.trim(),
        description: description.trim() || null,
        categoryId: categoryId || null,
        frequencyHours: Math.max(1, Math.min(24, Number(frequencyHours) || 4)),
        priority: Number(priority) || 0,
        defaultTags: defaultTagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10),
        articleSelector: articleSelector.trim() || null,
        titleSelector: titleSelector.trim() || null,
        contentSelector: contentSelector.trim() || null,
        imageSelector: imageSelector.trim() || null,
        useHeadless,
        waitForSelector: waitForSelector.trim() || null,
        crawlSubcategories,
        crawlMaxPages: Math.max(1, Math.min(20, Number(crawlMaxPages) || 8)),
      };
      const res = await fetch(
        isEdit ? `/api/news-sources/${source!.id}` : "/api/news-sources",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        showError(json.error || "Gagal simpan");
        return;
      }
      success(isEdit ? "Sumber diperbarui" : "Sumber ditambahkan");
      onSaved();
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
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-bold text-txt-primary">
            {isEdit ? "Edit Sumber Berita" : "Tambah Sumber Berita"}
          </h2>
          <button onClick={onClose} className="btn-ghost p-2">
            <X size={18} />
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
                value={frequencyHours}
                onChange={(e) => setFrequencyHours(Number(e.target.value))}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-txt-primary">
              Default Tags (opsional, pisah koma)
            </label>
            <input
              type="text"
              value={defaultTagsRaw}
              onChange={(e) => setDefaultTagsRaw(e.target.value)}
              placeholder="bank bjb, perbankan, jawa barat"
              className="input"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-txt-primary">
              Deskripsi (opsional)
            </label>
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
                className="mt-0.5 rounded"
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
                className="mt-0.5 rounded"
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
                  Max halaman di-crawl (1–20)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={crawlMaxPages}
                  onChange={(e) =>
                    setCrawlMaxPages(
                      Math.max(1, Math.min(20, Math.floor(Number(e.target.value) || 8))),
                    )
                  }
                  className="input w-24"
                />
                <p className="mt-1 text-[10px] text-txt-muted">
                  Cap total halaman dikunjungi (root + sub-kategori). Default 8 — cukup untuk 8 kategori berita.
                </p>
              </div>
            )}
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
  data,
  onClose,
  onScraped,
}: {
  sourceId: string;
  sourceName: string;
  data: PreviewResponse;
  onClose: () => void;
  onScraped: () => void;
}) {
  const { success, error: showError } = useToast();
  // Track per-item state: idle | running | done | error.
  // Keyed by URL so the source listing order stays stable.
  // `articleId` is set when scrape-one succeeds so the card can link
  // straight to the editor.
  interface ItemState {
    status: "idle" | "running" | "done" | "error";
    message?: string;
    articleId?: string;
  }
  const [itemState, setItemState] = useState<Record<string, ItemState>>({});
  // Mutable copy of "alreadyScraped" so the UI flips immediately after a
  // successful generate without requiring a full preview refetch.
  const [scrapedSet, setScrapedSet] = useState<Set<string>>(
    () => new Set(data.items.filter((i) => i.alreadyScraped).map((i) => i.url)),
  );
  // Bulk-generate progress state.
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const bulkAbortRef = useRef(false);

  async function handleGenerate(url: string) {
    setItemState((s) => ({ ...s, [url]: { status: "running" } }));
    try {
      const res = await fetch(`/api/news-sources/${sourceId}/scrape-one`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        const errMsg = json.error || `HTTP ${res.status}`;
        setItemState((s) => ({
          ...s,
          [url]: { status: "error", message: errMsg },
        }));
        showError(`Gagal generate: ${errMsg}`);
        return;
      }
      const d = json.data;
      if (d.skipped === "already-scraped") {
        setScrapedSet((prev) => new Set(prev).add(url));
        // No articleId returned on the dedup early-exit — fall back to URL-based
        // link to the panel article list filtered by source URL won't work, so
        // mark "done" without an articleId; user opens via panel artikel list.
        setItemState((s) => ({ ...s, [url]: { status: "done" } }));
        return;
      }
      setScrapedSet((prev) => new Set(prev).add(url));
      setItemState((s) => ({
        ...s,
        [url]: { status: "done", articleId: d.articleId },
      }));
      success(`Draft dibuat: "${d.title}"`);
      onScraped();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Network error";
      setItemState((s) => ({
        ...s,
        [url]: { status: "error", message: errMsg },
      }));
      showError(`Gagal generate: ${errMsg}`);
    }
  }

  /** Sequentially generate every "BARU" item left in the preview.
   * Sequential not parallel because each generate triggers an AI paraphrase
   * call — parallel would hammer the AI provider's rate limit and the source
   * site's connections. Small breather between calls for the same reason.
   * Stops when the user clicks "Stop" (sets bulkAbortRef.current = true). */
  async function handleGenerateAll() {
    const targets = data.items.filter(
      (item) => !scrapedSet.has(item.url) && itemState[item.url]?.status !== "running",
    );
    if (targets.length === 0) {
      showError("Tidak ada artikel baru untuk di-generate.");
      return;
    }
    bulkAbortRef.current = false;
    setBulkRunning(true);
    setBulkProgress({ done: 0, total: targets.length, failed: 0 });
    let done = 0;
    let failed = 0;
    for (const item of targets) {
      if (bulkAbortRef.current) break;
      try {
        await handleGenerate(item.url);
        // Give the upstream site + AI a short rest between requests.
        await new Promise((r) => setTimeout(r, 350));
      } catch {
        failed++;
      }
      done++;
      setBulkProgress({ done, total: targets.length, failed });
    }
    setBulkRunning(false);
    const aborted = bulkAbortRef.current;
    bulkAbortRef.current = false;
    if (aborted) {
      showError(`Dihentikan setelah ${done}/${targets.length} artikel.`);
    } else {
      success(`Selesai: ${done - failed} sukses${failed ? `, ${failed} gagal` : ""}.`);
    }
  }

  const remainingNew = data.items.filter(
    (i) => !scrapedSet.has(i.url) && itemState[i.url]?.status !== "running",
  ).length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-txt-primary">
              Preview — {sourceName}
            </h2>
            <p className="text-xs text-txt-secondary">
              {data.total} artikel terdeteksi · {data.newCount} baru ·
              selector: <code className="font-mono">{data.selectorUsed}</code>
            </p>
            <p className="mt-0.5 text-[11px] text-txt-muted">
              Klik <strong>Generate</strong> per artikel atau{" "}
              <strong>Generate Semua</strong> untuk semua sekaligus.
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
            {bulkRunning ? (
              <button
                onClick={() => {
                  bulkAbortRef.current = true;
                }}
                className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
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
            <button onClick={onClose} className="btn-ghost p-2">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {data.items.length === 0 ? (
            <div className="py-12 text-center text-txt-muted">
              Tidak ada artikel terdeteksi. Coba isi CSS selector manual.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.items.map((item, i) => {
                const isScraped = scrapedSet.has(item.url);
                const state = itemState[item.url];
                const isRunning = state?.status === "running";
                const isDone = state?.status === "done" || isScraped;

                return (
                  <div
                    key={i}
                    className={`group flex flex-col gap-2 rounded-md border p-3 transition-colors ${
                      isDone
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex gap-3">
                      {item.thumbnail && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="h-16 w-16 flex-shrink-0 rounded object-cover"
                          onError={(e) =>
                            ((e.target as HTMLImageElement).style.display = "none")
                          }
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-txt-primary">
                          {item.title}
                        </p>
                        {item.snippet && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-txt-muted">
                            {item.snippet}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-1.5">
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                              <CheckCircle size={10} /> Sudah jadi draft
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                              ◉ Baru
                            </span>
                          )}
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
                      {isDone && state?.articleId ? (
                        <Link
                          href={`/panel/artikel/${state.articleId}/edit`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700"
                          title="Buka draft di editor (tab baru)"
                        >
                          <CheckCircle size={11} /> Buka Draft
                          <ExternalLink size={10} className="opacity-70" />
                        </Link>
                      ) : isDone ? (
                        // Already-scraped early-exit: no articleId surfaced.
                        // Send user to the article list filtered to scraper output.
                        <Link
                          href="/panel/artikel?status=DRAFT&origin=scraper"
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-200"
                          title="Buka daftar draft hasil scraper"
                        >
                          <CheckCircle size={11} /> Lihat di list
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleGenerate(item.url)}
                          disabled={isRunning}
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${
                            isRunning
                              ? "bg-primary/10 text-primary"
                              : "bg-primary text-white hover:bg-primary-dark"
                          }`}
                          title={
                            isRunning
                              ? "Sedang generate..."
                              : "Generate paraphrase jadi draft"
                          }
                        >
                          {isRunning ? (
                            <>
                              <Loader2 size={11} className="animate-spin" />
                              Generate...
                            </>
                          ) : (
                            <>
                              <Sparkles size={11} /> Generate
                            </>
                          )}
                        </button>
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
