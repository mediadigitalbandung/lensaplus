"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  ImageIcon,
  Trash2,
  Copy,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Upload,
  Filter,
  Pencil,
  X,
  Save,
  Search,
} from "lucide-react";
import ImageUploader from "@/components/editor/ImageUploader";

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  title: string | null;
  caption: string | null;
  credit: string | null;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-border bg-surface shadow-card overflow-hidden"
        >
          <div className="aspect-square bg-surface-tertiary" />
          <div className="p-3">
            <div className="h-3 w-2/3 rounded-lg bg-surface-tertiary" />
            <div className="mt-1.5 h-2.5 w-1/2 rounded-lg bg-surface-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MediaPage() {
  const { data: session } = useSession();
  const { success, error: showError } = useToast();
  const { confirm } = useConfirm();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterUser, setFilterUser] = useState<string>("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editCredit, setEditCredit] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  const isAdmin = session?.user?.role === "SUPER_ADMIN";

  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterUser) params.set("uploadedBy", filterUser);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/media?${params}`);
      if (!res.ok) throw new Error("Gagal memuat media");
      const json = await res.json();
      setMedia(json.data?.media || []);
      setTotalPages(json.data?.pagination?.totalPages || 1);
    } catch (err) {
      setError("Gagal memuat media library. Silakan coba lagi.");
      // Error handled by state
    } finally {
      setLoading(false);
    }
  }, [page, filterUser, debouncedSearch]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Debounce the search box → server-side query across every page.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  async function handleDelete(id: string) {
    const ok = await confirm({ message: "Hapus media ini secara permanen?", variant: "danger", title: "Konfirmasi" });
    if (!ok) return;
    try {
      setDeleting(id);
      const res = await fetch(`/api/media?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Gagal menghapus media");
      }
      setMedia((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Gagal menghapus media");
    } finally {
      setDeleting(null);
    }
  }

  function handleCopyUrl(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  function openEdit(item: MediaItem) {
    setEditing(item);
    setEditTitle(item.title || "");
    setEditCaption(item.caption || "");
    setEditCredit(item.credit || "");
  }

  function closeEdit() {
    setEditing(null);
    setEditTitle("");
    setEditCaption("");
    setEditCredit("");
  }

  async function saveMetadata() {
    if (!editing) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/media/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          caption: editCaption,
          credit: editCredit,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showError(json.error || "Gagal menyimpan metadata");
        return;
      }
      setMedia((prev) =>
        prev.map((m) => (m.id === editing.id ? { ...m, ...json.data } : m))
      );
      success("Metadata gambar tersimpan");
      closeEdit();
    } catch {
      showError("Gagal menyimpan metadata");
    } finally {
      setSavingMeta(false);
    }
  }

  function handleUploadComplete() {
    // /api/upload already registers the media record — just refresh the list
    setShowUpload(false);
    fetchMedia();
  }

  // Get unique uploaders for filter
  const uniqueUploaders = Array.from(
    new Map(
      media.map((m) => [m.uploadedBy, { id: m.uploadedBy, name: m.uploaderName }])
    ).values()
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-txt-primary flex items-center gap-2">
            <ImageIcon size={24} />
            Media Library
          </h1>
          <p className="text-base text-txt-secondary">
            {loading ? "Memuat..." : `${media.length} media ditemukan`}
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="btn-primary flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
        >
          <Upload size={16} />
          Upload
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari media (judul, nama file, caption, sumber)..."
          className="input w-full pl-9"
          aria-label="Cari media"
        />
      </div>

      {/* Upload area */}
      {showUpload && (
        <div className="mb-6 rounded-lg border-2 border-dashed border-primary/30 bg-primary-50 p-6">
          <h3 className="mb-3 text-base font-bold text-txt-primary">
            Upload Gambar Baru
          </h3>
          <ImageUploader
            onUpload={handleUploadComplete}
            currentImage=""
          />
          <button
            onClick={() => setShowUpload(false)}
            className="mt-3 text-sm text-txt-muted hover:text-txt-secondary"
          >
            Tutup
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center text-base text-red-700">
          <p>{error}</p>
          <button
            onClick={fetchMedia}
            className="mt-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Filter by user */}
      {uniqueUploaders.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <Filter size={16} className="text-txt-muted" />
          <button
            onClick={() => { setFilterUser(""); setPage(1); }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !filterUser
                ? "bg-primary text-white"
                : "bg-surface-tertiary text-txt-secondary hover:bg-border"
            }`}
          >
            Semua
          </button>
          {uniqueUploaders.map((u) => (
            <button
              key={u.id}
              onClick={() => { setFilterUser(u.id); setPage(1); }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filterUser === u.id
                  ? "bg-primary text-white"
                  : "bg-surface-tertiary text-txt-secondary hover:bg-border"
              }`}
            >
              {u.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : media.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center text-base text-txt-secondary shadow-card">
          {debouncedSearch
            ? `Tidak ada media yang cocok dengan "${debouncedSearch}".`
            : "Belum ada media yang diupload."}
        </div>
      ) : (
        <>
          {/* Media grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {media.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-lg border border-border bg-surface shadow-card overflow-hidden transition-all hover:shadow-lg"
              >
                {/* Thumbnail */}
                <div className="relative aspect-square bg-surface-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.title || item.filename}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23666'%3E%3Crect width='100' height='100' fill='%23222'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='12' fill='%23666'%3ENo Preview%3C/text%3E%3C/svg%3E";
                    }}
                  />
                  {/* Overlay actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleCopyUrl(item.url, item.id)}
                      className="rounded-lg bg-white/90 p-2 text-txt-primary hover:bg-white"
                      title="Salin URL"
                    >
                      {copied === item.id ? (
                        <CheckCircle size={18} className="text-primary" />
                      ) : (
                        <Copy size={18} />
                      )}
                    </button>
                    {(item.uploadedBy === session?.user?.id || isAdmin) && (
                      <>
                        <button
                          onClick={() => openEdit(item)}
                          className="rounded-lg bg-white/90 p-2 text-txt-primary hover:bg-white"
                          title="Edit judul / caption / sumber"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={deleting === item.id}
                          className="rounded-lg bg-red-500/90 p-2 text-white hover:bg-red-600 disabled:opacity-50"
                          title="Hapus"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-txt-primary">
                    {item.title || item.filename}
                  </p>
                  {item.caption && (
                    <p className="mt-1 line-clamp-2 text-xs text-txt-secondary">
                      {item.caption}
                    </p>
                  )}
                  {item.credit && (
                    <p className="mt-0.5 truncate text-[11px] font-medium text-primary">
                      Sumber: {item.credit}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-txt-muted">
                    {item.uploaderName} · {formatDate(item.createdAt)}
                    {item.size > 0 && ` · ${formatSize(item.size)}`}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Edit metadata modal */}
          {editing && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
              onClick={closeEdit}
            >
              <div
                className="w-full max-w-md overflow-hidden rounded-lg bg-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-3">
                  <h2 className="text-base font-bold text-txt-primary">
                    Edit Metadata Gambar
                  </h2>
                  <button
                    type="button"
                    onClick={closeEdit}
                    className="rounded-md p-2 text-txt-secondary hover:bg-surface-secondary"
                    aria-label="Tutup"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  {/* Preview */}
                  <div className="flex items-start gap-3 rounded-md bg-surface-container-low p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editing.url}
                      alt={editing.filename}
                      className="h-16 w-16 shrink-0 rounded-sm object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-mono text-txt-muted">
                        {editing.filename}
                      </p>
                      <p className="mt-0.5 text-[10px] text-txt-muted">
                        {editing.uploaderName} · {formatDate(editing.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-txt-primary">
                      Judul Gambar
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      maxLength={255}
                      placeholder="Contoh: Walikota meninjau jembatan baru"
                      className="input w-full"
                    />
                    <p className="mt-1 text-[11px] text-txt-muted">
                      Akan dipakai sebagai alt-text untuk SEO & aksesibilitas.
                    </p>
                  </div>

                  {/* Caption */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-txt-primary">
                      Caption
                    </label>
                    <textarea
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="Deskripsi gambar yang akan tampil di bawah foto saat disisipkan ke artikel"
                      className="input w-full resize-none"
                    />
                    <p className="mt-1 text-[11px] text-txt-muted">
                      {editCaption.length}/1000 karakter
                    </p>
                  </div>

                  {/* Credit / Sumber */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-txt-primary">
                      Sumber / Kredit
                    </label>
                    <input
                      type="text"
                      value={editCredit}
                      onChange={(e) => setEditCredit(e.target.value)}
                      maxLength={255}
                      placeholder="Contoh: Antara/Akbar Nugroho atau Dok. Pemkot"
                      className="input w-full"
                    />
                    <p className="mt-1 text-[11px] text-txt-muted">
                      Nama fotografer, agensi, atau sumber gambar.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-border bg-surface-container-low px-5 py-3">
                  <button
                    type="button"
                    onClick={closeEdit}
                    disabled={savingMeta}
                    className="btn-ghost text-sm disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={saveMetadata}
                    disabled={savingMeta}
                    className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
                  >
                    <Save size={14} />
                    {savingMeta ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-border bg-surface p-2 text-txt-secondary hover:bg-surface-secondary disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-base text-txt-secondary">
                Halaman {page} dari {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-border bg-surface p-2 text-txt-secondary hover:bg-surface-secondary disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
