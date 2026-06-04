"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, ChevronLeft, ChevronRight, X } from "lucide-react";

interface VideoStoryItem {
  title: string;
  slug: string;
  thumbnail: string;
  duration: string;
  source: string;
  /** Rendered Reel MP4 — when present, tapping the card plays the video. */
  videoUrl?: string | null;
}

interface VideoStoryProps {
  items: VideoStoryItem[];
}

export default function VideoStory({ items }: VideoStoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const animRef = useRef<number | null>(null);
  const speedRef = useRef(0.5); // px per frame

  // Duplicate items for seamless loop
  const loopedItems = [...items, ...items];

  // Auto-scroll animation
  const animate = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (!isPaused) {
      el.scrollLeft += speedRef.current;

      // When we've scrolled past the first set, jump back seamlessly
      const halfWidth = el.scrollWidth / 2;
      if (el.scrollLeft >= halfWidth) {
        el.scrollLeft -= halfWidth;
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }, [isPaused]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  const manualScroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector("article");
    const cardWidth = card ? card.offsetWidth + 16 : 216;
    el.scrollBy({ left: dir === "right" ? cardWidth * 3 : -cardWidth * 3, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  const renderCard = (item: VideoStoryItem, idx: number) => {
    const thumbInner = (
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-surface-dark">
        <Image
          src={item.thumbnail}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <Play size={12} className="text-white ml-0.5" fill="white" />
          </div>
          <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {item.duration}
          </span>
        </div>
      </div>
    );
    return (
    <article
      key={`${item.slug}-${idx}`}
      className="group w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] shrink-0"
    >
      {item.videoUrl ? (
        <button
          type="button"
          onClick={() => setPlaying(item.videoUrl as string)}
          className="block w-full"
          aria-label={`Putar video: ${item.title}`}
        >
          {thumbInner}
        </button>
      ) : (
        <Link href={`/berita/${item.slug}`} className="block">
          {thumbInner}
        </Link>
      )}
      <div className="mt-2 flex items-start gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary mt-0.5">
          <Play size={8} className="text-white ml-px" fill="white" />
        </div>
        <div className="min-w-0">
          <Link href={`/berita/${item.slug}`}>
            <h3 className="text-xs font-bold leading-snug text-txt-primary line-clamp-2 group-hover:underline">
              {item.title}
            </h3>
          </Link>
          <p className="mt-0.5 text-[10px] text-txt-muted flex items-center gap-1">
            {item.source}
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-primary">
              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.28 5.78l-4 4a.75.75 0 01-1.06 0l-2-2a.75.75 0 111.06-1.06L6.75 8.19l3.47-3.47a.75.75 0 111.06 1.06z" />
            </svg>
          </p>
        </div>
      </div>
    </article>
    );
  };

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Scrollable row — auto-scrolling */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide"
        style={{ scrollBehavior: "auto" }}
      >
        {loopedItems.map((item, idx) => renderCard(item, idx))}
      </div>

      {/* Left arrow */}
      <button
        onClick={() => manualScroll("left")}
        className="absolute left-1 sm:-left-4 top-[30%] -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-txt-secondary shadow-card transition-all duration-200 hover:border-txt-muted hover:text-txt-primary hover:shadow-card-hover hover:scale-110 opacity-0 group-hover:opacity-100"
        aria-label="Geser kiri"
      >
        <ChevronLeft size={18} strokeWidth={1.5} />
      </button>

      {/* Right arrow */}
      <button
        onClick={() => manualScroll("right")}
        className="absolute right-1 sm:-right-4 top-[30%] -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-txt-secondary shadow-card transition-all duration-200 hover:border-txt-muted hover:text-txt-primary hover:shadow-card-hover hover:scale-110 opacity-0 group-hover:opacity-100"
        aria-label="Geser kanan"
      >
        <ChevronRight size={18} strokeWidth={1.5} />
      </button>

      {/* Reel player modal */}
      {playing && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPlaying(null)}
        >
          <button
            type="button"
            onClick={() => setPlaying(null)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
          <div
            className="aspect-[9/16] h-full max-h-[88vh] w-auto max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={playing}
              controls
              autoPlay
              playsInline
              loop
              className="h-full w-full rounded-xl bg-black object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
