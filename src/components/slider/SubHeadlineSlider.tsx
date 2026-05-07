"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ClientDate from "@/components/ClientDate";

interface SubHeadlineItem {
  title: string;
  slug: string;
  featuredImage?: string | null;
  category: { name: string; slug: string };
  publishedAt: Date | string | null;
}

interface SubHeadlineSliderProps {
  items: SubHeadlineItem[];
}

export default function SubHeadlineSlider({ items }: SubHeadlineSliderProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [previousPage, setPreviousPage] = useState(-1);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const perPage = 2;
  const totalPages = Math.ceil(items.length / perPage);

  const goToPage = useCallback((page: number) => {
    if (transitioning || page === currentPage) return;
    setPreviousPage(currentPage);
    setTransitioning(true);
    setCurrentPage(page);
    setTimeout(() => {
      setTransitioning(false);
      setPreviousPage(-1);
    }, 800);
  }, [currentPage, transitioning]);

  const next = useCallback(() => {
    goToPage((currentPage + 1) % totalPages);
  }, [currentPage, totalPages, goToPage]);

  const prev = useCallback(() => {
    goToPage((currentPage - 1 + totalPages) % totalPages);
  }, [currentPage, totalPages, goToPage]);

  useEffect(() => {
    if (totalPages <= 1) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      goToPage((currentPage + 1) % totalPages);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentPage, totalPages, goToPage]);

  if (items.length === 0) return null;

  // Build pages array
  const pages: SubHeadlineItem[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }

  return (
    <div className="relative group">
      {/* Stacked pages — crossfade like headline slider */}
      <div className="relative aspect-[2/1] sm:aspect-[32/9]">
        {pages.map((pageItems, pageIdx) => {
          const isActive = pageIdx === currentPage;
          const isLeaving = pageIdx === previousPage;
          const isVisible = isActive || isLeaving;

          return (
            <div
              key={pageIdx}
              className="absolute inset-0 grid grid-cols-2 gap-2 sm:gap-4"
              style={{
                zIndex: isActive ? 2 : isLeaving ? 1 : 0,
                opacity: isVisible ? 1 : 0,
                visibility: isVisible ? "visible" : "hidden",
                transition: "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {pageItems.map((article) => (
                <div key={article.slug} className="group/card relative overflow-hidden rounded-lg bg-surface-dark">
                  {/* Image with Ken Burns */}
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: isActive ? "scale(1.06)" : "scale(1)",
                      transition: isActive ? "transform 6s ease-out" : "none",
                    }}
                  >
                    {article.featuredImage ? (
                      <Image
                        src={article.featuredImage}
                        alt={article.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-700 to-gray-900" />
                    )}
                  </div>

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                  {/* Content overlay */}
                  <Link href={`/berita/${article.slug}`} className="absolute inset-0 flex flex-col justify-end p-4">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
                      {article.category.name}
                    </span>
                    <h3 className="mt-1 text-sm font-bold leading-snug text-white line-clamp-2">
                      {article.title}
                    </h3>
                    <span className="mt-1.5 text-[10px] text-white/40">
                      <ClientDate date={article.publishedAt} format="long" />
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Navigation arrows — same style as headline slider */}
      {totalPages > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white/50 backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-black/40 hover:text-white hover:scale-110"
            aria-label="Previous"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={next}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/20 text-white/50 backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-black/40 hover:text-white hover:scale-110"
            aria-label="Next"
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </>
      )}
    </div>
  );
}
