"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ClientDate from "@/components/ClientDate";

export interface HeadlineItem {
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  category: { name: string; slug: string } | null;
  author?: { name: string } | null;
  publishedAt: Date | string | null;
  readTime?: number | null;
}

interface HeadlineSliderProps {
  items: HeadlineItem[];
  badgeLabel?: string;
  aspectClass?: string;
  roundedClass?: string;
  intervalMs?: number;
}

export default function HeadlineSlider({
  items,
  badgeLabel = "Headline News",
  aspectClass = "aspect-[16/10] sm:aspect-[16/9] min-h-[210px] sm:min-h-[260px] lg:min-h-[300px]",
  roundedClass = "rounded-xl sm:rounded-2xl",
  intervalMs = 6000,
}: HeadlineSliderProps) {
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState(-1);
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const total = items.length;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const goToSlide = useCallback(
    (index: number) => {
      if (total <= 1) return;
      const normalized = ((index % total) + total) % total;
      if (normalized === current) return;
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      setPrevious(current);
      setTransitioning(true);
      setCurrent(normalized);
      transitionTimerRef.current = setTimeout(() => {
        setTransitioning(false);
        setPrevious(-1);
      }, 750);
    },
    [current, total],
  );

  const next = useCallback(() => {
    goToSlide((current + 1) % total);
  }, [current, total, goToSlide]);

  const prev = useCallback(() => {
    goToSlide((current - 1 + total) % total);
  }, [current, total, goToSlide]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Auto-advance (paused on hover or prefers-reduced-motion)
  useEffect(() => {
    if (total <= 1 || paused) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      goToSlide((current + 1) % total);
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [current, total, paused, intervalMs, goToSlide]);

  if (total === 0) return null;

  return (
    <div
      className={`group relative overflow-hidden ${roundedClass} bg-surface-dark shadow-sm`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || total <= 1) return;
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
      aria-label={badgeLabel || "Berita Utama"}
    >
      {/* Stacked slides — crossfade + Ken Burns slow zoom */}
      <div className={`relative w-full ${aspectClass}`}>
        {items.map((article, i) => {
          const isActive = i === current;
          const isLeaving = i === previous;
          const isVisible = isActive || isLeaving;

          return (
            <div
              key={`${article.slug}-${i}`}
              className="absolute inset-0"
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
              <Link
                href={`/berita/${article.slug}`}
                className="absolute inset-0 block focus:outline-none"
              >
                {/* Image with Ken Burns slow zoom */}
                <div
                  className="absolute inset-0"
                  style={{
                    transform: isActive ? "scale(1.06)" : "scale(1)",
                    transition: isActive ? "transform 7s ease-out" : "none",
                  }}
                >
                  {article.featuredImage ? (
                    <Image
                      src={article.featuredImage}
                      alt={article.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 55vw"
                      priority={i === 0}
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-surface-dark to-stone-900" />
                  )}
                </div>

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/15" />

                {/* Content */}
                <div
                  className="absolute bottom-0 left-0 right-0 px-4 pt-4 pb-9 sm:px-7 md:px-10 sm:pb-10"
                  style={{
                    transform:
                      isActive && transitioning
                        ? "translateY(0)"
                        : isActive
                          ? "translateY(0)"
                          : "translateY(14px)",
                    opacity: isActive ? 1 : 0,
                    transition: isActive
                      ? "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s, opacity 0.5s ease 0.1s"
                      : "transform 0.35s ease, opacity 0.25s ease",
                  }}
                >
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-white/85">
                    {article.category?.name || "Berita"}
                  </span>

                  <h2 className="mt-1 sm:mt-1.5 font-serif text-base font-bold leading-tight text-white sm:text-xl lg:text-2xl line-clamp-2 drop-shadow-sm">
                    {article.title}
                  </h2>

                  {article.excerpt && (
                    <p className="mt-1.5 hidden max-w-xl text-xs sm:text-[13px] leading-relaxed text-white/80 sm:line-clamp-2">
                      {article.excerpt}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-[10px] sm:text-[11px] uppercase tracking-wider text-white/75">
                    <span>{article.author?.name || "Redaksi Lensaplus"}</span>
                    <span className="text-white/40">/</span>
                    <span>
                      <ClientDate date={article.publishedAt} format="long" />
                    </span>
                    {article.readTime ? (
                      <>
                        <span className="text-white/40">/</span>
                        <span>{article.readTime} mnt</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Top-left editorial label */}
      {badgeLabel && (
        <div className="pointer-events-none absolute top-0 left-0 z-10 flex items-center px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
              {badgeLabel}
            </span>
          </div>
        </div>
      )}

      {/* Arrows — bare editorial chevrons without circular backgrounds */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-1 sm:left-2.5 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] transition-all duration-200 hover:text-white hover:scale-110"
            aria-label="Slide sebelumnya"
          >
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-1 sm:right-2.5 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] transition-all duration-200 hover:text-white hover:scale-110"
            aria-label="Slide berikutnya"
          >
            <ChevronRight size={22} strokeWidth={2} />
          </button>
        </>
      )}

      {/* Dots — centered along the bottom edge */}
      {total > 1 && (
        <div className="absolute bottom-1 sm:bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 sm:gap-1">
          {items.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => goToSlide(i)}
              className="flex min-h-[32px] min-w-[28px] sm:min-h-[36px] sm:min-w-[32px] items-center justify-center"
              aria-label={`Slide ${i + 1}`}
              aria-current={i === current ? "true" : undefined}
            >
              <span
                className={`block rounded-full transition-all duration-300 ${
                  i === current
                    ? "h-1.5 w-5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.45)]"
                    : "h-1.5 w-1.5 bg-white/40 hover:bg-white/75"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
