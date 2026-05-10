import Link from "next/link";
import { Search, Home, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="bg-surface min-h-[70vh] flex items-center justify-center">
      <div className="container-main py-16 text-center">
        {/* 404 illustration */}
        <div className="mb-8">
          <span className="text-8xl font-extrabold text-primary/20 sm:text-9xl select-none">404</span>
        </div>

        <h1 className="text-2xl font-bold text-txt-primary sm:text-3xl">
          Halaman Tidak Ditemukan
        </h1>
        <p className="mt-3 text-txt-secondary max-w-md mx-auto">
          Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan.
          Gunakan pencarian untuk menemukan konten yang Anda butuhkan.
        </p>

        {/* Search bar */}
        <form action="/search" method="GET" className="mt-8 mx-auto max-w-lg">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted" />
            <input
              type="text"
              name="q"
              placeholder="Cari berita..."
              className="input w-full py-3 pl-12 pr-4 text-base"
              autoFocus
            />
          </div>
        </form>

        {/* Action buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="btn-primary">
            <Home size={16} />
            Kembali ke Beranda
          </Link>
          <Link href="/berita" className="btn-secondary">
            Semua Berita
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
