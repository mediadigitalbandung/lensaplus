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

  return (
    <>
      <aside
        aria-label="Iklan kiri"
        className="pointer-events-none fixed left-4 top-1/2 z-30 hidden w-40 -translate-y-1/2 2xl:block"
      >
        <div className="pointer-events-auto">
          <SidebarAd slot="SIDEBAR" />
        </div>
      </aside>
      <aside
        aria-label="Iklan kanan"
        className="pointer-events-none fixed right-4 top-1/2 z-30 hidden w-40 -translate-y-1/2 2xl:block"
      >
        <div className="pointer-events-auto">
          <SidebarAd slot="SIDEBAR" />
        </div>
      </aside>
    </>
  );
}
