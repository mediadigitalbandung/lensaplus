"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import NextImage from "next/image";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import ImageCropModal from "./ImageCropModal";

interface ImageUploaderProps {
  onUpload: (url: string) => void;
  currentImage?: string;
  /** Default crop aspect; pass 0 to disable crop step entirely */
  cropAspect?: number;
}

function compressImage(file: File | Blob, maxWidth = 1200, quality = 0.8): Promise<Blob> {
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(blob);
  });
}

export default function ImageUploader({
  onUpload,
  currentImage,
  cropAspect = 16 / 9,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string>(currentImage || "");
  const [sizeInfo, setSizeInfo] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState("image.webp");
  const [originalSize, setOriginalSize] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pending stage: file is compressed and ready, waiting for required metadata
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string>("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");

  // Cleanup any pending preview URL on unmount
  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  // Stage a blob (post-crop or post-direct) — compress + show metadata form
  const stageBlob = useCallback(
    async (blob: Blob, srcSize: number) => {
      setError("");
      setUploading(true);
      try {
        const compressed = await compressImage(blob);
        const compressedSize = compressed.size;

        setSizeInfo(
          `${formatSize(srcSize)} → ${formatSize(compressedSize)} (${Math.round(
            (1 - compressedSize / srcSize) * 100
          )}% lebih kecil)`
        );

        if (compressedSize > 2 * 1024 * 1024) {
          setError("Gambar masih terlalu besar setelah kompres. Gunakan gambar yang lebih kecil.");
          return;
        }

        if (pendingPreview) URL.revokeObjectURL(pendingPreview);
        setPendingBlob(compressed);
        setPendingPreview(URL.createObjectURL(compressed));
      } catch {
        setError("Terjadi kesalahan saat memproses gambar");
      } finally {
        setUploading(false);
      }
    },
    [pendingPreview]
  );

  // Final commit — POST to /api/upload with metadata
  const commitUpload = useCallback(async () => {
    if (!pendingBlob) return;
    const t = title.trim();
    const c = caption.trim();
    const s = credit.trim();
    if (!t || !c || !s) {
      setError("Judul, keterangan, dan sumber wajib diisi.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", pendingBlob, originalName);
      formData.append("title", t);
      formData.append("caption", c);
      formData.append("credit", s);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Gagal mengupload gambar");
        return;
      }

      setPreview(data.data.url);
      onUpload(data.data.url);

      // Reset pending stage
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingBlob(null);
      setPendingPreview("");
      setTitle("");
      setCaption("");
      setCredit("");
    } catch {
      setError("Terjadi kesalahan saat mengupload gambar");
    } finally {
      setUploading(false);
    }
  }, [pendingBlob, originalName, pendingPreview, title, caption, credit, onUpload]);

  // Step 1: validate file, then either open crop modal or skip directly to metadata form
  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setSizeInfo("");

      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(file.type)) {
        setError("Format tidak didukung. Gunakan JPEG, PNG, atau WebP.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("File terlalu besar (maks 10MB sebelum kompres)");
        return;
      }

      setOriginalName(file.name.replace(/\.[^.]+$/, ".webp"));
      setOriginalSize(file.size);

      if (cropAspect === 0) {
        // Skip crop, go directly to metadata stage
        await stageBlob(file, file.size);
        return;
      }

      // Open crop modal
      try {
        const dataUrl = await blobToDataUrl(file);
        setCropSrc(dataUrl);
      } catch {
        setError("Gagal memproses gambar untuk crop");
      }
    },
    [cropAspect, stageBlob]
  );

  const handleCropConfirm = useCallback(
    async (croppedBlob: Blob) => {
      setCropSrc(null);
      await stageBlob(croppedBlob, originalSize || croppedBlob.size);
    },
    [stageBlob, originalSize]
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const removeImage = () => {
    setPreview("");
    setSizeInfo("");
    onUpload("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const cancelPending = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingBlob(null);
    setPendingPreview("");
    setTitle("");
    setCaption("");
    setCredit("");
    setError("");
    setSizeInfo("");
    if (inputRef.current) inputRef.current.value = "";
  };

  // PRIORITY 1: pendingBlob → show metadata form
  if (pendingBlob) {
    return (
      <div className="space-y-3 rounded-[12px] border border-primary/30 bg-primary-light/30 p-4">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pendingPreview}
            alt="Preview"
            className="h-24 w-24 flex-shrink-0 rounded-md object-cover ring-1 ring-border"
          />
          <div className="flex-1 text-[11px] text-txt-muted">
            <p className="font-medium text-txt-primary">Gambar siap diupload</p>
            {sizeInfo && <p className="mt-0.5">{sizeInfo}</p>}
            <button
              type="button"
              onClick={cancelPending}
              disabled={uploading}
              className="mt-1 text-[11px] text-txt-secondary underline hover:text-txt-primary disabled:opacity-50"
            >
              Ganti gambar
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
            Judul Gambar <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            placeholder="Contoh: Gedung MK saat sidang putusan"
            className="input text-sm"
            disabled={uploading}
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
            Keterangan <span className="text-red-600">*</span>
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Deskripsi singkat — siapa, apa, dimana, kapan."
            className="input w-full text-sm"
            disabled={uploading}
          />
          <p className="mt-0.5 text-[10px] text-txt-muted">{caption.length}/1000</p>
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-semibold text-txt-primary">
            Sumber <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            maxLength={255}
            placeholder="Contoh: ANTARA/Andika Wahyu, Reuters, Dok. Pribadi"
            className="input text-sm"
            disabled={uploading}
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={cancelPending}
            disabled={uploading}
            className="btn-ghost text-xs disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={commitUpload}
            disabled={uploading || !title.trim() || !caption.trim() || !credit.trim()}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={12} className="animate-spin" /> Mengupload...
              </>
            ) : (
              <>
                <Upload size={12} /> Upload
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // PRIORITY 2: preview from currentImage / just-uploaded → show preview
  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative">
          <NextImage
            src={preview}
            alt="Preview"
            width={800}
            height={400}
            className="w-full rounded-[8px] object-cover"
            style={{ maxHeight: 200 }}
            unoptimized
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-[12px] border-2 border-dashed p-6 transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
        >
          {uploading ? (
            <Loader2 size={24} className="animate-spin text-primary" />
          ) : (
            <ImageIcon size={24} className="text-txt-muted" />
          )}
          <p className="mt-2 text-center text-xs text-txt-secondary">
            {uploading ? "Memproses..." : "Klik atau drag gambar ke sini"}
          </p>
          <p className="mt-1 text-center text-[10px] text-txt-muted">
            JPEG, PNG, WebP — Maks 2MB (otomatis dikompres)
          </p>
        </div>
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

      {error && <p className="text-xs text-red-400">{error}</p>}

      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          aspectRatio={cropAspect}
          onCancel={() => {
            setCropSrc(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
