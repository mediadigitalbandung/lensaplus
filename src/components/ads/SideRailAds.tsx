"use client";

/**
 * Sticky vertical (skyscraper) ads pinned to the empty space outside the
 * 1152-px content container on wide viewports.
 *
 * Fixed-size IAB Wide Skyscraper: 160 × 600. Width and height are both
 * pinned in pixels so the rail looks consistent across viewport sizes
 * and matches what IAB-compliant skyscraper creatives expect.
 *
 * Visibility rules:
 *  - Only shown at ≥ 2xl (1536px). Below that the page is too narrow to
 *    fit a 160px rail on each side of the 1152px content container with
 *    breathing room — the rail would either crowd or overlap content.
 *  - Hidden on /panel/*, /login — admin surfaces stay ad-free.
 *  - Hidden on /berita/[slug] — those already have a dedicated sidebar.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface Ad {
  id: string;
  type: string;
  imageUrl?: string | null;
  htmlCode?: string | null;
  targetUrl?: string | null;
}

function useSidebarAd() {
  const [ad, setAd] = useState<Ad | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    fetch("/api/ads?slot=SIDEBAR")
      .then((r) => r.json())
      .then((json) => {
        const ads: Ad[] = json.data || [];
        if (ads.length > 0) setAd(ads[Math.floor(Math.random() * ads.length)]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ad && !tracked.current) {
      tracked.current = true;
      fetch(`/api/ads/${ad.id}/track?type=impression`, { method: "POST" }).catch(() => {});
    }
  }, [ad]);

  return ad;
}

function trackClick(adId: string) {
  fetch(`/api/ads/${adId}/track?type=click`, { method: "POST" }).catch(() => {});
}

/**
 * Inner content of one rail. Always fills its parent (h-full w-full).
 * Strategy:
 *  - Image ad → cover the full rail (cropped if necessary, no ugly gap).
 *  - Anything else (HTML / no ad) → a branded Kartawarta newsletter promo
 *    that's intentionally shaped as a 160×720 column.
 */
function RailContent() {
  const ad = useSidebarAd();

  if (ad?.imageUrl) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ad.imageUrl}
        alt="Iklan"
        loading="lazy"
        className="h-full w-full object-cover"
      />
    );
    if (ad.targetUrl) {
      return (
        <a
          href={ad.targetUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => trackClick(ad.id)}
          className="block h-full w-full"
        >
          {img}
        </a>
      );
    }
    return img;
  }

  // Default branded promo — looks intentional as a tall column even when
  // there's no real skyscraper inventory. Mirrors the "Newsletter Kartawarta"
  // creative the user already runs in SIDEBAR.
  return (
    <Link
      href="/newsletter"
      className="flex h-full w-full flex-col justify-between bg-gradient-to-b from-primary to-primary-dark px-4 py-6 text-white transition-opacity hover:opacity-95"
    >
      <div>
        <span className="inline-block rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
          Setiap Hari
        </span>
        <h3 className="mt-4 font-serif text-xl font-bold leading-tight">
          Newsletter Kartawarta
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-white/70">
          Ringkasan berita hukum & Bandung — langsung ke inbox Anda.
        </p>
      </div>
      <div>
        <div className="my-5 h-px bg-white/15" />
        <span className="block text-[10px] uppercase tracking-widest text-white/50">
          Gratis
        </span>
        <span className="mt-1 block font-serif text-base font-semibold">
          Berlangganan →
        </span>
      </div>
    </Link>
  );
}

export default function SideRailAds() {
  const pathname = usePathname() || "";

  if (pathname.startsWith("/panel")) return null;
  if (pathname.startsWith("/login")) return null;
  if (pathname.startsWith("/berita/")) return null;

  // Fixed IAB Wide Skyscraper: 160 × 600. Border + shadow define the
  // column shape so the rail always reads as a tall vertical ad slot.
  const shell =
    "pointer-events-auto flex h-[600px] w-[160px] flex-col overflow-hidden " +
    "rounded-md border border-primary/10 bg-surface-container-lowest shadow-ambient";

  const cap =
    "shrink-0 border-b border-primary/10 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/60";

  return (
    <>
      <aside
        aria-label="Iklan kiri"
        className="pointer-events-none fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 2xl:block"
      >
        <div className={shell}>
          <div className={cap}>Iklan</div>
          <div className="flex-1 overflow-hidden">
            <RailContent />
          </div>
        </div>
      </aside>
      <aside
        aria-label="Iklan kanan"
        className="pointer-events-none fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 2xl:block"
      >
        <div className={shell}>
          <div className={cap}>Iklan</div>
          <div className="flex-1 overflow-hidden">
            <RailContent />
          </div>
        </div>
      </aside>
    </>
  );
}
