"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
    Sentry.captureException(error, { tags: { digest: error.digest } });
  }, [error]);

  return (
    <div className="container-main flex min-h-[60vh] flex-col items-center justify-center text-center py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
        <AlertTriangle className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold text-txt-primary mb-2">
        Terjadi Kesalahan
      </h2>
      <p className="text-txt-secondary max-w-md mb-8">
        Maaf, terjadi kesalahan saat memuat halaman ini. Silakan coba lagi atau
        kembali ke beranda.
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="btn-primary">
          <RotateCcw className="h-4 w-4" />
          Coba Lagi
        </button>
        <Link href="/" className="btn-secondary">
          <Home className="h-4 w-4" />
          Ke Beranda
        </Link>
      </div>
    </div>
  );
}
