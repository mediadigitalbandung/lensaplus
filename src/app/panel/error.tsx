"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Panel error]", error);
    Sentry.captureException(error, {
      tags: {
        boundary: "panel",
        ...(error.digest ? { digest: error.digest } : {}),
      },
    });
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div role="alert" className="container-main py-12 text-center">
      <h2 className="font-serif text-2xl text-on-surface mb-4">
        Terjadi Kesalahan
      </h2>
      <p className="text-on-surface-variant mb-4 max-w-md mx-auto">
        Tidak dapat memuat halaman panel ini. Tim kami telah diberitahu. Silakan
        coba lagi.
      </p>
      {error.digest && (
        <p className="text-xs font-mono text-txt-muted mb-4">
          Kode referensi: {error.digest}
        </p>
      )}
      {isDev && error.message && (
        <p className="text-xs font-mono text-red-700 max-w-xl mx-auto mb-6 border-l-4 border-red-600 pl-3 text-left break-words">
          {error.message}
        </p>
      )}
      <button type="button" className="btn-primary mt-2" onClick={reset}>
        Coba Lagi
      </button>
    </div>
  );
}
