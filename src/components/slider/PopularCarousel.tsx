"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ClientDate from "@/components/ClientDate";

interface PopularItem {
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  category: { name: string; slug: string };
  author: { name: string };
  publishedAt: Date | string | null;
  viewCount?: number;
}

interface PopularCarouselProps {
  items: PopularItem[];
}

export default function PopularCarousel({ items }: PopularCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    // Recheck on resize
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = useCallback((dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector("article")?.offsetWidth || 280;
    const gap = 20;
    const distance = (cardWidth + gap) * 4; // scroll 4 cards at a time
    const start = el.scrollLeft;
    const target = dir === "right" ? start + distance : start - distance;
    // Smooth with rAF
    let startTime: number | null = null;
    const duration = 500;
    const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      el.scrollLeft = start + (target - start) * ease(progress);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="relative">
      {/* Scrollable row — 4 visible, manual scroll only */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scrollbar-hide"
      >
        {items.map((article, i) => (
          <article
            key={article.slug}
            className="group w-[calc(50%-10px)] sm:w-[calc(33%-13px)] lg:w-[calc(25%-15px)] min-w-[150px] shrink-0"
          >
            <div>
              {/* Image with rank overlay */}
              <Link href={`/berita/${article.slug}`} className="block">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-sm">
                  {article.featuredImage ? (
                    <Image
                      src={article.featuredImage}
                      alt={article.title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-surface-tertiary" />
                  )}
                  {/* Rank number overlay */}
                  <div className="absolute bottom-0 left-0 flex h-10 w-10 items-center justify-center bg-primary">
                    <span className="text-lg font-extrabold text-white">{i + 1}</span>
                  </div>
                </div>
              </Link>
                {/* Content */}
                <div className="mt-2">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
                    {article.category.name}
                  </span>
                  <Link href={`/berita/${article.slug}`}>
                    <h3 className="mt-0.5 text-sm font-bold leading-snug text-txt-primary line-clamp-2 group-hover:underline">
                      {article.title}
                    </h3>
                  </Link>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-txt-muted">
                    <span><ClientDate date={article.publishedAt} format="short" /></span>
                    {article.viewCount !== undefined && article.viewCount > 0 && (
                      <>
                        <span className="h-2.5 w-px bg-border" />
                        <span>{article.viewCount.toLocaleString("id-ID")} views</span>
                      </>
                    )}
                  </div>
                </div>
            </div>
          </article>
        ))}
      </div>

      {/* Left arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute -left-4 top-[25%] -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-txt-secondary shadow-card transition-all duration-200 hover:border-txt-muted hover:text-txt-primary hover:shadow-card-hover hover:scale-110"
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} strokeWidth={1.5} />
        </button>
      )}

      {/* Right arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute -right-4 top-[25%] -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-txt-secondary shadow-card transition-all duration-200 hover:border-txt-muted hover:text-txt-primary hover:shadow-card-hover hover:scale-110"
          aria-label="Scroll right"
        >
          <ChevronRight size={18} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
