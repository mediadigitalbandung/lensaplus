"use client";

import { useEffect } from "react";

interface CopyProtectionProps {
  authorName: string;
  articleUrl: string;
  articleTitle: string;
  categoryName?: string;
  publishedAt?: string;
}

export default function CopyProtection({
  authorName,
  articleUrl,
  articleTitle,
  categoryName = "",
  publishedAt = "",
}: CopyProtectionProps) {
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.toString().length < 20) return;

      const copiedText = selection.toString();

      // Watermark format sesuai permintaan
      const watermark = [
        "",
        "",
        `Baca artikel ${categoryName}, "${articleTitle}" selengkapnya ${articleUrl}`,
        `Dipublikasikan: ${publishedAt}`,
        `Penulis: ${authorName}`,
        "",
        `\u00A9 ${new Date().getFullYear()} Lensaplus — lensaplus.com`,
        "Seluruh hak cipta dilindungi. Dilarang mengutip tanpa mencantumkan sumber.",
      ].join("\n");

      e.clipboardData?.setData("text/plain", copiedText + watermark);
      e.preventDefault();
    };

    // Block right-click on article content
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".article-content")) {
        e.preventDefault();
      }
    };

    // Block keyboard shortcuts for saving/printing
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+S (save page)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
      }
      // Block Ctrl+P (print) — redirect to our print
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
      }
    };

    // Block drag on images
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" && target.closest(".article-content")) {
        e.preventDefault();
      }
    };

    document.addEventListener("copy", handleCopy);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, [authorName, articleUrl, articleTitle, categoryName, publishedAt]);

  return null;
}
