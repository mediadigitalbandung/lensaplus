"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ClientDate from "@/components/ClientDate";

export interface SubHeadlineItem {
  title: string;
  slug: string;
  featuredImage?: string | null;
  category: { name: string; slug: string } | null;
  publishedAt: Date | string | null;
}

interface SubHeadlineSliderProps {
  items: SubHeadlineItem[];
  aspectClass?: string;
  roundedClass?: string;
  intervalMs?: number;
}

export default function SubHeadlineSlider({
  items,
  aspectClass = "aspect-[16/9] sm:aspect-[16/6.2] min-h-[148px] sm:min-h-[170px]",
  roundedClass = "rounded-xl",
  intervalMs = 5000,
}: SubHeadlineSliderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [previousPage, setPreviousPage] = useState(-1);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const perPage = 2;
  // Ensure every page has 2 cards when possible by pairing an odd tail with the first item
  const normalizedItems =
    items.length > 2 && items.length % 2 === 1 ? [...items, items[0]] : items;
  const totalPages = Math.ceil(normalizedItems.length / perPage);

  const goToPage = useCallback(
    (page: number) => {
      if (totalPages <= 1) return;
      const normalized = ((page % totalPages) + totalPages) % totalPages;
      if (normalized === currentPage) return;
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      setPreviousPage(currentPage);
      setCurrentPage(normalized);
      transitionTimerRef.current = setTimeout(() => {
        setPreviousPage(-1);
      }, 750);
    },
    [currentPage, totalPages],
  );

  const next = useCallback(() => {
    goToPage((currentPage + 1) % totalPages);
  }, [currentPage, totalPages, goToPage]);

  const prev = useCallback(() => {
    goToPage((currentPage - 1 + totalPages) % totalPages);
  }, [currentPage, totalPages, goToPage]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (totalPages <= 1 || paused) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      goToPage((currentPage + 1) % totalPages);
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentPage, totalPages, paused, intervalMs, goToPage]);

  if (items.length === 0) return null;

  // Build pages array (2 cards per slide)
  const pages: SubHeadlineItem[][] = [];
  for (let i = 0; i < normalizedItems.length; i += perPage) {
    pages.push(normalizedItems.slice(i, i + perPage));
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || totalPages <= 1) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
        const delta = endX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) > 40) {
          if (delta < 0) next();
          else prev();
        }
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Sorotan Berita Pilihan"
    >
      {/* Stacked pages — crossfade */}
      <div className={`relative ${aspectClass}`}>
        {pages.map((pageItems, pageIdx) => {
          const isActive = pageIdx === currentPage;
          const isLeaving = pageIdx === previousPage;
          const isVisible = isActive || isLeaving;

          return (
            <div
              key={pageIdx}
              className="absolute inset-0 grid grid-cols-2 gap-2.5 sm:gap-4"
              aria-hidden={!isActive}
              style={{
                zIndex: isActive ? 2 : isLeaving ? 1 : 0,
                opacity: isActive ? 1 : 0,
                visibility: isVisible ? "visible" : "hidden",
                pointerEvents: isActive ? "auto" : "none",
                transition: isVisible
                  ? "opacity 0.75s cubic-bezier(0.4, 0, 0.2, 1)"
                  : "none",
              }}
            >
              {pageItems.map((article, cardIdx) => (
                <div
                  key={`${article.slug}-${pageIdx}-${cardIdx}`}
                  className={`group/card relative overflow-hidden ${roundedClass} bg-primary shadow-sm`}
                >
                  {/* Image with Ken Burns */}
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: isActive ? "scale(1.05)" : "scale(1)",
                      transition: isActive ? "transform 6s ease-out" : "none",
                    }}
                  >
                    {article.featuredImage ? (
                      <Image
                        src={article.featuredImage}
                        alt={article.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary to-stone-900" />
                    )}
                  </div>

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

                  {/* Content overlay */}
                  <Link
                    href={`/berita/${article.slug}`}
                    className="absolute inset-0 flex flex-col justify-end p-2.5 sm:p-4"
                  >
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/80 truncate">
                      {article.category?.name || "Berita"}
                    </span>
                    <h3 className="mt-0.5 sm:mt-1 font-serif text-xs sm:text-sm font-bold leading-snug text-white line-clamp-2 group-hover/card:text-stone-200 transition-colors">
                      {article.title}
                    </h3>
                    <span className="mt-1 sm:mt-1.5 text-[9px] sm:text-[10px] uppercase tracking-wider text-white/70">
                      <ClientDate date={article.publishedAt} format="long" />
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          );
        })}

        {/* Navigation arrows — bare chevrons without circular backgrounds */}
        {totalPages > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-0.5 sm:left-1.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center text-white/75 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] transition-all duration-200 hover:text-white hover:scale-110"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-0.5 sm:right-1.5 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center text-white/75 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] transition-all duration-200 hover:text-white hover:scale-110"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight size={20} strokeWidth={2} />
            </button>
          </>
        )}
      </div>

      {/* Subtle page indicator dots below the 2-card grid */}
      {totalPages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {pages.map((_, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => goToPage(idx)}
              className="flex h-5 items-center justify-center px-0.5"
              aria-label={`Halaman ${idx + 1}`}
              aria-current={idx === currentPage ? "true" : undefined}
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentPage
                    ? "w-5 bg-primary"
                    : "w-1.5 bg-stone-300 hover:bg-stone-400"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
