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
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [animate]);

  useEffect(() => {
    if (!playing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaying(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playing]);

  const manualScroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector("article");
    const cardWidth = card ? card.offsetWidth + 16 : 216;
    el.scrollBy({ left: dir === "right" ? cardWidth * 3 : -cardWidth * 3, behavior: "smooth" });
  };

  if (items.length === 0) return null;

  const renderCard = (item: VideoStoryItem, idx: number) => {
    const isClone = idx >= items.length;
    const thumbInner = (
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-surface-dark">
        <Image
          src={item.thumbnail}
          alt={isClone ? "" : item.title}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <Play size={14} className="text-white drop-shadow" fill="white" aria-hidden="true" />
          <span className="text-[11px] font-medium text-white drop-shadow">
            {item.duration}
          </span>
        </div>
      </div>
    );
    return (
    <article
      key={`${item.slug}-${idx}`}
      aria-hidden={isClone || undefined}
      className="group w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] shrink-0"
    >
      {item.videoUrl ? (
        <button
          type="button"
          tabIndex={isClone ? -1 : undefined}
          onClick={() => setPlaying(item.videoUrl as string)}
          className="block w-full"
          aria-label={`Putar video: ${item.title}`}
        >
          {thumbInner}
        </button>
      ) : (
        <Link href={`/berita/${item.slug}`} tabIndex={isClone ? -1 : undefined} className="block">
          {thumbInner}
        </Link>
      )}
      <div className="mt-2">
        <Link href={`/berita/${item.slug}`} tabIndex={isClone ? -1 : undefined}>
          <h3 className="text-xs font-bold leading-snug text-txt-primary line-clamp-2 group-hover:underline">
            {item.title}
          </h3>
        </Link>
        <p className="mt-0.5 text-[10px] text-txt-muted">
          {item.source}
        </p>
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
        type="button"
        onClick={() => manualScroll("left")}
        className="absolute left-1 sm:-left-6 top-[30%] -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center text-txt-primary hover:text-primary transition-all duration-200 hover:scale-110 opacity-0 group-hover:opacity-100"
        aria-label="Geser kiri"
      >
        <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => manualScroll("right")}
        className="absolute right-1 sm:-right-6 top-[30%] -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center text-txt-primary hover:text-primary transition-all duration-200 hover:scale-110 opacity-0 group-hover:opacity-100"
        aria-label="Geser kanan"
      >
        <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>

      {/* Reel player modal */}
      {playing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pemutar video"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setPlaying(null)}
        >
          <button
            type="button"
            onClick={() => setPlaying(null)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center text-white/80 hover:text-white transition-colors"
            aria-label="Tutup"
          >
            <X size={24} aria-hidden="true" />
          </button>
          <div
            className="aspect-[9/16] h-full max-h-[88vh] w-auto max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={playing}
              controls
              autoPlay
              playsInline
              loop
              className="h-full w-full rounded-lg bg-black object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
