"use client";

import Image from "next/image";
import Link from "next/link";
import { WifiOff, RefreshCw, Home } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 py-20 text-center">
      {/* Logo */}
      <Link href="/" aria-label="Kembali ke beranda Kartawarta">
        <Image
          src="/kartawarta-icon.png"
          alt="Logo Kartawarta"
          width={72}
          height={72}
          className="rounded-sm mb-6 opacity-80"
          priority
        />
      </Link>

      {/* Icon offline */}
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
        <WifiOff className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>

      {/* Heading */}
      <h1 className="font-serif text-headline-md text-on-surface tracking-tight mb-3">
        Anda Sedang Offline
      </h1>

      {/* Body */}
      <p className="text-body-md text-on-surface-variant max-w-sm mb-8">
        Koneksi internet tidak tersedia. Konten yang sudah Anda kunjungi sebelumnya
        mungkin masih tersimpan di perangkat Anda. Silakan coba lagi nanti.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => window.location.reload()}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Coba Lagi
        </button>
        <Link href="/" className="btn-secondary flex items-center gap-2">
          <Home className="h-4 w-4" aria-hidden="true" />
          Beranda
        </Link>
      </div>

      {/* Footer hint */}
      <p className="mt-10 text-label-md text-on-surface-variant/60">
        kartawarta.com — Media Berita Digital Bandung
      </p>
    </div>
  );
}
