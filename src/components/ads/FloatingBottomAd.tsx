"use client";

import { useEffect, useRef, useState } from "react";
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

const DISMISS_KEY = "lensaplus_floating_ad_dismissed";

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

export default function FloatingBottomAd() {
  const pathname = usePathname() || "";
  const excluded = isExcludedPath(pathname);
  const [ad, setAd] = useState<Ad | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const trackedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (excluded || isSessionDismissed()) {
      setDismissed(true);
      return;
    }

    let cancelled = false;

    fetch("/api/ads?slot=FLOATING_BOTTOM")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        const ads: Ad[] = Array.isArray(json?.data) ? json.data : [];
        const eligible = ads.filter((item) => matchesTargetPages(item, pathname));
        if (eligible.length === 0) {
          setAd(null);
          return;
        }
        const chosen = eligible[Math.floor(Math.random() * eligible.length)];
        setAd(chosen);
        setDismissed(false);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [excluded, pathname]);

  useEffect(() => {
    if (excluded || dismissed || !ad) return;

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
  }, [excluded, dismissed, ad]);

  const handleClose = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore private-mode storage restrictions */
    }
  };

  const handleClick = (item: Ad) => {
    fetch(`/api/ads/${item.id}/track?type=click`, { method: "POST" }).catch(() => {});
  };

  if (excluded || dismissed || !ad) return null;

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
        width={728}
        height={90}
        className="block max-h-[90px] w-full h-auto object-contain"
        loading="lazy"
      />
    ) : null;

  if (!creative) return null;

  const safeTargetUrl = safeHref(ad.targetUrl, { allowRelative: true });

  return (
    <aside
      aria-label="Iklan bawah"
      className="fixed bottom-0 left-0 right-0 z-[130] border-t border-border bg-surface-container-lowest/95 backdrop-blur-sm shadow-ambient pb-[env(safe-area-inset-bottom)]"
    >
      <div className="container-main flex items-center justify-between gap-2 py-1.5 sm:py-2">
        <span className="hidden sm:inline shrink-0 text-[10px] font-bold uppercase tracking-widest text-txt-muted">
          Iklan
        </span>
        <div className="mx-auto w-full max-w-[728px] min-w-0">
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
        <button
          type="button"
          onClick={handleClose}
          aria-label="Tutup iklan bawah"
          className="shrink-0 p-1.5 text-txt-secondary transition-colors hover:text-on-surface"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
