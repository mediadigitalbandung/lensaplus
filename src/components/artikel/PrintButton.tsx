"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Printer, FileText, X } from "lucide-react";

export default function PrintButton() {
  const [showPreview, setShowPreview] = useState(false);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  function handlePrint() {
    setShowPreview(false);
    setTimeout(() => window.print(), 100);
  }

  function close() {
    setShowPreview(false);
  }

  // ESC to close
  useEffect(() => {
    if (!showPreview) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showPreview]);

  // Focus first element on open
  useEffect(() => {
    if (showPreview) {
      firstFocusRef.current?.focus();
    }
  }, [showPreview]);

  return (
    <>
      <div className="flex items-center gap-2 no-print">
        <button
          onClick={() => setShowPreview(true)}
          className="btn-ghost rounded-full px-3 py-1.5 text-xs"
          title="Preview PDF"
          aria-label="Preview PDF"
        >
          <FileText size={14} className="mr-1" />
          Preview PDF
        </button>
        <button
          onClick={() => window.print()}
          className="btn-ghost rounded-full px-3 py-1.5 text-xs"
          title="Cetak Artikel"
          aria-label="Cetak artikel"
        >
          <Printer size={14} className="mr-1" />
          Cetak
        </button>
      </div>

      {/* PDF Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4 no-print"
          onClick={close}
          aria-hidden="true"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-modal-title"
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 id="print-modal-title" className="text-base font-bold text-txt-primary">Preview PDF</h2>
                <p className="text-xs text-txt-muted">Tampilan saat dicetak / export ke PDF</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  ref={firstFocusRef}
                  onClick={handlePrint}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  <Printer size={14} className="mr-1.5" />
                  Cetak / Simpan PDF
                </button>
                <button
                  onClick={close}
                  className="p-2 hover:bg-surface-secondary rounded-lg"
                  aria-label="Tutup modal"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Preview content - mirror of print layout */}
            <div className="flex-1 overflow-auto p-6 bg-surface-secondary">
              <div className="bg-white shadow-lg rounded-lg mx-auto" style={{ maxWidth: "210mm", minHeight: "297mm", padding: "15mm 20mm" }}>
                <PrintPreviewContent />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PrintPreviewContent() {
  // Get article content from the page DOM
  const articleEl = typeof document !== "undefined" ? document.querySelector("article") : null;
  if (!articleEl) return <p className="text-txt-muted">Tidak dapat memuat preview</p>;

  // Extract elements
  const categoryEl = articleEl.querySelector("[class*='uppercase'][class*='tracking']");
  const titleEl = articleEl.querySelector("h1");
  const metaEl = articleEl.querySelector("[class*='text-txt-muted']");
  const featuredImg = articleEl.querySelector("[class*='aspect-'][class*='16/9'] img") as HTMLImageElement | null;
  const contentEl = articleEl.querySelector(".article-content");

  return (
    <div style={{ fontFamily: "Georgia, serif", color: "#1C1C1E" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "2px solid #002045", paddingBottom: 12, marginBottom: 20 }}>
        <Image src="/kartawarta-icon.png" alt="Kartawarta" width={40} height={40} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Kartawarta</div>
          <div style={{ fontSize: 9, color: "#6B7280" }}>Media Berita Digital Bandung &mdash; kartawarta.com</div>
        </div>
      </div>

      {/* Category badge */}
      {categoryEl && (
        <div style={{ display: "inline-block", background: "#e8edf3", color: "#002045", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 4, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {categoryEl.textContent}
        </div>
      )}

      {/* Title */}
      {titleEl && (
        <h1 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3, marginBottom: 8 }}>
          {titleEl.textContent}
        </h1>
      )}

      {/* Meta */}
      {metaEl && (
        <div style={{ fontSize: 10, color: "#6B7280", borderBottom: "1px solid #E5E7EB", paddingBottom: 10, marginBottom: 16 }}>
          {metaEl.textContent}
        </div>
      )}

      {/* Featured image */}
      {featuredImg && (
        <img
          src={featuredImg.src}
          alt=""
          style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 8, marginBottom: 16 }}
        />
      )}

      {/* Content */}
      {contentEl && (
        <div
          style={{ fontSize: 12, lineHeight: 1.7, textAlign: "justify" }}
          dangerouslySetInnerHTML={{ __html: contentEl.innerHTML.replace(/<!--AD_SLOT-->/g, "") }}
        />
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #E5E7EB", fontSize: 9, color: "#9CA3AF", textAlign: "center" }}>
        &copy; {new Date().getFullYear()} Kartawarta &mdash; kartawarta.com
        <br />Artikel ini dicetak pada {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        <br />Sumber: {typeof window !== "undefined" ? window.location.href : ""}
      </div>
    </div>
  );
}
