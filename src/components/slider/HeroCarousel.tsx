"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useMemo } from "react";
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

  // Auto-rotate main hero every 6 seconds.
  useEffect(() => {
    if (isPaused || main.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [isPaused, next, main.length]);

  // Auto-rotate side stack every 8 seconds — slightly off-cadence from the
  // main panel so the two carousels don't flip in lockstep, which would
  // make the whole hero feel busy.
  useEffect(() => {
    if (isPaused || totalSidePages <= 1) return;
    const timer = setInterval(nextSide, 8000);
    return () => clearInterval(timer);
  }, [isPaused, nextSide, totalSidePages]);

  if (main.length === 0) return null;

  const hero = main[activeIndex];

  return (
    <section
      className="bg-on-surface"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container-main py-0">
        <div className="grid grid-cols-1 sm:grid-cols-12 min-h-[30rem] sm:min-h-[28rem] lg:min-h-[36rem]">
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
                <div className="absolute bottom-0 left-0 right-0 px-7 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
                  <span className="inline-block text-label-sm font-bold uppercase tracking-widest text-secondary mb-3">
                    {a.category.name}
                  </span>
                  <h1 className="font-serif text-display-sm sm:text-display-md lg:text-display-lg text-white leading-[1.1] max-w-2xl pr-4 line-clamp-3">
                    {a.title}
                  </h1>
                  {a.excerpt && (
                    <p className="mt-4 text-body-md text-white/60 max-w-xl line-clamp-2 max-sm:hidden">
                      {a.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3 text-label-sm uppercase tracking-wider text-white/40">
                    <span className="text-white/60 font-semibold">{a.author.name}</span>
                    <span>/</span>
                    <span><ClientDate date={a.publishedAt} format="relative" /></span>
                  </div>
                </div>
              </Link>
            ))}

            {/* First item static for layout height */}
            <div className="relative h-full min-h-[26rem] sm:min-h-full invisible">
              <div className="absolute inset-0" />
            </div>

            {/* Progress dots */}
            <div className="absolute bottom-4 left-7 sm:left-10 lg:left-14 z-20 flex items-center gap-2">
              {main.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-8 bg-white" : "w-3 bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Side stories — 4 cols beside main from sm+ so they stay tucked to
              the right rather than stacking under the hero on tablets/phones.
              Below sm (≤640px) they fall back to a row under the hero. */}
          <div className="sm:col-span-4 relative overflow-hidden min-h-[20rem] sm:min-h-full border-t border-white/10 sm:border-t-0 sm:border-l sm:border-white/10">
            {sidePages.map((pageItems, pageIdx) => (
              <div
                key={pageIdx}
                className={`absolute inset-0 flex flex-col transition-opacity duration-700 ease-in-out ${
                  pageIdx === sidePageIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
              >
                {pageItems.map((a, i) => (
                  <Link
                    key={a.slug}
                    href={`/berita/${a.slug}`}
                    className={`group flex-1 relative overflow-hidden ${i < pageItems.length - 1 ? "border-b border-white/10" : ""}`}
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    </div>
                    <div className="relative p-6 sm:p-7 flex flex-col justify-end h-full min-h-[8rem]">
                      <span className="text-label-sm font-bold uppercase tracking-widest text-secondary mb-1">
                        {a.category.name}
                      </span>
                      <h2 className="font-serif text-title-lg text-white leading-snug line-clamp-2 group-hover:text-white/90 transition-colors">
                        {a.title}
                      </h2>
                      <span className="mt-2 text-label-sm text-white/40 uppercase tracking-wider">
                        <ClientDate date={a.publishedAt} format="relative" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ))}

            {/* Page dots — only when more than one page exists */}
            {totalSidePages > 1 && (
              <div className="absolute top-4 right-5 z-20 flex items-center gap-1.5">
                {sidePages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSidePageIndex(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === sidePageIndex ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                    }`}
                    aria-label={`Side page ${i + 1}`}
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
