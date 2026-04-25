"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Upload, ImageIcon, Loader2, Search, ChevronLeft, ChevronRight, Check } from "lucide-react";

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  title: string | null;
  caption: string | null;
  credit: string | null;
  uploaderName: string;
  createdAt: string;
}

export interface PickedImage {
  url: string;
  title?: string | null;
  caption?: string | null;
  credit?: string | null;
}

interface ImagePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (urlOrImage: string | PickedImage) => void;
}

type Tab = "upload" | "gallery";

function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export default function ImagePickerModal({ open, onClose, onSelect }: ImagePickerModalProps) {
  const [tab, setTab] = useState<Tab>("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Gallery state
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [galleryError, setGalleryError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const fetchGallery = useCallback(async () => {
    try {
      setLoadingGallery(true);
      setGalleryError("");
      const res = await fetch(`/api/media?page=${page}&limit=24`);
      if (!res.ok) throw new Error("Gagal memuat galeri");
      const json = await res.json();
      setMedia(json.data?.media || []);
      setTotalPages(json.data?.pagination?.totalPages || 1);
    } catch {
      setGalleryError("Gagal memuat galeri. Coba lagi.");
    } finally {
      setLoadingGallery(false);
    }
  }, [page]);

  useEffect(() => {
    if (open && tab === "gallery") {
      fetchGallery();
    }
  }, [open, tab, fetchGallery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelected(null);
      setUploadError("");
      setQuery("");
    }
  }, [open]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const handleFile = useCallback(
    async (file: File) => {
      setUploadError("");
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setUploadError("Format tidak didukung. Gunakan JPEG, PNG, atau WebP.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setUploadError("File terlalu besar (maks 10MB sebelum kompres)");
        return;
      }

      setUploading(true);
      try {
        const compressed = await compressImage(file);
        if (compressed.size > 2 * 1024 * 1024) {
          setUploadError("Gambar masih terlalu besar setelah kompres. Coba gambar lebih kecil.");
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", compressed, file.name.replace(/\.[^.]+$/, ".webp"));

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setUploadError(data.error || "Gagal mengupload gambar");
          setUploading(false);
          return;
        }

        onSelect(data.data.url);
        onClose();
      } catch {
        setUploadError("Terjadi kesalahan saat mengupload gambar");
      } finally {
        setUploading(false);
      }
    },
    [onSelect, onClose]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleGallerySelect = () => {
    if (!selected) return;
    onSelect({
      url: selected.url,
      title: selected.title,
      caption: selected.caption,
      credit: selected.credit,
    });
    onClose();
  };

  const filteredMedia = query.trim()
    ? media.filter(
        (m) =>
          m.filename.toLowerCase().includes(query.toLowerCase()) ||
          m.uploaderName.toLowerCase().includes(query.toLowerCase())
      )
    : media;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                tab === "upload"
                  ? "bg-primary text-white"
                  : "text-txt-secondary hover:bg-surface-secondary"
              }`}
            >
              <Upload size={14} />
              Upload Baru
            </button>
            <button
              type="button"
              onClick={() => setTab("gallery")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                tab === "gallery"
                  ? "bg-primary text-white"
                  : "text-txt-secondary hover:bg-surface-secondary"
              }`}
            >
              <ImageIcon size={14} />
              Galeri
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-txt-secondary hover:bg-surface-secondary"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "upload" ? (
            <div className="flex h-full min-h-[300px] items-center justify-center">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onClick={() => inputRef.current?.click()}
                className={`flex w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 size={36} className="animate-spin text-primary" />
                    <p className="mt-4 text-sm font-medium text-txt-primary">
                      Mengupload gambar...
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
                      <Upload size={28} className="text-primary" />
                    </div>
                    <p className="text-base font-semibold text-txt-primary">
                      Klik atau drag gambar ke sini
                    </p>
                    <p className="mt-1 text-xs text-txt-muted">
                      JPEG, PNG, WebP · maks 10MB (otomatis dikompres ke WebP &lt;2MB)
                    </p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </div>
              {uploadError && (
                <p className="absolute bottom-6 text-sm text-red-600">{uploadError}</p>
              )}
            </div>
          ) : (
            <div>
              {/* Search */}
              <div className="relative mb-4">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari di galeri..."
                  className="input pl-9"
                />
              </div>

              {loadingGallery ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square animate-pulse rounded-md bg-surface-tertiary"
                    />
                  ))}
                </div>
              ) : galleryError ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-red-600">{galleryError}</p>
                  <button
                    type="button"
                    onClick={fetchGallery}
                    className="btn-secondary mt-3 text-sm"
                  >
                    Coba lagi
                  </button>
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="py-16 text-center">
                  <ImageIcon size={40} className="mx-auto text-border" />
                  <p className="mt-3 text-sm text-txt-secondary">
                    {query ? "Tidak ada media cocok dengan pencarian." : "Galeri masih kosong."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab("upload")}
                    className="btn-primary mt-4 text-sm"
                  >
                    Upload yang pertama
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {filteredMedia.map((m) => {
                      const isSelected = selected?.id === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelected(m)}
                          onDoubleClick={() => {
                            onSelect({
                              url: m.url,
                              title: m.title,
                              caption: m.caption,
                              credit: m.credit,
                            });
                            onClose();
                          }}
                          className={`group relative aspect-square overflow-hidden rounded-md border-2 transition-all ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-transparent hover:border-primary/50"
                          }`}
                          title={m.title || m.filename}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.url}
                            alt={m.title || m.filename}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          {isSelected && (
                            <div className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-md">
                              <Check size={14} />
                            </div>
                          )}
                          {m.credit && (
                            <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                              {m.credit}
                            </span>
                          )}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <p className="truncate text-[10px] font-semibold text-white">
                              {m.title || m.filename}
                            </p>
                            {m.caption && (
                              <p className="line-clamp-2 text-[9px] text-white/80">
                                {m.caption}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-5 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="btn-ghost rounded-md p-2 disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm text-txt-secondary">
                        Halaman {page} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="btn-ghost rounded-md p-2 disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer (gallery tab only) */}
        {tab === "gallery" && (
          <div className="flex items-center justify-between border-t border-border bg-surface-container-low px-5 py-3">
            <p className="text-xs text-txt-muted">
              {selected
                ? selected.caption || selected.credit
                  ? "Caption & sumber otomatis disisipkan"
                  : "Gambar dipilih — klik Sisipkan"
                : "Pilih gambar untuk disisipkan (double-click langsung)"}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-ghost text-sm">
                Batal
              </button>
              <button
                type="button"
                onClick={handleGallerySelect}
                disabled={!selected}
                className="btn-primary text-sm disabled:opacity-50"
              >
                Sisipkan Gambar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
