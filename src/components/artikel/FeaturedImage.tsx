"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

type Props = {
  src: string;
  alt: string;
  priority?: boolean;
};

export function FeaturedImage({ src, alt, priority = false }: Props) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="relative mt-6 flex aspect-[16/9] max-h-[60vh] items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-container-low">
        <div className="flex flex-col items-center gap-2.5 px-6 text-center">
          <ImageOff className="h-8 w-8 text-txt-muted" aria-hidden="true" />
          <p className="text-sm font-medium text-txt-secondary">Gambar tidak tersedia</p>
        </div>
      </div>
    );
  }

  // unoptimized: bypass Next.js's /_next/image proxy. Without this, the
  // optimizer tries to fetch /uploads/... from Next.js itself, which fails
  // because next start caches the public/ file list at startup and never
  // sees newly-uploaded files. Nginx serves /uploads/* directly from disk,
  // so a direct browser request always works (and the file is already a
  // properly-sized .webp from the upload pipeline anyway).
  const isLocalUpload = src.startsWith("/uploads/");

  return (
    <div className="relative mt-6 aspect-[16/9] max-h-[60vh] overflow-hidden rounded-sm">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        onError={() => setErrored(true)}
        unoptimized={isLocalUpload}
        priority={priority}
        sizes="(max-width: 768px) 100vw, 800px"
      />
    </div>
  );
}
