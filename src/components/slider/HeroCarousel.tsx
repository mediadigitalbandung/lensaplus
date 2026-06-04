"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Pause, Play } from "lucide-react";
import ClientDate from "@/components/ClientDate";

interface HeroArticle {
  slug: string;
  title: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  publishedAt: string | Date | null;
  author: { name: string };
  category: { name: string; slug: string };
}

interface HeroCarouselProps {
  main: HeroArticle[];
  side: HeroArticle[];
}

// How many side cards are visible at once. The full `side` array is split
// into pages of this size and rotated like the main hero. With pageSize=3
// the side feels balanced against the 8/4 grid; bumping it would crowd
// the panel.
const SIDE_PAGE_SIZE = 3;

export default function HeroCarousel({ main, side }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [sidePageIndex, setSidePageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const next = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % main.length);
  }, [main.length]);

  // Slice the full side pool into pages of 3. Last page may be short — the
  // dedup logic upstream guarantees ≥ 3 unique articles in slot 5+, so
  // SIDE_PAGE_SIZE almost always gives a clean 3-card row.
  const sidePages = useMemo(() => {
    const pages: HeroArticle[][] = [];
    for (let i = 0; i < side.length; i += SIDE_PAGE_SIZE) {
      const chunk = side.slice(i, i + SIDE_PAGE_SIZE);
      if (chunk.length === SIDE_PAGE_SIZE) pages.push(chunk);
    }
    // Always have at least one page so the panel never goes blank.
    if (pages.length === 0 && side.length > 0) pages.push(side.slice(0, SIDE_PAGE_SIZE));
    return pages;
  }, [side]);

  const totalSidePages = sidePages.length;

  const nextSide = useCallback(() => {
    setSidePageIndex((prev) => (prev + 1) % Math.max(1, totalSidePages));
  }, [totalSidePages]);

  // Auto-rotate main hero every 6 seconds. Disabled when user prefers reduced motion.
  useEffect(() => {
    if (isPaused || main.length <= 1 || prefersReducedMotion) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [isPaused, next, main.length, prefersReducedMotion]);

  // Auto-rotate side stack every 8 seconds — slightly off-cadence from the
  // main panel so the two carousels don't flip in lockstep, which would
  // make the whole hero feel busy.
  useEffect(() => {
    if (isPaused || totalSidePages <= 1 || prefersReducedMotion) return;
    const timer = setInterval(nextSide, 8000);
    return () => clearInterval(timer);
  }, [isPaused, nextSide, totalSidePages, prefersReducedMotion]);

  if (main.length === 0) return null;

  const hero = main[activeIndex];

  return (
    <section
      className="bg-on-surface"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container-main py-0">
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Hero artikel utama"
          aria-live="polite"
          className="grid grid-cols-1 sm:grid-cols-12 min-h-[22rem] sm:min-h-[28rem] lg:min-h-[36rem]"
        >
          {/* Main story — 8 cols on sm+, full width below sm. Crossfade. */}
          <div className="sm:col-span-8 relative overflow-hidden">
            {main.map((a, i) => (
              <Link
                key={a.slug}
                href={`/berita/${a.slug}`}
                className={`block absolute inset-0 transition-opacity duration-700 ease-in-out group ${
                  i === activeIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                {a.featuredImage ? (
                  <Image
                    src={a.featuredImage}
                    alt={a.title}
                    fill
                    className="object-cover transition-transform duration-[6000ms] ease-linear group-hover:scale-[1.02]"
                    style={{ transform: i === activeIndex ? "scale(1.05)" : "scale(1)" }}
                    priority={i === 0}
                  />
                ) : (
                  <div className="absolute inset-0 bg-primary" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-5 py-6 pb-12 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
                  <span className="mb-2 sm:mb-3 inline-flex items-center rounded-md bg-white/15 px-2.5 py-1 text-[10px] sm:text-label-sm font-bold uppercase tracking-widest text-white backdrop-blur-sm transition-colors duration-300 group-hover:bg-secondary">
                    {a.category.name}
                  </span>
                  <h2 className="font-serif text-headline-sm sm:text-display-sm lg:text-display-md xl:text-display-lg text-white leading-[1.15] sm:leading-[1.1] max-w-2xl pr-4 line-clamp-3">
                    {a.title}
                  </h2>
                  {a.excerpt && (
                    <p className="mt-3 sm:mt-4 text-body-md text-white/60 max-w-xl line-clamp-2 max-sm:hidden">
                      {a.excerpt}
                    </p>
                  )}
                  <div className="mt-2 sm:mt-4 flex items-center gap-2 sm:gap-3 text-[10px] sm:text-label-sm uppercase tracking-wider text-white/40">
                    <span className="text-white/60 font-semibold">{a.author.name}</span>
                    <span>/</span>
                    <span><ClientDate date={a.publishedAt} format="relative" /></span>
                  </div>
                </div>
              </Link>
            ))}

            {/* First item static for layout height */}
            <div className="relative h-full min-h-[18rem] sm:min-h-full invisible">
              <div className="absolute inset-0" />
            </div>

            {/* Progress dots + pause/play control */}
            <div className="absolute bottom-3 sm:bottom-4 left-5 sm:left-10 lg:left-14 z-20 flex items-center gap-1.5 sm:gap-2">
              {main.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-6 sm:w-8 bg-white" : "w-2 sm:w-3 bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`Slide ${i + 1} dari ${main.length}`}
                  aria-current={i === activeIndex ? "true" : "false"}
                />
              ))}
              <button
                onClick={() => setIsPaused((p) => !p)}
                aria-label={isPaused ? "Putar otomatis hero" : "Jeda otomatis hero"}
                className="ml-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors text-white"
              >
                {isPaused ? <Play size={10} aria-hidden /> : <Pause size={10} aria-hidden />}
              </button>
            </div>
          </div>

          {/* Side stories — di sm+ menempel di kanan hero (vertical stack
              4-col grid), di <sm jadi STRIP HORIZONTAL 3-col di bawah hero
              supaya tidak mengembang seperti banner full-width yang boros
              vertikal di tablet/mobile zoom.
              Border separator: vertikal antar card di mobile, horizontal
              di desktop. */}
          <div className="sm:col-span-4 relative overflow-hidden min-h-[10rem] sm:min-h-full border-t border-white/10 sm:border-t-0 sm:border-l sm:border-white/10">
            {sidePages.map((pageItems, pageIdx) => (
              <div
                key={pageIdx}
                className={`absolute inset-0 grid grid-cols-3 gap-px sm:grid-cols-1 sm:flex sm:flex-col sm:gap-1.5 transition-opacity duration-700 ease-in-out ${
                  pageIdx === sidePageIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                {pageItems.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/berita/${a.slug}`}
                    className="group relative overflow-hidden sm:flex-1"
                  >
                    <div className="absolute inset-0">
                      {a.featuredImage ? (
                        <Image
                          src={a.featuredImage}
                          alt={a.title}
                          fill
                          className="object-cover transition-transform duration-[6000ms] ease-linear group-hover:scale-[1.02]"
                          style={{
                            transform:
                              pageIdx === sidePageIndex ? "scale(1.05)" : "scale(1)",
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-primary-container" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent" />
                    </div>
                    {/* Konten side card: padding kecil + font ringkas di
                        mobile (tiap card cuma 1/3 width) supaya teks tidak
                        terpotong bingung. Skala naik di sm/lg ketika side
                        panel kembali jadi vertikal stack di kanan hero. */}
                    <div className="relative p-2 sm:p-4 lg:p-6 flex flex-col justify-end h-full min-h-[6rem] sm:min-h-[8rem]">
                      <span className="text-[8px] sm:text-label-sm font-bold uppercase tracking-wider sm:tracking-widest text-secondary mb-0.5 sm:mb-1">
                        {a.category.name}
                      </span>
                      <h2 className="font-serif text-[11px] leading-tight sm:text-title-md sm:leading-snug lg:text-title-lg text-white line-clamp-3 sm:line-clamp-2 group-hover:text-white/90 transition-colors">
                        {a.title}
                      </h2>
                      <span className="mt-0.5 sm:mt-2 text-[8px] sm:text-label-sm text-white/50 uppercase tracking-wider">
                        <ClientDate date={a.publishedAt} format="relative" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ))}

            {/* Page dots — only when more than one page exists */}
            {totalSidePages > 1 && (
              <div className="absolute top-2.5 sm:top-4 right-3 sm:right-5 z-20 flex items-center gap-1 sm:gap-1.5">
                {sidePages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSidePageIndex(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === sidePageIndex ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                    }`}
                    aria-label={`Panel samping ${i + 1} dari ${totalSidePages}`}
                    aria-current={i === sidePageIndex ? "true" : "false"}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
