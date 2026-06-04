"use client";

import { useEffect, useRef } from "react";
import DOMPurify from "isomorphic-dompurify";
import { X, ImageIcon } from "lucide-react";
import { slotLabels, slotSpecs } from "./ad-constants";

function AdContent({ type, imageUrl, htmlCode, height }: { type: string; imageUrl: string; htmlCode: string; height: number }) {
  if (type !== "HTML" && imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded ad image, URL unknown at build time
    return <img src={imageUrl} alt="Preview" className="max-w-full h-auto object-contain" style={{ maxHeight: height }} />;
  }
  if (type === "HTML" && htmlCode) {
    // Form preview runs BEFORE the server-side sanitize on save. Without
    // client-side sanitize an admin pasting a tracking pixel / payload
    // would execute JS in their own panel session.
    const safe = DOMPurify.sanitize(htmlCode, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allowfullscreen", "frameborder"],
    });
    return <div dangerouslySetInnerHTML={{ __html: safe }} />;
  }
  return (
    <div className="flex flex-col items-center gap-1 py-6 text-txt-muted">
      <ImageIcon size={24} />
      <span className="text-xs">Belum ada gambar</span>
    </div>
  );
}

function AdSlotBox({ label, spec, type, imageUrl, htmlCode }: {
  label: string; spec: { height: number; ratio: string }; type: string; imageUrl: string; htmlCode: string;
}) {
  return (
    <div className="relative border-2 border-dashed border-primary/40 rounded-lg overflow-hidden bg-surface">
      <div className="absolute top-1 left-2 z-10 rounded-lg bg-primary/90 px-2 py-0.5 text-[10px] font-bold text-white">
        IKLAN — {label}
      </div>
      <div className="flex items-center justify-center" style={{ minHeight: spec.height }}>
        <AdContent type={type} imageUrl={imageUrl} htmlCode={htmlCode} height={spec.height} />
      </div>
    </div>
  );
}

function ContentBlock() {
  return (
    <div className="rounded-lg bg-surface p-4 border border-border space-y-2">
      <div className="h-3 w-48 rounded-lg bg-surface-tertiary" />
      <div className="h-2 w-full rounded-lg bg-surface-tertiary" />
      <div className="h-2 w-3/4 rounded-lg bg-surface-tertiary" />
    </div>
  );
}

export default function AdPreviewOverlay({ slot, imageUrl, htmlCode, type, targetUrl, onClose }: {
  slot: string; imageUrl: string; htmlCode: string; type: string; targetUrl: string; onClose: () => void;
}) {
  const spec = slotSpecs[slot];
  const label = slotLabels[slot];
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Focus close button on open
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-preview-modal-title"
        className="relative max-w-[95vw] max-h-[90vh] overflow-auto bg-surface rounded-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface border-b border-border px-5 py-3 rounded-t-xl">
          <div>
            <h2 id="ad-preview-modal-title" className="text-sm font-bold text-txt-primary">Preview — {label}</h2>
            <p className="text-xs text-txt-muted">{spec?.ratio} • {spec?.desc}</p>
          </div>
          <button ref={closeButtonRef} onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-secondary" aria-label="Tutup preview"><X size={18} /></button>
        </div>

        <div className="p-4 sm:p-6 bg-surface-secondary">
          {slot === "SIDEBAR" ? (
            <div className="max-w-4xl mx-auto flex gap-5">
              <div className="flex-1 space-y-3">
                <ContentBlock />
                <ContentBlock />
              </div>
              <div className="shrink-0 w-[300px]">
                <AdSlotBox label={label} spec={spec} type={type} imageUrl={imageUrl} htmlCode={htmlCode} />
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              <ContentBlock />
              <AdSlotBox label={label} spec={spec} type={type} imageUrl={imageUrl} htmlCode={htmlCode} />
              <ContentBlock />
            </div>
          )}
          {targetUrl && (
            <p className="mt-3 text-center text-xs text-txt-muted">
              Klik mengarah ke: <span className="text-primary font-medium">{targetUrl}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
