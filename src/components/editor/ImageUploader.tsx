"use client";

import { useState, useRef, useCallback } from "react";
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

  // Step 2: upload (after optional crop)
  const uploadBlob = useCallback(
    async (blob: Blob, srcSize: number) => {
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
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", compressed, originalName);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Gagal mengupload gambar");
          setUploading(false);
          return;
        }

        setPreview(data.data.url);
        onUpload(data.data.url);
      } catch {
        setError("Terjadi kesalahan saat mengupload gambar");
      } finally {
        setUploading(false);
      }
    },
    [onUpload, originalName]
  );

  // Step 1: validate, then either open crop modal or skip directly to upload
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
        // No crop step
        await uploadBlob(file, file.size);
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
    [cropAspect, uploadBlob]
  );

  const handleCropConfirm = useCallback(
    async (croppedBlob: Blob) => {
      setCropSrc(null);
      await uploadBlob(croppedBlob, originalSize || croppedBlob.size);
    },
    [uploadBlob, originalSize]
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
            {uploading ? "Mengupload..." : "Klik atau drag gambar ke sini"}
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

      {sizeInfo && (
        <p className="text-[10px] text-primary">{sizeInfo}</p>
      )}

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

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

      {!preview && !cropSrc && uploading && (
        <div className="flex items-center justify-center py-2 text-xs text-txt-secondary">
          <Loader2 size={12} className="mr-1 animate-spin" />
          Memproses upload...
        </div>
      )}
    </div>
  );
}
