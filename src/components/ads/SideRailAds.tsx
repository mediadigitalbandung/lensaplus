"use client";

/**
 * Sticky vertical (skyscraper) ads pinned to the empty space outside the
 * 1152-px content container on wide viewports. Reuses the SIDEBAR slot — no
 * new schema enum needed.
 *
 * Visibility rules:
 *  - Only shown at ≥ 2xl (1536px). Below that the rails would crowd the
 *    container and break the layout.
 *  - Hidden on /panel/* and /login — admin surfaces stay ad-free.
 *  - Hidden on /berita/[slug] article pages because those already have a
 *    dedicated sidebar (different visual rhythm — adding rails too would
 *    feel busy).
 */

import { usePathname } from "next/navigation";
import { SidebarAd } from "./BannerAd";

export default function SideRailAds() {
  const pathname = usePathname() || "";

  if (pathname.startsWith("/panel")) return null;
  if (pathname.startsWith("/login")) return null;
  if (pathname.startsWith("/berita/")) return null;

  // Skyscraper rail visual: 160 × min(80vh, 720px). Sidebar ads are designed
  // for 300×250 rectangles, so when one renders inside a 160×720 column the
  // content is much shorter than the rail. We compose a proper skyscraper
  // shell — primary-tinted column with an "IKLAN" cap and the ad centered
  // vertically — so the rail always reads as a tall vertical ad slot.
  const rail =
    "pointer-events-auto flex h-[min(80vh,720px)] w-full flex-col overflow-hidden " +
    "rounded-md border border-primary/10 bg-surface-container-lowest shadow-ambient";

  return (
    <>
      <aside
        aria-label="Iklan kiri"
        className="pointer-events-none fixed left-4 top-1/2 z-30 hidden w-40 -translate-y-1/2 2xl:block"
      >
        <div className={rail}>
          <div className="border-b border-primary/10 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/60">
            Iklan
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden p-3
            [&_a]:block [&_a]:w-full
            [&_img]:w-full [&_img]:max-h-full [&_img]:object-contain">
            <SidebarAd slot="SIDEBAR" />
          </div>
        </div>
      </aside>
      <aside
        aria-label="Iklan kanan"
        className="pointer-events-none fixed right-4 top-1/2 z-30 hidden w-40 -translate-y-1/2 2xl:block"
      >
        <div className={rail}>
          <div className="border-b border-primary/10 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary/60">
            Iklan
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden p-3
            [&_a]:block [&_a]:w-full
            [&_img]:w-full [&_img]:max-h-full [&_img]:object-contain">
            <SidebarAd slot="SIDEBAR" />
          </div>
        </div>
      </aside>
    </>
  );
}
