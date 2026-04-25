"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
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

export default function HeroCarousel({ main, side }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const next = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % main.length);
  }, [main.length]);

  // Auto-rotate every 6 seconds
  useEffect(() => {
    if (isPaused || main.length <= 1) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [isPaused, next, main.length]);

  if (main.length === 0) return null;

  const hero = main[activeIndex];

  return (
    <section
      className="bg-on-surface"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container-main py-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[28rem] lg:min-h-[32rem]">
          {/* Main story — 8 cols, crossfade */}
          <div className="lg:col-span-8 relative overflow-hidden">
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
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 lg:p-10">
                  <span className="inline-block text-label-sm font-bold uppercase tracking-widest text-secondary mb-3">
                    {a.category.name}
                  </span>
                  <h1 className="font-serif text-display-sm sm:text-display-md lg:text-display-lg text-white leading-[1.1] max-w-2xl">
                    {a.title}
                  </h1>
                  {a.excerpt && (
                    <p className="mt-4 text-body-md text-white/60 max-w-xl line-clamp-2 hidden sm:block">
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
            <div className="relative h-full min-h-[24rem] lg:min-h-full invisible">
              <div className="absolute inset-0" />
            </div>

            {/* Progress dots */}
            <div className="absolute bottom-4 left-6 sm:left-8 lg:left-10 z-20 flex items-center gap-2">
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

          {/* Side stories — 4 cols, stacked */}
          <div className="lg:col-span-4 flex flex-col">
            {side.map((a, i) => (
              <Link
                key={a.slug}
                href={`/berita/${a.slug}`}
                className={`group flex-1 relative overflow-hidden ${i < side.length - 1 ? "border-b border-white/10" : ""}`}
              >
                <div className="absolute inset-0">
                  {a.featuredImage ? (
                    <Image src={a.featuredImage} alt={a.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="absolute inset-0 bg-primary-container" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
                </div>
                <div className="relative p-5 flex flex-col justify-end h-full min-h-[8rem]">
                  <span className="text-label-sm font-bold uppercase tracking-widest text-secondary/80 mb-1">
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
        </div>
      </div>
    </section>
  );
}
