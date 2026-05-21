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

/**
 * Picks an ad for the given slot.
 *
 * `index` lets the caller deterministically pick a specific ad from the
 * available list (useful when a parent renders multiple `SidebarAd`s in a
 * row and wants each one to show a *different* creative — e.g. ad[0],
 * ad[1] — instead of relying on Math.random which can pick the same ad
 * twice and look like a duplicate render).
 *
 * When `index` is undefined, falls back to random pick (legacy behavior).
 */
function useAd(adSlot: string, index?: number) {
  const [ad, setAd] = useState<Ad | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    tracked.current = false;
    fetch(`/api/ads?slot=${adSlot}`)
      .then((r) => r.json())
      .then((json) => {
        const ads: Ad[] = json.data || [];
        if (ads.length === 0) return;
        const pick =
          typeof index === "number"
            ? ads[index % ads.length]
            : ads[Math.floor(Math.random() * ads.length)];
        setAd(pick);
      })
      .catch(() => {});
  }, [adSlot, index]);

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
  useEffect(() => {
    if (typeof window !== "undefined" && ad.type === "HTML") {
      try {
        const adsbygoogle = (window as any).adsbygoogle;
        if (adsbygoogle) {
          adsbygoogle.push({});
        }
      } catch (err) {
        console.error("Error pushing to adsbygoogle:", err);
      }
    }
  }, [ad]);

  // Safety wrapper: ad HTML kadang punya `aspect-ratio:728/100` yang di mobile
  // (360px width) → height cuma ~49px, kepotong-potong. Wrapper kasih
  // min-height responsive sebagai floor supaya konten tidak ke-clip walaupun
  // ad-nya pakai aspect ratio sempit.
  const content =
    ad.type === "HTML" && ad.htmlCode ? (
      <div
        className="w-full min-h-[80px] sm:min-h-[100px]"
        style={{ minHeight: "clamp(80px, 18vw, 160px)" }}
        dangerouslySetInnerHTML={{ __html: ad.htmlCode }}
      />
    ) : ad.imageUrl ? (
      // eslint-disable-next-line @next/next/no-img-element -- external advertiser-supplied URL, domain not known ahead of time
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
   Fills the sidebar column width (100%).
   `index` lets the caller dedupe when rendering multiple SidebarAd instances
   in a row (e.g. <SidebarAd index={0} /> + <SidebarAd index={1} />).

   IMPORTANT — wrapper class beda untuk HTML vs IMAGE ad:
     - HTML ad (htmlCode dari DB): WAJIB pakai `w-full` saja TANPA
       overflow-hidden. Creative kreatif sering punya tombol CTA di
       bagian bawah card; kalau wrapper `overflow-hidden` + content
       lebih tinggi dari box normal flow (mis. ada padding/margin
       inline-style), bagian bawah ke-clip dan tombol "Langganan
       Gratis" / "Hubungi Kami" hilang separuh.
     - Image ad (imageUrl): tetap pakai `overflow-hidden` + `object-cover`
       supaya banner 300×250 ter-crop rapi ke kotak ratio walau
       resolusi sumber ad bervariasi.
   `min-w-0` di wrapper image diperlukan supaya flex/grid parent tidak
   memaksa lebar minimum dari intrinsic image dimension. */
export function SidebarAd({ slot = "SIDEBAR", index }: { slot?: string; index?: number }) {
  const ad = useAd(slot, index);

  useEffect(() => {
    if (typeof window !== "undefined" && ad && ad.type === "HTML") {
      try {
        const adsbygoogle = (window as any).adsbygoogle;
        if (adsbygoogle) {
          adsbygoogle.push({});
        }
      } catch (err) {
        console.error("Error pushing to adsbygoogle:", err);
      }
    }
  }, [ad]);

  if (ad) {
    const content =
      ad.type === "HTML" && ad.htmlCode ? (
        // The HTML creatives in the DB lock the outer card to
        // `aspect-ratio:6/5; overflow:hidden;` (= 300×250 box). On narrow
        // sidebars the inner content (badge + headline + description +
        // checks + CTA) overflows that 6:5 box and the bottom CTA gets
        // clipped. We override BOTH props on the immediate child via
        // `[&>div]:!…` so the card grows to fit content with a tasteful
        // min-height floor — overriding inline `style=""` requires the
        // !important that Tailwind's `!` prefix adds.
        <div
          dangerouslySetInnerHTML={{ __html: ad.htmlCode }}
          className="w-full [&>div]:!aspect-auto [&>div]:!overflow-visible [&>div]:!min-h-[16rem]"
        />
      ) : ad.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external advertiser-supplied URL, domain not known ahead of time
        <img
          src={ad.imageUrl}
          alt="Iklan"
          width={300}
          height={250}
          className="block w-full h-auto rounded-md"
          loading="lazy"
        />
      ) : null;

    if (!content) return null;

    if (ad.targetUrl) {
      return (
        <a
          href={ad.targetUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => handleClick(ad)}
          className="block w-full"
        >
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
