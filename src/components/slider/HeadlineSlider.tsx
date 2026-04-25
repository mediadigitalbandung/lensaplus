"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ClientDate from "@/components/ClientDate";

interface HeadlineItem {
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  category: { name: string; slug: string };
  author: { name: string };
  publishedAt: Date | string | null;
  readTime?: number | null;
}

interface HeadlineSliderProps {
  items: HeadlineItem[];
}

export default function HeadlineSlider({ items }: HeadlineSliderProps) {
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState(-1);
  const [transitioning, setTransitioning] = useState(false);
  const total = items.length;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const goToSlide = useCallback((index: number) => {
    if (transitioning || index === current) return;
    setPrevious(current);
    setTransitioning(true);
    setCurrent(index);
    setTimeout(() => {
      setTransitioning(false);
      setPrevious(-1);
    }, 900);
  }, [current, transitioning]);

  const next = useCallback(() => {
    goToSlide((current + 1) % total);
  }, [current, total, goToSlide]);

  const prev = useCallback(() => {
    goToSlide((current - 1 + total) % total);
  }, [current, total, goToSlide]);

  // Auto-advance
  useEffect(() => {
    if (total <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      goToSlide(((current) + 1) % total);
    }, 7000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, total, goToSlide]);

  if (total === 0) return null;

  return (
    <div className="group relative overflow-hidden rounded-lg bg-surface-dark">
      {/* All slides stacked — crossfade + ken burns */}
      <div className="relative aspect-[2/1] sm:aspect-[1.8/1] w-full min-h-[140px] sm:min-h-[200px] lg:min-h-[270px]">
        {items.map((article, i) => {
          const isActive = i === current;
          const isLeaving = i === previous;
          const isVisible = isActive || isLeaving;

          return (
            <div
              key={article.slug}
              className="absolute inset-0"
              style={{
                zIndex: isActive ? 2 : isLeaving ? 1 : 0,
                opacity: isVisible ? 1 : 0,
                visibility: isVisible ? "visible" : "hidden",
                transition: isActive
                  ? "opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1)"
                  : isLeaving
                    ? "opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1)"
                    : "none",
              }}
            >
              {/* Image with Ken Burns slow zoom */}
              <div
                className="absolute inset-0"
                style={{
                  transform: isActive ? "scale(1.08)" : "scale(1)",
                  transition: isActive ? "transform 8s ease-out" : "none",
                }}
              >
                {article.featuredImage ? (
                  <Image
                    src={article.featuredImage}
                    alt={article.title}
                    fill
                    className="object-cover"
                    priority={i === 0}
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-surface-dark to-gray-800" />
                )}
              </div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

              {/* Content — slides up on enter */}
              <div
                className="absolute bottom-0 left-0 right-0 px-4 pt-4 pb-8 sm:px-8 md:px-12 lg:px-16 sm:pb-10 lg:pb-12"
                style={{
                  transform: isActive && transitioning ? "translateY(0)" : isActive ? "translateY(0)" : "translateY(20px)",
                  opacity: isActive ? 1 : 0,
                  transition: isActive
                    ? "transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.2s, opacity 0.6s ease 0.15s"
                    : "transform 0.4s ease, opacity 0.3s ease",
                }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
                  {article.category.name}
                </span>

                <Link href={`/berita/${article.slug}`}>
                  <h2 className="mt-2 text-base font-extrabold leading-[1.2] text-white sm:text-lg md:text-xl lg:text-2xl">
                    {article.title}
                  </h2>
                </Link>

                {article.excerpt && (
                  <p className="mt-2.5 hidden max-w-xl text-[13px] leading-relaxed text-white/50 sm:block line-clamp-2">
                    {article.excerpt}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/35">
                  <span>{article.author.name}</span>
                  <span className="h-2.5 w-px bg-white/15" />
                  <span><ClientDate date={article.publishedAt} format="long" /></span>
                  {article.readTime && (
                    <>
                      <span className="h-2.5 w-px bg-white/15" />
                      <span>{article.readTime} min</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tag — top left like breaking news */}
      <div className="absolute top-0 left-0 z-10 flex items-center px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            Headline News
          </span>
        </div>
      </div>

      {/* Arrows — always visible, elegant */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/60 backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-black/40 hover:text-white hover:scale-110"
            aria-label="Previous"
          >
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <button
            onClick={next}
            className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/60 backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-black/40 hover:text-white hover:scale-110"
            aria-label="Next"
          >
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </>
      )}

      {/* Dots — positioned above content, centered */}
      {total > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className="rounded-full transition-all duration-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={`Slide ${i + 1}`}
            >
              <span className={`block rounded-full transition-all duration-300 ${
                i === current
                  ? "h-2.5 w-2.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]"
                  : "h-2 w-2 bg-white/30 hover:bg-white/60"
              }`} />
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
