"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function ArticleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Article page error:", error);
    Sentry.captureException(error, {
      tags: {
        boundary: "article",
        ...(error.digest ? { digest: error.digest } : {}),
      },
    });
  }, [error]);

  return (
    <div
      role="alert"
      className="container-main flex min-h-[60vh] flex-col items-center justify-center text-center py-16"
    >
      <AlertTriangle className="h-10 w-10 text-red-600 mb-5" aria-hidden="true" />
      <h2 className="text-2xl font-bold text-txt-primary mb-2">
        Gagal Memuat Artikel
      </h2>
      <p className="text-txt-secondary max-w-md mb-4">
        Artikel yang Anda cari tidak dapat dimuat saat ini. Silakan coba lagi.
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-txt-muted mb-6">
          Kode referensi: {error.digest}
        </p>
      )}
      <div className="flex gap-3 mt-2">
        <button type="button" onClick={reset} className="btn-primary">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Coba Lagi
        </button>
        <Link href="/berita" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Semua Berita
        </Link>
      </div>
    </div>
  );
}
