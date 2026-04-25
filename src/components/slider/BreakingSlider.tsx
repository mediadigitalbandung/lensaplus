"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ClientDate from "@/components/ClientDate";

interface BreakingItem {
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  category: { name: string; slug: string };
  publishedAt: Date | string | null;
}

interface BreakingSliderProps {
  items: BreakingItem[];
}

export default function BreakingSlider({ items }: BreakingSliderProps) {
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState(-1);
  const [transitioning, setTransitioning] = useState(false);
  const total = items.length;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const goToSlide = useCallback((index: number) => {
    if (transitioning || index === current) return;
    setPrevious(current);
    setTransitioning(true);
    setCurrent(index);
    setTimeout(() => {
      setTransitioning(false);
      setPrevious(-1);
    }, 700);
  }, [current, transitioning]);

  useEffect(() => {
    if (total <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      goToSlide((current + 1) % total);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, total, goToSlide]);

  const next = useCallback(() => {
    goToSlide((current + 1) % total);
  }, [current, total, goToSlide]);

  const prev = useCallback(() => {
    goToSlide((current - 1 + total) % total);
  }, [current, total, goToSlide]);

  if (total === 0) return null;

  return (
    <div className="group relative overflow-hidden rounded-lg bg-surface-dark min-h-[270px] h-full">
      {/* Slides — full bleed, no gap */}
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
              transition: "opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {/* Background image — full bleed with Ken Burns */}
            <div
              className="absolute inset-0"
              style={{
                transform: isActive ? "scale(1.04)" : "scale(1)",
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
                <div className="h-full w-full bg-surface-dark" />
              )}
            </div>

            {/* Gradient overlay — top dark for header, bottom dark for text */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/80" />

            {/* Content at bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 px-4 pb-8 pt-3 sm:px-8 sm:pb-9 lg:px-12"
              style={{
                transform: isActive ? "translateY(0)" : "translateY(12px)",
                opacity: isActive ? 1 : 0,
                transition: isActive
                  ? "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s, opacity 0.5s ease 0.1s"
                  : "transform 0.3s ease, opacity 0.2s ease",
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                {article.category.name}
              </span>
              <Link href={`/berita/${article.slug}`}>
                <h3 className="mt-1 text-sm sm:text-[15px] font-bold leading-snug text-white line-clamp-3">
                  {article.title}
                </h3>
              </Link>
              {article.excerpt && (
                <p className="mt-1.5 text-xs leading-relaxed text-white/40 line-clamp-2">
                  {article.excerpt}
                </p>
              )}
              <span className="mt-2 block text-[10px] text-white/30">
                <ClientDate date={article.publishedAt} format="short" />
              </span>
            </div>
          </div>
        );
      })}

      {/* Header overlay — floats on top of image */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            Breaking News
          </span>
        </div>
      </div>

      {/* Arrows — always visible, elegant */}
      {total > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/60 backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-black/40 hover:text-white hover:scale-110"
            aria-label="Previous"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={next}
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-white/20 bg-black/30 text-white/60 backdrop-blur-sm transition-all duration-200 hover:border-white/40 hover:bg-black/40 hover:text-white hover:scale-110"
            aria-label="Next"
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-3 left-0 right-0 z-10 flex items-center justify-center gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "h-2 w-2 bg-white"
                  : "h-1.5 w-1.5 bg-white/30 hover:bg-white/50"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
