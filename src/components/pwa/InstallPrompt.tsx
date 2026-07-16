"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X, Download } from "lucide-react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY   = "lensaplus-pwa-dismissed-at";
const DISMISS_DAYS  = 30;

/** Returns true if the user dismissed the prompt within the cooldown window. */
function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = parseInt(raw, 10);
  const elapsed     = Date.now() - dismissedAt;
  return elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/** Returns true if the app is already running in standalone (installed) mode. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

/** Returns true if running on iOS Safari (which has its own install UX). */
function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  // Skip on admin panel routes
  const isPanel = pathname.startsWith("/panel");

  useEffect(() => {
    if (isPanel) return;
    if (isStandalone()) return;
    if (isDismissed()) return;
    // iOS Safari uses its own Add to Home Screen UX — don't show our banner
    if (isIosSafari()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isPanel]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setDeferredPrompt(null);
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  return (
    <div
      role="banner"
      aria-label="Prompt pasang aplikasi Lensaplus"
      className="fixed bottom-4 left-4 right-4 z-[150] sm:left-auto sm:right-6 sm:w-80"
    >
      <div className="card shadow-ambient border border-border-default flex items-start gap-3 p-4 rounded-md">
        {/* App icon */}
        <Image
          src="/icons/icon-192.png"
          alt="Logo Lensaplus"
          width={44}
          height={44}
          className="rounded-sm flex-shrink-0 mt-0.5"
        />

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-label-md font-semibold text-on-surface leading-snug">
            Pasang Lensaplus
          </p>
          <p className="text-label-md text-on-surface-variant mt-0.5 leading-snug">
            Baca berita Bandung & Indonesia lebih cepat dari layar utama Anda.
          </p>

          {/* CTA buttons */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="btn-primary flex items-center gap-1.5 py-1.5 px-3 text-label-md"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Pasang aplikasi
            </button>
            <button
              onClick={handleDismiss}
              className="btn-ghost text-label-md py-1.5 px-3 text-on-surface-variant hover:text-on-surface"
            >
              Nanti saja
            </button>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={handleDismiss}
          aria-label="Tutup prompt instalasi"
          className="flex-shrink-0 p-0.5 rounded-lg text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
