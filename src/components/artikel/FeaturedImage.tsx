"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

type Props = {
  src: string;
  alt: string;
};

export function FeaturedImage({ src, alt }: Props) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="relative mt-6 flex aspect-[16/9] max-h-[60vh] items-center justify-center overflow-hidden rounded-sm bg-primary-light">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ImageOff className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-primary">Gambar tidak tersedia</p>
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
      />
    </div>
  );
}
