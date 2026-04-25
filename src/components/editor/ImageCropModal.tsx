"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Crop, Loader2 } from "lucide-react";

interface ImageCropModalProps {
  imageSrc: string;
  aspectRatio?: number;
  onCancel: () => void;
  onConfirm: (croppedBlob: Blob) => void;
}

interface AspectOption {
  label: string;
  value: number;
}

const ASPECT_OPTIONS: AspectOption[] = [
  { label: "16:9 (Landscape)", value: 16 / 9 },
  { label: "1:1 (Square)", value: 1 },
  { label: "4:5 (Portrait)", value: 4 / 5 },
  { label: "1.91:1 (Social)", value: 1.91 },
  { label: "Bebas", value: 0 },
];

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragHandle = "move" | "tl" | "tr" | "bl" | "br" | null;

/**
 * Lightweight image-crop modal — pure HTML5 canvas + drag handles.
 * No external library; output is a JPEG/WEBP Blob.
 */
export default function ImageCropModal({
  imageSrc,
  aspectRatio: initialRatio = 16 / 9,
  onCancel,
  onConfirm,
}: ImageCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [aspect, setAspect] = useState<number>(initialRatio);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [imgDims, setImgDims] = useState({ w: 0, h: 0, naturalW: 0, naturalH: 0 });
  const [dragging, setDragging] = useState<DragHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, crop: crop });
  const [processing, setProcessing] = useState(false);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // ESC closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  // Recalculate crop when image loads or aspect changes
  const initCrop = useCallback(
    (w: number, h: number, ratio: number) => {
      if (!w || !h) return;
      let cw: number, ch: number;
      if (ratio === 0) {
        // Free aspect — default to 80% of image
        cw = w * 0.8;
        ch = h * 0.8;
      } else if (w / h > ratio) {
        // Image wider than ratio — fit by height
        ch = h * 0.9;
        cw = ch * ratio;
      } else {
        // Image taller — fit by width
        cw = w * 0.9;
        ch = cw / ratio;
      }
      setCrop({
        x: (w - cw) / 2,
        y: (h - ch) / 2,
        width: cw,
        height: ch,
      });
    },
    []
  );

  const handleImageLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const dims = {
      w: rect.width,
      h: rect.height,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
    };
    setImgDims(dims);
    initCrop(dims.w, dims.h, aspect);
    setImgLoaded(true);
  };

  // Re-init when aspect changes
  useEffect(() => {
    if (imgLoaded) initCrop(imgDims.w, imgDims.h, aspect);
  }, [aspect, imgLoaded, imgDims.w, imgDims.h, initCrop]);

  // ─── Drag handlers ───
  const onPointerDown = (handle: DragHandle) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(handle);
    setDragStart({ x: e.clientX, y: e.clientY, crop: { ...crop } });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const next = { ...dragStart.crop };
      const maxW = imgDims.w;
      const maxH = imgDims.h;

      const clamp = (v: number, min: number, max: number) =>
        Math.max(min, Math.min(max, v));

      if (dragging === "move") {
        next.x = clamp(dragStart.crop.x + dx, 0, maxW - dragStart.crop.width);
        next.y = clamp(dragStart.crop.y + dy, 0, maxH - dragStart.crop.height);
      } else {
        // Resize handles
        let newX = dragStart.crop.x;
        let newY = dragStart.crop.y;
        let newW = dragStart.crop.width;
        let newH = dragStart.crop.height;

        if (dragging === "tl") {
          newX = dragStart.crop.x + dx;
          newY = dragStart.crop.y + dy;
          newW = dragStart.crop.width - dx;
          newH = dragStart.crop.height - dy;
        } else if (dragging === "tr") {
          newY = dragStart.crop.y + dy;
          newW = dragStart.crop.width + dx;
          newH = dragStart.crop.height - dy;
        } else if (dragging === "bl") {
          newX = dragStart.crop.x + dx;
          newW = dragStart.crop.width - dx;
          newH = dragStart.crop.height + dy;
        } else if (dragging === "br") {
          newW = dragStart.crop.width + dx;
          newH = dragStart.crop.height + dy;
        }

        // Enforce aspect ratio if locked
        if (aspect > 0) {
          // Use width as primary
          newH = newW / aspect;
          if (dragging === "tl" || dragging === "tr") {
            newY = dragStart.crop.y + (dragStart.crop.height - newH);
          }
        }

        // Min size
        const MIN = 30;
        if (newW < MIN || newH < MIN) return;

        // Clamp to image bounds
        if (newX < 0) {
          newW += newX;
          newX = 0;
        }
        if (newY < 0) {
          newH += newY;
          newY = 0;
        }
        if (newX + newW > maxW) newW = maxW - newX;
        if (newY + newH > maxH) newH = maxH - newY;

        // Final aspect re-correct after clamp (for locked aspect)
        if (aspect > 0) {
          newH = newW / aspect;
          if (newY + newH > maxH) {
            newH = maxH - newY;
            newW = newH * aspect;
          }
        }

        next.x = newX;
        next.y = newY;
        next.width = newW;
        next.height = newH;
      }

      setCrop(next);
    },
    [dragging, dragStart, imgDims.w, imgDims.h, aspect]
  );

  const onPointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging, onPointerMove, onPointerUp]);

  // ─── Generate cropped blob ───
  const handleConfirm = async () => {
    if (!imgRef.current || !imgLoaded) return;
    setProcessing(true);
    try {
      const img = imgRef.current;
      const scaleX = imgDims.naturalW / imgDims.w;
      const scaleY = imgDims.naturalH / imgDims.h;
      const sx = crop.x * scaleX;
      const sy = crop.y * scaleY;
      const sw = crop.width * scaleX;
      const sh = crop.height * scaleY;

      // Cap output dimensions for performance (max width 1600px)
      const MAX_OUT = 1600;
      let outW = sw;
      let outH = sh;
      if (outW > MAX_OUT) {
        outH = (outH * MAX_OUT) / outW;
        outW = MAX_OUT;
      }

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/webp", 0.88)
      );
      if (!blob) throw new Error("Failed to encode crop");
      onConfirm(blob);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="card flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Crop size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-on-surface">
              Crop Gambar
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-2 text-on-surface-variant hover:bg-surface-container"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Aspect ratio selector */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
          <span className="text-xs font-medium text-on-surface-variant">
            Aspek rasio:
          </span>
          {ASPECT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setAspect(opt.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                aspect === opt.value
                  ? "bg-primary text-white"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Crop area */}
        <div
          ref={containerRef}
          className="flex flex-1 items-center justify-center overflow-auto bg-black/20 p-4"
        >
          <div className="relative inline-block select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Untuk crop"
              onLoad={handleImageLoad}
              draggable={false}
              className="block max-h-[60vh] max-w-full"
              style={{ userSelect: "none" }}
            />
            {imgLoaded && (
              <>
                {/* Dark overlay outside crop */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    boxShadow: `0 0 0 9999px rgba(0,0,0,0.55)`,
                    clipPath: `polygon(
                      0 0,
                      100% 0,
                      100% 100%,
                      0 100%,
                      0 ${crop.y}px,
                      ${crop.x}px ${crop.y}px,
                      ${crop.x}px ${crop.y + crop.height}px,
                      ${crop.x + crop.width}px ${crop.y + crop.height}px,
                      ${crop.x + crop.width}px ${crop.y}px,
                      0 ${crop.y}px
                    )`,
                  }}
                />
                {/* Crop rectangle */}
                <div
                  onPointerDown={onPointerDown("move")}
                  className="absolute cursor-move border-2 border-primary"
                  style={{
                    left: crop.x,
                    top: crop.y,
                    width: crop.width,
                    height: crop.height,
                    background: "transparent",
                  }}
                >
                  {/* Grid lines */}
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
                    <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
                    <div className="absolute top-1/3 left-0 h-px w-full bg-white/30" />
                    <div className="absolute top-2/3 left-0 h-px w-full bg-white/30" />
                  </div>
                  {/* Corner handles */}
                  {(["tl", "tr", "bl", "br"] as const).map((h) => {
                    const pos: Record<string, string> = {
                      tl: "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
                      tr: "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
                      bl: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
                      br: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
                    };
                    return (
                      <div
                        key={h}
                        onPointerDown={onPointerDown(h)}
                        className={`absolute h-3.5 w-3.5 rounded-sm border-2 border-primary bg-white shadow-md ${pos[h]}`}
                      />
                    );
                  })}
                </div>
              </>
            )}
            {!imgLoaded && (
              <div className="flex items-center gap-2 text-white">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Memuat gambar...</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-surface-container-low px-5 py-3">
          <p className="text-xs text-on-surface-variant">
            {imgLoaded
              ? `Crop: ${Math.round(crop.width)} × ${Math.round(crop.height)} px (preview)`
              : "Memuat gambar..."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn-ghost text-sm"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!imgLoaded || processing}
              className="btn-primary flex items-center gap-1.5 text-sm disabled:opacity-50"
            >
              {processing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Crop size={14} />
              )}
              Terapkan Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
