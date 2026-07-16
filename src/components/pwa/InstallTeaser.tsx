"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Smartphone, X } from "lucide-react";

/**
 * InstallTeaser — subtle sticky bottom CTA di mobile homepage saja.
 *
 * Beda dari InstallPrompt (yang trigger native browser install dialog):
 * teaser ini link ke /unduh page yang punya instruksi multi-platform.
 * Berguna untuk iOS Safari (yang gak fire `beforeinstallprompt`) dan
 * users yang gak siap install langsung tapi mau lihat info dulu.
 *
 * Show conditions:
 *   - Mobile only (< sm)
 *   - User belum standalone mode (gak mau spam orang yg sudah install)
 *   - User belum dismiss minggu ini (localStorage)
 *   - Hanya di /, tidak di sub-pages (avoid distraction saat baca artikel)
 *   - Delay 5 detik setelah load supaya gak ganggu first impression
 */
const STORAGE_KEY = "lensaplus_install_teaser_dismissed_at";
const DISMISS_DAYS = 7;

export default function InstallTeaser() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only on homepage
    if (pathname !== "/") return;

    // Already standalone — they installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).standalone === true;
    if (isStandalone) return;

    // Dismissed recently?
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedMs = parseInt(dismissed, 10);
      if (Date.now() - dismissedMs < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    // Mobile only
    const mq = window.matchMedia("(max-width: 640px)");
    if (!mq.matches) return;

    // Delay 5s
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, [pathname]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Pasang aplikasi Lensaplus"
      className="fixed bottom-3 left-3 right-3 z-[140] sm:hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-white px-3 py-2.5 shadow-ambient">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          <Smartphone size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-txt-primary leading-tight">
            Pasang Lensaplus
          </p>
          <p className="mt-0.5 text-[11px] text-txt-muted leading-tight truncate">
            Lebih cepat, hemat data, bisa offline
          </p>
        </div>
        <Link
          href="/unduh"
          className="shrink-0 inline-flex items-center rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-dark transition-colors"
        >
          Pasang
        </Link>
        <button
          onClick={dismiss}
          aria-label="Tutup"
          className="shrink-0 -mr-1 p-1.5 rounded-md text-txt-muted hover:bg-surface-tertiary transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
