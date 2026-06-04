"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";

/**
 * Web Share API button — di mobile akan trigger native share sheet
 * (Instagram, WhatsApp, Telegram, dll). Di desktop fallback ke copy link.
 */
export default function ShareInstallButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    const shareData = {
      title: "Kartawarta",
      text: "Pasang aplikasi Kartawarta — berita digital Bandung",
      url,
    };
    // Try Web Share API first (mobile + recent desktop)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled — fall through to copy
      }
    }
    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Worst-case fallback: open share dialog manually
      window.open(`mailto:?subject=Pasang%20Kartawarta&body=${encodeURIComponent(url)}`, "_blank");
    }
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-dark transition-colors"
      aria-label={copied ? "Link disalin" : "Bagikan halaman pasang aplikasi"}
    >
      {copied ? (
        <>
          <Check size={14} /> Tersalin!
        </>
      ) : (
        <>
          <Share2 size={14} /> Bagikan
        </>
      )}
    </button>
  );
}
