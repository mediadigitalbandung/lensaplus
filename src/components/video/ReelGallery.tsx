"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, X } from "lucide-react";
import type { VideoStoryItem } from "@/lib/video-story";

export default function ReelGallery({ items }: { items: VideoStoryItem[] }) {
  const [playing, setPlaying] = useState<string | null>(null);

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
        {items.map((item, idx) => (
          <article key={`${item.slug}-${idx}`} className="group">
            <button
              type="button"
              onClick={() => item.videoUrl && setPlaying(item.videoUrl)}
              className="block w-full"
              aria-label={`Putar video: ${item.title}`}
            >
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-lg bg-surface-dark">
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
                    <Play size={20} className="ml-0.5 text-white" fill="white" />
                  </div>
                </div>
              </div>
            </button>
            <Link href={`/berita/${item.slug}`}>
              <h3 className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-txt-primary group-hover:underline">
                {item.title}
              </h3>
            </Link>
          </article>
        ))}
      </div>

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
              className="h-full w-full rounded-lg bg-black object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
