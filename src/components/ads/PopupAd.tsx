"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { safeHref } from "@/components/common/safeHref";

interface Ad {
  id: string;
  type: string;
  imageUrl?: string | null;
  htmlCode?: string | null;
  targetUrl?: string | null;
  targetPages?: string[] | null;
}

const DISMISS_KEY = "lensaplus_popup_ad_dismissed";
const SHOW_DELAY_MS = 2500;

function isExcludedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/panel") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/offline")
  );
}

function matchesTargetPages(ad: Ad, pathname: string): boolean {
  if (!Array.isArray(ad.targetPages) || ad.targetPages.length === 0) return true;
  return ad.targetPages.some((pattern) => {
    const p = pattern.trim();
    if (!p || p === "*" || p === "all") return true;
    if (p.endsWith("*")) return pathname.startsWith(p.slice(0, -1));
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

function isSessionDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function PopupAd() {
  const pathname = usePathname() || "";
  const excluded = isExcludedPath(pathname);
  const [ad, setAd] = useState<Ad | null>(null);
  const [visible, setVisible] = useState(false);
  const trackedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (excluded || isSessionDismissed()) {
      setVisible(false);
      return;
    }

    let cancelled = false;
    let showTimer: ReturnType<typeof setTimeout> | null = null;

    fetch("/api/ads?slot=POPUP")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        const ads: Ad[] = Array.isArray(json?.data) ? json.data : [];
        const eligible = ads.filter((item) => matchesTargetPages(item, pathname));
        if (eligible.length === 0) return;

        const chosen = eligible[Math.floor(Math.random() * eligible.length)];
        setAd(chosen);
        showTimer = setTimeout(() => {
          if (!cancelled && !isSessionDismissed()) {
            setVisible(true);
          }
        }, SHOW_DELAY_MS);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (showTimer) clearTimeout(showTimer);
    };
  }, [excluded, pathname]);

  useEffect(() => {
    if (!visible || !ad) return;

    if (trackedIdRef.current !== ad.id) {
      trackedIdRef.current = ad.id;
      fetch(`/api/ads/${ad.id}/track?type=impression`, { method: "POST" }).catch(() => {});
    }

    if (
      typeof window !== "undefined" &&
      ad.type === "HTML" &&
      typeof ad.htmlCode === "string" &&
      ad.htmlCode.includes("adsbygoogle")
    ) {
      try {
        const adsbygoogle = (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle;
        if (Array.isArray(adsbygoogle)) {
          adsbygoogle.push({});
        }
      } catch (err) {
        console.error("Error pushing to adsbygoogle:", err);
      }
    }
  }, [visible, ad]);

  const handleClose = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore private-mode storage restrictions */
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible, handleClose]);

  const handleClick = (item: Ad) => {
    fetch(`/api/ads/${item.id}/track?type=click`, { method: "POST" }).catch(() => {});
  };

  if (excluded || !visible || !ad) return null;

  const creative =
    ad.type === "HTML" && ad.htmlCode ? (
      <div
        className="w-full"
        dangerouslySetInnerHTML={{ __html: ad.htmlCode }}
      />
    ) : ad.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- external advertiser-supplied URL
      <img
        src={ad.imageUrl}
        alt="Iklan"
        width={600}
        height={400}
        className="block max-h-[75vh] w-full h-auto object-contain"
        loading="lazy"
      />
    ) : null;

  if (!creative) return null;

  const safeTargetUrl = safeHref(ad.targetUrl, { allowRelative: true });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Iklan"
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-[600px] overflow-hidden rounded-lg border border-border bg-surface-container-lowest shadow-ambient-lg">
        <div className="flex items-center justify-between border-b border-border bg-surface-container-low px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-txt-muted">
            Iklan
          </span>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup iklan"
            className="inline-flex items-center gap-1 text-xs font-medium text-txt-secondary transition-colors hover:text-on-surface"
          >
            <span>Tutup</span>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="bg-surface-container-lowest">
          {safeTargetUrl ? (
            <a
              href={safeTargetUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() => handleClick(ad)}
              className="block"
            >
              {creative}
            </a>
          ) : (
            creative
          )}
        </div>
      </div>
    </div>
  );
}
