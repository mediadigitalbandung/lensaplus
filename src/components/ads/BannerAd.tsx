"use client";

import { useEffect, useState, useRef } from "react";

interface Ad {
  id: string;
  type: string;
  imageUrl?: string | null;
  htmlCode?: string | null;
  targetUrl?: string | null;
}

const sizeToSlot: Record<string, string> = {
  leaderboard: "HEADER",
  banner: "BETWEEN_SECTIONS",
  rectangle: "SIDEBAR",
  inline: "IN_ARTICLE",
  footer: "FOOTER",
};

interface BannerAdProps {
  size?: string;
  slot?: string;
  className?: string;
  noWrapper?: boolean;
  showPlaceholder?: boolean;
}

function useAd(adSlot: string) {
  const [ad, setAd] = useState<Ad | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    tracked.current = false;
    fetch(`/api/ads?slot=${adSlot}`)
      .then((r) => r.json())
      .then((json) => {
        const ads: Ad[] = json.data || [];
        if (ads.length > 0) setAd(ads[Math.floor(Math.random() * ads.length)]);
      })
      .catch(() => {});
  }, [adSlot]);

  useEffect(() => {
    if (ad && !tracked.current) {
      tracked.current = true;
      fetch(`/api/ads/${ad.id}/track?type=impression`, { method: "POST" }).catch(() => {});
    }
  }, [ad]);

  return ad;
}

function handleClick(ad: Ad) {
  fetch(`/api/ads/${ad.id}/track?type=click`, { method: "POST" }).catch(() => {});
}

function AdContent({ ad }: { ad: Ad }) {
  const content =
    ad.type === "HTML" && ad.htmlCode ? (
      <div dangerouslySetInnerHTML={{ __html: ad.htmlCode }} />
    ) : ad.imageUrl ? (
      <img src={ad.imageUrl} alt="Iklan" width={728} height={90} className="w-full h-auto block" loading="lazy" />
    ) : null;

  if (!content) return null;

  if (ad.targetUrl) {
    return (
      <a href={ad.targetUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={() => handleClick(ad)} className="block">
        {content}
      </a>
    );
  }
  return content;
}

function AdPlaceholder({ label = "Iklan" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center bg-surface-container-low py-5">
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant/30">{label}</span>
    </div>
  );
}

/* ── Main Banner Ad ──
   Full-width within container-main, consistent with section spacing */
export default function BannerAd({ size = "banner", slot, className = "", noWrapper, showPlaceholder = true }: BannerAdProps) {
  const resolvedSlot = slot || sizeToSlot[size] || "BETWEEN_SECTIONS";
  const ad = useAd(resolvedSlot);

  const inner = ad ? <AdContent ad={ad} /> : showPlaceholder ? <AdPlaceholder /> : null;
  if (!inner) return null;
  if (noWrapper) return inner;

  return (
    <div className={className}>
      <div className="container-main py-6">
        {inner}
      </div>
    </div>
  );
}

/* ── Sidebar Ad ──
   Fills the sidebar column width (100%) */
export function SidebarAd({ slot = "SIDEBAR" }: { slot?: string }) {
  const ad = useAd(slot);

  const wrapper = "w-full overflow-hidden";

  if (ad) {
    const content =
      ad.type === "HTML" && ad.htmlCode ? (
        <div dangerouslySetInnerHTML={{ __html: ad.htmlCode }} className={wrapper} />
      ) : ad.imageUrl ? (
        <img src={ad.imageUrl} alt="Iklan" width={300} height={250} className={`${wrapper} object-cover`} loading="lazy" />
      ) : null;

    if (!content) return null;

    if (ad.targetUrl) {
      return (
        <a href={ad.targetUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={() => handleClick(ad)} className="block w-full">
          {content}
        </a>
      );
    }
    return content;
  }

  return <AdPlaceholder label="Iklan Sidebar" />;
}

/* ── Inline Ad ──
   Full container width, blends with content rhythm */
export function InlineAd({ className = "" }: { className?: string }) {
  const ad = useAd("IN_ARTICLE");

  return (
    <div className={className}>
      <div className="container-main py-6">
        {ad ? <AdContent ad={ad} /> : <AdPlaceholder label="Sponsored Content" />}
      </div>
    </div>
  );
}

/* ── Native Ad ──
   Card-style within content, matches article card proportions */
export function NativeAd({ className = "" }: { className?: string }) {
  const ad = useAd("IN_ARTICLE");

  return (
    <div className={`bg-surface-container-low p-5 ${className}`}>
      <span className="text-label-sm uppercase tracking-wider text-on-surface-variant/40 mb-3 block">Sponsored</span>
      {ad ? (
        <AdContent ad={ad} />
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-16 w-24 shrink-0 bg-surface-container animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-surface-container animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-surface-container animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
}
