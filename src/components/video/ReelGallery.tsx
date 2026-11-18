"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, X } from "lucide-react";
import type { VideoStoryItem } from "@/lib/video-story";
import { safeHref } from "@/components/common/safeHref";

export default function ReelGallery({ items }: { items: VideoStoryItem[] }) {
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    if (!playing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaying(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [playing]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface py-16 text-center shadow-card">
        <p className="text-sm text-txt-secondary">
          Belum ada video story. Buat Reel di panel admin untuk menampilkannya di sini.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item, idx) => {
          const playableUrl = safeHref(item.videoUrl, { allowRelative: true });
          const thumb = (
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-surface-dark">
              <Image
                src={item.thumbnail}
                alt={item.title}
                fill
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Play size={28} className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110" fill="white" aria-hidden="true" />
              </div>
            </div>
          );
          return (
            <article key={`${item.slug}-${idx}`} className="group">
              {playableUrl ? (
                <button
                  type="button"
                  onClick={() => setPlaying(playableUrl)}
                  className="block w-full"
                  aria-label={`Putar video: ${item.title}`}
                >
                  {thumb}
                </button>
              ) : (
                <Link
                  href={`/berita/${item.slug}`}
                  className="block w-full"
                  aria-label={`Baca berita: ${item.title}`}
                >
                  {thumb}
                </Link>
              )}
              <Link href={`/berita/${item.slug}`}>
                <h3 className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-txt-primary group-hover:underline">
                  {item.title}
                </h3>
              </Link>
            </article>
          );
        })}
      </div>

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
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
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
    </>
  );
}
